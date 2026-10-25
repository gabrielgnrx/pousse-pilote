/**
 * Journal, quotas et cache de l'IA dans Supabase (migration 0029), avec la session de la personne :
 * la base fixe elle-même l'utilisateur et l'organisation, l'application ne peut pas les choisir.
 */
import type { AiStore, LogEntry } from "./run.ts";

interface RpcClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export function supabaseStore(db: RpcClient, cron?: { token: string; companyId: string | null }): AiStore {
  return {
    async consume(task, userLimit, orgLimit) {
      // Les tâches planifiées ont leur propre budget (nombre d'équipes, de semaines) : pas de quota par personne.
      if (cron) return true;
      const { data, error } = await db.rpc("ai_consume", { p_task: task, p_user_limit: userLimit, p_org_limit: orgLimit });
      return !error && data === true;
    },
    async cacheGet(key) {
      if (cron) return null;
      const { data, error } = await db.rpc("ai_cache_get", { p_key: key });
      return error ? null : (data ?? null);
    },
    async cachePut(key, task, output, ttlHours) {
      if (cron) return;
      await db.rpc("ai_cache_put", { p_key: key, p_task: task, p_output: output, p_ttl_hours: ttlHours });
    },
    async log(e: LogEntry) {
      await db.rpc("ai_log", {
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
        p_token: cron?.token ?? null,
        p_company: cron?.companyId ?? null,
      });
    },
  };
}
