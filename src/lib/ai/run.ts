/**
 * Exécution d'une tâche IA avec tous les garde-fous : quota, cache, délai, validation, journal.
 *
 * Toute tâche passe par ici. En cas d'échec (quota, délai, sortie invalide, API en panne, IA
 * désactivée), on renvoie { ok: false } et l'appelant propose le repli non-IA : jamais d'erreur
 * bloquante pour l'utilisateur, jamais de valeur inventée.
 */
import { createHash } from "node:crypto";
import { callStructured, type Validator } from "./structured.ts";
import type { ModelKey, Usage } from "./models.ts";
import { MODELS } from "./models.ts";
import type { ContentBlock, MessagesClient } from "./types.ts";

export interface AiTask<I, O> {
  /** Identifiant stable (journal, quotas, cache) : minuscules et tirets. */
  id: string;
  /** Version du prompt : la changer invalide le cache et se lit dans le journal. */
  version: string;
  model: ModelKey;
  effort?: "low" | "medium" | "high";
  maxTokens: number;
  timeoutMs: number;
  system: string;
  user(input: I): string | ContentBlock[];
  jsonSchema: Record<string, unknown>;
  validator: Validator<O>;
  quota: { user: number; org: number };
  /** Clé de cache (déjà minimisée), ou null pour ne pas mettre en cache. */
  cacheKey?(input: I): string | null;
  cacheTtlHours?: number;
  /**
   * Réponse simulée, déterministe, utilisée quand AI_MOCK=1 (tests de bout en bout, démo sans clé).
   * Elle passe par la même validation que la vraie réponse.
   */
  mock?(input: I): unknown;
}

export type RunStatus = "ok" | "invalid_output" | "refused" | "error" | "timeout" | "rate_limited" | "cached" | "mock";

export interface LogEntry {
  task: string;
  promptVersion: string;
  model: string;
  status: RunStatus | "low_confidence";
  usage: Usage;
  latencyMs: number;
  costUsd: number;
  errorCode?: string;
}

/** Accès à la base (journal, quotas, cache) : la session Supabase en production, un faux en test. */
export interface AiStore {
  consume(task: string, userLimit: number, orgLimit: number): Promise<boolean>;
  cacheGet(key: string): Promise<unknown | null>;
  cachePut(key: string, task: string, output: unknown, ttlHours: number): Promise<void>;
  log(entry: LogEntry): Promise<void>;
}

export type RunResult<O> =
  | { ok: true; data: O; source: "ai" | "cache" | "mock" }
  | { ok: false; reason: RunStatus | "disabled" };

export function cacheHash(task: AiTask<unknown, unknown>, key: string): string {
  return createHash("sha256").update(`${task.id}@${task.version}\n${key}`).digest("hex");
}

const NO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };

export async function runTask<I, O>(
  task: AiTask<I, O>,
  input: I,
  deps: { client: MessagesClient | null; store: AiStore; mock?: boolean },
): Promise<RunResult<O>> {
  const { client, store } = deps;
  const base = { task: task.id, promptVersion: task.version, model: MODELS[task.model] };
  const log = (e: Omit<LogEntry, "task" | "promptVersion" | "model">) => store.log({ ...base, ...e }).catch(() => undefined);

  // 1. Cache : une entrée déjà vue ne coûte rien (et ne consomme pas de quota).
  const rawKey = task.cacheKey?.(input) ?? null;
  const key = rawKey ? cacheHash(task as AiTask<unknown, unknown>, rawKey) : null;
  if (key) {
    const cached = await store.cacheGet(key).catch(() => null);
    if (cached !== null) {
      const parsed = task.validator.safeParse(cached);
      if (parsed.success) {
        await log({ status: "cached", usage: NO_USAGE, latencyMs: 0, costUsd: 0 });
        return { ok: true, data: parsed.data, source: "cache" };
      }
    }
  }

  // Mode simulé : aucune requête réseau, mêmes validations.
  if (deps.mock) {
    if (!task.mock) return { ok: false, reason: "disabled" };
    const parsed = task.validator.safeParse(task.mock(input));
    await log({ status: parsed.success ? "mock" : "invalid_output", usage: NO_USAGE, latencyMs: 0, costUsd: 0 });
    return parsed.success ? { ok: true, data: parsed.data, source: "mock" } : { ok: false, reason: "invalid_output" };
  }

  if (!client) return { ok: false, reason: "disabled" };

  // 2. Quota par personne et par organisation.
  const allowed = await store.consume(task.id, task.quota.user, task.quota.org).catch(() => false);
  if (!allowed) {
    await log({ status: "rate_limited", usage: NO_USAGE, latencyMs: 0, costUsd: 0 });
    return { ok: false, reason: "rate_limited" };
  }

  // 3. Appel, validation.
  const r = await callStructured({
    client,
    model: task.model,
    effort: task.effort,
    system: task.system,
    user: task.user(input),
    jsonSchema: task.jsonSchema,
    validator: task.validator,
    maxTokens: task.maxTokens,
    timeoutMs: task.timeoutMs,
  });
  if (!r.ok) {
    await log({ status: r.reason, usage: r.usage, latencyMs: r.latencyMs, costUsd: r.costUsd, errorCode: r.detail });
    return { ok: false, reason: r.reason };
  }
  await log({ status: "ok", usage: r.usage, latencyMs: r.latencyMs, costUsd: r.costUsd });
  if (key) await store.cachePut(key, task.id, r.data, task.cacheTtlHours ?? 24).catch(() => undefined);
  return { ok: true, data: r.data, source: "ai" };
}
