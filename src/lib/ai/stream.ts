/**
 * Réponse en flux pour les textes longs (rapport mensuel) : le texte s'affiche au fur et à mesure.
 * Même journal (tokens, latence, coût) que les autres appels ; délai global et repli identiques.
 */
import { MODELS, estimateCostUsd, type ModelKey, type Usage } from "./models.ts";
import type { AiStore } from "./run.ts";
import type { MessageParams } from "./types.ts";

interface StreamEvent {
  type: string;
  delta?: { type?: string; text?: string };
  message?: { usage?: { input_tokens?: number; cache_read_input_tokens?: number | null } };
  usage?: { output_tokens?: number };
}

export interface StreamingClient {
  messages: {
    create(params: MessageParams & { stream: true }, options?: { timeout?: number; maxRetries?: number; signal?: AbortSignal }): Promise<AsyncIterable<StreamEvent>>;
  };
}

export interface StreamTask {
  id: string;
  version: string;
  model: ModelKey;
  system: string;
  maxTokens: number;
  timeoutMs: number;
}

/** Appelle l'API en flux, transmet chaque morceau de texte, renvoie le texte complet (ou null). */
export async function streamText(
  client: StreamingClient,
  task: StreamTask,
  user: string,
  store: AiStore,
  onText: (chunk: string) => void,
): Promise<string | null> {
  const started = Date.now();
  const usage: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), task.timeoutMs);
  let text = "";
  let status: "ok" | "timeout" | "error" = "ok";
  try {
    const events = await client.messages.create(
      { model: MODELS[task.model], max_tokens: task.maxTokens, system: task.system, messages: [{ role: "user", content: user }], stream: true },
      { timeout: task.timeoutMs, maxRetries: 1, signal: controller.signal },
    );
    for await (const e of events) {
      if (e.type === "message_start") {
        usage.inputTokens = e.message?.usage?.input_tokens ?? 0;
        usage.cacheReadTokens = e.message?.usage?.cache_read_input_tokens ?? 0;
      } else if (e.type === "content_block_delta" && e.delta?.type === "text_delta" && e.delta.text) {
        text += e.delta.text;
        onText(e.delta.text);
      } else if (e.type === "message_delta") {
        usage.outputTokens = e.usage?.output_tokens ?? usage.outputTokens;
      }
    }
  } catch {
    status = controller.signal.aborted ? "timeout" : "error";
  } finally {
    clearTimeout(timer);
  }
  await store
    .log({
      task: task.id,
      promptVersion: task.version,
      model: MODELS[task.model],
      status,
      usage,
      latencyMs: Date.now() - started,
      costUsd: estimateCostUsd(MODELS[task.model], usage),
    })
    .catch(() => undefined);
  return status === "ok" && text.trim() ? text : null;
}
