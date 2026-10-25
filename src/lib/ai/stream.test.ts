import { test } from "node:test";
import assert from "node:assert/strict";
import { streamText, type StreamingClient } from "./stream.ts";
import type { AiStore, LogEntry } from "./run.ts";

const task = { id: "rapport", version: "rapport@1", model: "writer" as const, system: "s", maxTokens: 100, timeoutMs: 1000 };

function store() {
  const logs: LogEntry[] = [];
  const s: AiStore = { consume: async () => true, cacheGet: async () => null, cachePut: async () => undefined, log: async (e) => void logs.push(e) };
  return { s, logs };
}

test("flux : les morceaux arrivent dans l'ordre, l'usage est journalisé", async () => {
  const client: StreamingClient = {
    messages: {
      create: async () =>
        (async function* () {
          yield { type: "message_start", message: { usage: { input_tokens: 300 } } };
          yield { type: "content_block_delta", delta: { type: "text_delta", text: "Faits " } };
          yield { type: "content_block_delta", delta: { type: "text_delta", text: "marquants" } };
          yield { type: "message_delta", usage: { output_tokens: 42 } };
        })(),
    },
  };
  const chunks: string[] = [];
  const { s, logs } = store();
  const text = await streamText(client, task, "u", s, (c) => chunks.push(c));
  assert.equal(text, "Faits marquants");
  assert.deepEqual(chunks, ["Faits ", "marquants"]);
  assert.equal(logs[0].usage.outputTokens, 42);
  assert.equal(logs[0].status, "ok");
});

test("flux : panne en cours de route → null (le texte des règles prend le relais)", async () => {
  const client: StreamingClient = {
    messages: {
      create: async () =>
        (async function* () {
          yield { type: "content_block_delta", delta: { type: "text_delta", text: "Début" } };
          throw new Error("connexion perdue");
        })(),
    },
  };
  const { s, logs } = store();
  assert.equal(await streamText(client, task, "u", s, () => undefined), null);
  assert.equal(logs[0].status, "error");
});
