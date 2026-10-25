/**
 * Vérification d'un justificatif : lecture de la photo (bucket privé, clé de service), jugement de
 * l'IA, verdict prudent (verdict.ts), enregistrement par la base, effacement de la photo.
 * Lancée juste après l'enregistrement de l'action, puis rattrapée par la tâche quotidienne.
 */
import { runTask, type AiStore, type LogEntry } from "../run.ts";
import type { ImageMediaType, MessagesClient } from "../types.ts";
import { proofCheckTask, PROOF_CHECK_VERSION } from "../prompts/proof-check.ts";
import { MODELS } from "../models.ts";
import { decide, type Verdict } from "./verdict.ts";

interface AdminDb {
  from(table: string): {
    select(cols: string): {
      eq(col: string, v: string): { maybeSingle(): PromiseLike<{ data: unknown; error: unknown }> };
    };
  };
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  storage: {
    from(bucket: string): {
      download(path: string): PromiseLike<{ data: Blob | null; error: unknown }>;
      remove(paths: string[]): PromiseLike<unknown>;
    };
  };
}

const MEDIA: Record<string, ImageMediaType> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const MAX_BYTES = 5 * 1024 * 1024;

/** Journal et quotas pour les appels lancés avec la clé de service. */
export function serviceStore(admin: AdminDb, companyId: string): AiStore {
  return {
    consume: async () => true,
    cacheGet: async () => null,
    cachePut: async () => undefined,
    async log(e: LogEntry) {
      await admin.rpc("ai_log_service", {
        p_company: companyId,
        p_task: e.task,
        p_prompt_version: e.promptVersion,
        p_model: e.model,
        p_status: e.status,
        p_input_tokens: e.usage.inputTokens,
        p_output_tokens: e.usage.outputTokens,
        p_cache_read_tokens: e.usage.cacheReadTokens,
        p_latency_ms: e.latencyMs,
        p_cost_usd: e.costUsd,
        p_error_code: e.errorCode ?? null,
      });
    },
  };
}

export type VerifyOutcome = Verdict | "skipped" | "unavailable";

export async function verifyProof(
  admin: AdminDb,
  validationId: string,
  ai: { client: MessagesClient | null; mock?: boolean },
  bucket: string,
): Promise<VerifyOutcome> {
  const { data } = await admin.from("validations").select("id, user_id, company_id, template_id, day, receipt_path, proof_status").eq("id", validationId).maybeSingle();
  const v = data as { id: string; user_id: string; company_id: string; template_id: string; day: string; receipt_path: string | null; proof_status: string } | null;
  if (!v || v.proof_status !== "pending" || !v.receipt_path) return "skipped";
  // IA refusée par la personne : la photo n'est pas lue ; elle sera effacée au bout de 30 jours.
  const { data: who } = await admin.from("profiles").select("consent_ai").eq("id", v.user_id).maybeSingle();
  if ((who as { consent_ai?: boolean } | null)?.consent_ai === false) return "skipped";

  const { data: blob } = await admin.storage.from(bucket).download(v.receipt_path);
  if (!blob || blob.size === 0 || blob.size > MAX_BYTES) return "unavailable";
  const ext = v.receipt_path.split(".").pop()?.toLowerCase() ?? "";
  const mediaType = (MEDIA[ext] ?? (blob.type as ImageMediaType)) || "image/jpeg";
  const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");

  const r = await runTask(
    proofCheckTask,
    { template: v.template_id, day: v.day, image: { mediaType, base64 } },
    { client: ai.client, store: serviceStore(admin, v.company_id), mock: ai.mock },
  );
  // IA indisponible : la vérification reste en attente, la tâche quotidienne la reprendra.
  if (!r.ok) return "unavailable";

  const d = decide(r.data);
  const { data: res, error } = await admin.rpc("record_proof_verdict", {
    p_validation: v.id,
    p_verdict: d.verdict,
    p_reason: d.reason,
    p_model: MODELS.fast,
    p_version: PROOF_CHECK_VERSION,
  });
  if (error) return "skipped";
  const toDelete = (res as { photo_to_delete?: string | null } | null)?.photo_to_delete;
  if (toDelete) await admin.storage.from(bucket).remove([toDelete]);
  return d.verdict;
}
