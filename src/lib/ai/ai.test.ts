import { test } from "node:test";
import assert from "node:assert/strict";
import { buildParams, callStructured, type Validator } from "./structured.ts";
import { runTask, cacheHash, type AiStore, type AiTask, type LogEntry } from "./run.ts";
import { toApiSchema } from "./json-schema.ts";
import { estimateCostUsd } from "./models.ts";
import { normalizeForCache, redact } from "./redact.ts";
import type { ApiMessage, MessageParams, MessagesClient } from "./types.ts";

// Un validateur écrit à la main (même contrat que zod.safeParse) : ces tests tournent sans dépendance.
interface Out {
  label: string;
  confidence: number;
}
const validator: Validator<Out> = {
  safeParse(x: unknown) {
    const o = x as Out;
    if (o && typeof o.label === "string" && typeof o.confidence === "number" && o.confidence >= 0 && o.confidence <= 1) {
      return { success: true, data: { label: o.label, confidence: o.confidence } };
    }
    return { success: false, error: new Error("schéma") };
  },
};
const jsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: { label: { type: "string", maxLength: 40 }, confidence: { type: "number", minimum: 0, maximum: 1 } },
  required: ["label", "confidence"],
};

function reply(text: string, stop = "end_turn"): ApiMessage {
  return { content: [{ type: "text", text }], stop_reason: stop, usage: { input_tokens: 100, output_tokens: 20 } };
}

function fakeClient(fn: (p: MessageParams) => ApiMessage | Promise<ApiMessage>) {
  const calls: MessageParams[] = [];
  const client: MessagesClient = {
    messages: {
      async create(p) {
        calls.push(p);
        return fn(p);
      },
    },
  };
  return { client, calls };
}

function fakeStore(opts: { allow?: boolean } = {}) {
  const logs: LogEntry[] = [];
  const cache = new Map<string, unknown>();
  let consumed = 0;
  const store: AiStore = {
    async consume() {
      consumed++;
      return opts.allow ?? true;
    },
    async cacheGet(k) {
      return cache.get(k) ?? null;
    },
    async cachePut(k, _t, o) {
      cache.set(k, o);
    },
    async log(e) {
      logs.push(e);
    },
  };
  return { store, logs, cache, consumed: () => consumed };
}

const base = { model: "fast" as const, system: "Classe.", user: "vélo 8 km", jsonSchema, validator, maxTokens: 200, timeoutMs: 1000 };

test("sortie valide : données validées, usage et coût estimés", async () => {
  const { client } = fakeClient(() => reply('{"label":"velo","confidence":0.9}'));
  const r = await callStructured({ ...base, client });
  assert.ok(r.ok);
  assert.deepEqual(r.data, { label: "velo", confidence: 0.9 });
  assert.equal(r.usage.inputTokens, 100);
  assert.equal(r.costUsd, estimateCostUsd("claude-haiku-5-5", r.usage));
});

test("sortie invalide : JSON cassé, schéma non respecté, tronquée ou refusée → échec, jamais devinée", async () => {
  for (const [msg, detail] of [
    [reply("pas du json"), "json"],
    [reply('{"label":"velo","confidence":7}'), "schema"],
    [reply('{"label":"ve', "max_tokens"), "max_tokens"],
    [{ content: [], stop_reason: "end_turn" } as ApiMessage, "no_text"],
  ] as const) {
    const { client } = fakeClient(() => msg);
    const r = await callStructured({ ...base, client });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.reason, "invalid_output");
      assert.equal(r.detail, detail);
    }
  }
  const { client } = fakeClient(() => reply("", "refusal"));
  const r = await callStructured({ ...base, client });
  assert.equal(!r.ok && r.reason, "refused");
});

test("délai dépassé : échec « timeout » sans attendre la réponse", async () => {
  const client: MessagesClient = {
    messages: {
      create: (_p, opts) =>
        new Promise((_res, rej) => opts?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })))),
    },
  };
  const started = Date.now();
  const r = await callStructured({ ...base, client, timeoutMs: 50 });
  assert.equal(!r.ok && r.reason, "timeout");
  assert.ok(Date.now() - started < 1000);
});

test("API en panne : échec « error »", async () => {
  const { client } = fakeClient(() => {
    throw new Error("529 overloaded");
  });
  const r = await callStructured({ ...base, client });
  assert.equal(!r.ok && r.reason, "error");
});

test("paramètres envoyés : modèle, schéma nettoyé, classification sans réflexion préalable", () => {
  const fast = buildParams({ ...base, effort: "low" });
  assert.equal(fast.model, "claude-haiku-5-5");
  assert.deepEqual(fast.thinking, { type: "disabled" });
  assert.equal(fast.output_config?.effort, "low");
  const schema = fast.output_config?.format?.schema as Record<string, unknown>;
  assert.equal(schema.$schema, undefined);
  assert.equal(schema.additionalProperties, false);
  const props = schema.properties as Record<string, Record<string, unknown>>;
  assert.equal(props.confidence.minimum, undefined);
  assert.equal(props.label.maxLength, undefined);
  // Sonnet 5.5 refuse « disabled » : on coupe la réflexion avec « between_tools ».
  assert.deepEqual(buildParams({ ...base, model: "writer", effort: "low" }).thinking, { type: "between_tools" });
  assert.equal(buildParams({ ...base, model: "writer" }).thinking, undefined);
  assert.equal(buildParams({ ...base, model: "writer" }).model, "claude-sonnet-5-5");
});

test("schéma : les noms de propriétés ne sont jamais pris pour des mots-clés", () => {
  const s = toApiSchema({
    type: "object",
    properties: { format: { type: "string" }, items: { type: "array", items: { type: "object", properties: {} }, maxItems: 3, minItems: 1 } },
  });
  const props = s.properties as Record<string, Record<string, unknown>>;
  assert.ok(props.format);
  assert.equal(props.items.maxItems, undefined);
  assert.equal(props.items.minItems, 1);
  assert.equal((props.items.items as Record<string, unknown>).additionalProperties, false);
});

test("coût estimé : prix publics de Haiku 5.5 et Sonnet 5.5", () => {
  assert.equal(estimateCostUsd("claude-haiku-5-5", { inputTokens: 100_000, outputTokens: 0, cacheReadTokens: 0 }), 0.01);
  assert.equal(estimateCostUsd("claude-haiku-5-5", { inputTokens: 1000, outputTokens: 1_000_000, cacheReadTokens: 0 }), 0.5001);
  // Au-delà de 100 000 tokens d'entrée, Haiku 5.5 passe au tarif long.
  assert.equal(estimateCostUsd("claude-haiku-5-5", { inputTokens: 200_000, outputTokens: 0, cacheReadTokens: 0 }), 0.1);
  assert.equal(estimateCostUsd("claude-sonnet-5-5", { inputTokens: 1000, outputTokens: 500, cacheReadTokens: 0 }), 0.007);
});

const task: AiTask<string, Out> = {
  id: "test-task",
  version: "v1",
  model: "fast",
  effort: "low",
  maxTokens: 200,
  timeoutMs: 1000,
  system: "Classe.",
  user: (t) => t,
  jsonSchema,
  validator,
  quota: { user: 5, org: 50 },
  cacheKey: (t) => normalizeForCache(t),
  mock: (t) => ({ label: t.includes("vélo") ? "velo" : "autre", confidence: 0.95 }),
};

test("tâche : appel, journal, puis cache (la même saisie ne coûte plus rien)", async () => {
  const { client, calls } = fakeClient(() => reply('{"label":"velo","confidence":0.9}'));
  const s = fakeStore();
  const r1 = await runTask(task, "Vélo 8 km.", { client, store: s.store });
  assert.ok(r1.ok && r1.source === "ai");
  const r2 = await runTask(task, "vélo 8 km", { client, store: s.store });
  assert.ok(r2.ok && r2.source === "cache");
  assert.equal(calls.length, 1);
  assert.equal(s.consumed(), 1);
  assert.deepEqual(s.logs.map((l) => l.status), ["ok", "cached"]);
  assert.equal(s.logs[0].task, "test-task");
  assert.equal(s.logs[0].model, "claude-haiku-5-5");
});

test("tâche : quota dépassé → repli, aucun appel", async () => {
  const { client, calls } = fakeClient(() => reply('{"label":"velo","confidence":0.9}'));
  const s = fakeStore({ allow: false });
  const r = await runTask(task, "vélo", { client, store: s.store });
  assert.deepEqual(r, { ok: false, reason: "rate_limited" });
  assert.equal(calls.length, 0);
  assert.equal(s.logs[0].status, "rate_limited");
});

test("tâche : sans clé API, IA désactivée (repli non-IA)", async () => {
  const r = await runTask(task, "vélo", { client: null, store: fakeStore().store });
  assert.deepEqual(r, { ok: false, reason: "disabled" });
});

test("tâche : sortie invalide journalisée, pas mise en cache", async () => {
  const { client } = fakeClient(() => reply('{"label":1}'));
  const s = fakeStore();
  const r = await runTask(task, "vélo", { client, store: s.store });
  assert.deepEqual(r, { ok: false, reason: "invalid_output" });
  assert.equal(s.cache.size, 0);
  assert.equal(s.logs[0].status, "invalid_output");
});

test("tâche : un cache corrompu est ignoré", async () => {
  const { client, calls } = fakeClient(() => reply('{"label":"velo","confidence":0.9}'));
  const s = fakeStore();
  s.cache.set(cacheHash(task as AiTask<unknown, unknown>, normalizeForCache("vélo")), { label: 42 });
  const r = await runTask(task, "vélo", { client, store: s.store });
  assert.ok(r.ok && r.source === "ai");
  assert.equal(calls.length, 1);
});

test("mode simulé : aucune requête, même validation", async () => {
  const { client, calls } = fakeClient(() => reply("{}"));
  const s = fakeStore();
  const r = await runTask(task, "vélo au bureau", { client, store: s.store, mock: true });
  assert.ok(r.ok && r.source === "mock" && r.data.label === "velo");
  assert.equal(calls.length, 0);
  assert.equal(s.logs[0].status, "mock");
});

test("minimisation : e-mails, téléphones, liens et numéros retirés, km conservés", () => {
  const t = redact("vélo 8 km avec marie.dupont@acme.fr, tel 06 12 34 56 78, billet 1234 5678 9012 https://sncf.fr/x");
  assert.ok(t.includes("8 km"));
  assert.ok(!t.includes("acme.fr") && !t.includes("06 12") && !t.includes("9012") && !t.includes("sncf.fr"));
  assert.equal(redact("x".repeat(500)).length, 300);
  assert.equal(normalizeForCache("  Vélo  8 KM !! "), "vélo 8 km");
});
