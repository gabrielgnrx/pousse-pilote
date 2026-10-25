/**
 * Appel à Claude avec une sortie JSON structurée, validée à la réception.
 *
 * L'API garantit la forme (output_config.format = json_schema), zod garantit le fond (bornes, enums,
 * cohérence). Une sortie invalide n'est jamais « devinée » : l'appelant reçoit un échec et bascule sur
 * le repli non-IA (choix manuel, formulaire).
 */
import { MODELS, estimateCostUsd, type ModelKey, type Usage } from "./models.ts";
import { toApiSchema } from "./json-schema.ts";
import type { ApiMessage, ContentBlock, MessageParams, MessagesClient } from "./types.ts";

/** Ce que l'on attend d'un validateur : un schéma zod convient tel quel. */
export interface Validator<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: unknown };
}

export type FailureReason = "timeout" | "invalid_output" | "refused" | "error";

export type CallResult<T> =
  | { ok: true; data: T; usage: Usage; latencyMs: number; costUsd: number }
  | { ok: false; reason: FailureReason; detail?: string; usage: Usage; latencyMs: number; costUsd: number };

export interface StructuredCall<T> {
  client: MessagesClient;
  model: ModelKey;
  system: string;
  user: string | ContentBlock[];
  /** JSON Schema de la sortie (z.toJSONSchema), nettoyé ici pour l'API. */
  jsonSchema: Record<string, unknown>;
  validator: Validator<T>;
  maxTokens: number;
  timeoutMs: number;
  /** Rapidité : « low » pour classer, défaut du modèle pour rédiger. */
  effort?: "low" | "medium" | "high";
  /** Met en cache le message système (catalogue, consignes) : 10 % du prix à la relecture. */
  cacheSystem?: boolean;
  /** Horloge injectable pour les tests. */
  now?: () => number;
}

const EMPTY: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };

export function usageOf(m: ApiMessage | undefined): Usage {
  return {
    inputTokens: m?.usage?.input_tokens ?? 0,
    outputTokens: m?.usage?.output_tokens ?? 0,
    cacheReadTokens: m?.usage?.cache_read_input_tokens ?? 0,
  };
}

/** Le texte JSON de la réponse (premier bloc texte). */
export function textOf(m: ApiMessage): string | null {
  for (const block of m.content) {
    if (block.type === "text" && typeof (block as { text?: unknown }).text === "string") return (block as { text: string }).text;
  }
  return null;
}

export function buildParams(call: Omit<StructuredCall<unknown>, "client" | "validator" | "timeoutMs" | "now">): MessageParams {
  const model = MODELS[call.model];
  const params: MessageParams = {
    model,
    max_tokens: call.maxTokens,
    system: call.cacheSystem ? [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }] : call.system,
    messages: [{ role: "user", content: call.user }],
    output_config: { format: { type: "json_schema", schema: toApiSchema(call.jsonSchema) } },
  };
  if (call.effort) params.output_config!.effort = call.effort;
  // Classer vite : pas de réflexion préalable. Haiku accepte « disabled » ; Sonnet 5.5 refuse
  // « disabled » et utilise « between_tools » pour couper la réflexion avant la réponse.
  if (call.effort === "low") params.thinking = call.model === "fast" ? { type: "disabled" } : { type: "between_tools" };
  return params;
}

function isTimeout(e: unknown): boolean {
  const name = (e as { name?: string })?.name ?? "";
  const msg = String((e as { message?: string })?.message ?? "");
  return /timeout|abort/i.test(name) || /timed? ?out|aborted/i.test(msg);
}

export async function callStructured<T>(call: StructuredCall<T>): Promise<CallResult<T>> {
  const now = call.now ?? Date.now;
  const started = now();
  const params = buildParams(call);
  const done = (m: ApiMessage | undefined) => {
    const usage = usageOf(m);
    return { usage, latencyMs: Math.max(0, Math.round(now() - started)), costUsd: estimateCostUsd(MODELS[call.model], usage) };
  };

  // Délai global (nouvel essai compris) : au-delà, l'utilisateur passe au repli sans attendre.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), call.timeoutMs);
  let message: ApiMessage;
  try {
    message = await call.client.messages.create(params, { timeout: call.timeoutMs, maxRetries: 1, signal: controller.signal });
  } catch (e) {
    const reason = controller.signal.aborted || isTimeout(e) ? "timeout" : "error";
    return { ok: false, reason, detail: String((e as Error)?.message ?? e).slice(0, 80), ...done(undefined) };
  } finally {
    clearTimeout(timer);
  }

  const meta = done(message);
  if (message.stop_reason === "refusal") return { ok: false, reason: "refused", ...meta };
  // max_tokens : la sortie peut être tronquée, donc non conforme au schéma. On ne la répare pas.
  if (message.stop_reason === "max_tokens") return { ok: false, reason: "invalid_output", detail: "max_tokens", ...meta };

  const text = textOf(message);
  if (text === null) return { ok: false, reason: "invalid_output", detail: "no_text", ...meta };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: "invalid_output", detail: "json", ...meta };
  }
  const parsed = call.validator.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "invalid_output", detail: "schema", ...meta };
  return { ok: true, data: parsed.data, ...meta };
}

export { EMPTY as EMPTY_USAGE };
