import { test } from "node:test";
import assert from "node:assert/strict";
import { parseActionOutputSchema, parseActionTask, PARSE_ACTION_SYSTEM } from "./parse-action.ts";
import { runTask, type AiStore } from "../run.ts";
import { buildParams } from "../structured.ts";
import { ACTION_SLUGS } from "../../co2/action-types.data.ts";
import type { ApiMessage, MessagesClient } from "../types.ts";

const store: AiStore = {
  consume: async () => true,
  cacheGet: async () => null,
  cachePut: async () => undefined,
  log: async () => undefined,
};

const client = (json: unknown): MessagesClient => ({
  messages: {
    create: async (): Promise<ApiMessage> => ({
      content: [{ type: "text", text: JSON.stringify(json) }],
      stop_reason: "end_turn",
      usage: { input_tokens: 900, output_tokens: 60 },
    }),
  },
});

test("parse-action : une réponse conforme est acceptée", async () => {
  const r = await runTask(parseActionTask, "vélo 8 km puis déjeuner végé", {
    client: client({
      actions: [
        { action: "velo", quantity: 8, unit: "km", confidence: 0.96 },
        { action: "vege_autre", quantity: null, unit: "", confidence: 0.6 },
      ],
    }),
    store,
  });
  assert.ok(r.ok);
  assert.equal(r.data.actions.length, 2);
});

test("parse-action : un slug hors catalogue, une quantité négative ou trop d'actions sont rejetés", async () => {
  for (const bad of [
    { actions: [{ action: "fusee", quantity: 1, unit: "", confidence: 0.9 }] },
    { actions: [{ action: "velo", quantity: -3, unit: "km", confidence: 0.9 }] },
    { actions: [{ action: "velo", quantity: 3, unit: "km", confidence: 1.4 }] },
    { actions: Array.from({ length: 4 }, () => ({ action: "velo", quantity: 3, unit: "km", confidence: 0.9 })) },
    { actions: [{ action: "velo", quantity: 3, unit: "km", confidence: 0.9, co2_kg: 12 }] },
  ]) {
    const r = await runTask(parseActionTask, "x", { client: client(bad), store });
    if (bad.actions[0] && "co2_kg" in bad.actions[0]) {
      // zod retire les champs inconnus : un CO₂ inventé par l'IA ne passe jamais.
      assert.ok(r.ok);
      assert.equal("co2_kg" in r.data.actions[0], false);
    } else {
      assert.deepEqual(r, { ok: false, reason: "invalid_output" });
    }
  }
});

test("parse-action : le schéma envoyé à l'API contient la liste fermée des actions", () => {
  const p = buildParams({
    model: parseActionTask.model,
    effort: parseActionTask.effort,
    system: parseActionTask.system,
    user: "x",
    jsonSchema: parseActionTask.jsonSchema,
    maxTokens: parseActionTask.maxTokens,
    cacheSystem: true,
  });
  const json = JSON.stringify(p.output_config?.format?.schema);
  for (const slug of ACTION_SLUGS) assert.ok(json.includes(`"${slug}"`), slug);
  assert.ok(json.includes('"inconnu"'));
  assert.ok(!json.includes("minimum") && !json.includes("maximum"));
  assert.equal(p.model, "claude-haiku-5-5");
  assert.ok(Array.isArray(p.system));
});

test("parse-action : le prompt interdit de calculer et de compléter une quantité", () => {
  assert.match(PARSE_ACTION_SYSTEM, /Ne calcule jamais de CO₂/);
  assert.match(PARSE_ACTION_SYSTEM, /quantity vaut null/);
  for (const slug of ACTION_SLUGS) assert.ok(PARSE_ACTION_SYSTEM.includes(`- ${slug} :`), slug);
});

test("parse-action : la saisie est minimisée avant envoi", () => {
  const u = parseActionTask.user("vélo 8 km, écris-moi à jean@acme.fr");
  assert.equal(typeof u, "string");
  assert.ok(!(u as string).includes("acme.fr"));
});

test("parse-action : le mode simulé produit des sorties valides", () => {
  for (const t of ["vélo 8 km", "déjeuner végé à la cantine", "rien du tout"]) {
    assert.ok(parseActionOutputSchema.safeParse(parseActionTask.mock!(t)).success, t);
  }
});
