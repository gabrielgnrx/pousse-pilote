import { test } from "node:test";
import assert from "node:assert/strict";
import { composeMessage } from "./compose.ts";
import { factsFor } from "./facts.ts";
import type { AiStore } from "../ai/run.ts";
import type { MessagesClient } from "../ai/types.ts";

const store: AiStore = { consume: async () => true, cacheGet: async () => null, cachePut: async () => undefined, log: async () => undefined };
const client = (message: string): MessagesClient => ({
  messages: { create: async () => ({ content: [{ type: "text", text: JSON.stringify({ message }) }], stop_reason: "end_turn", usage: { input_tokens: 400, output_tokens: 80 } }) },
});
const friday = factsFor({ team_id: "t", company_id: "c", slot: "friday", ref: "", context: { kg: 30, actions: 20, publishers: ["Léa"] } });

test("animateur : le texte de l'IA, avec les prénoms réinjectés par le code", async () => {
  const r = await composeMessage(friday, { client: client("Belle semaine l'équipe, 30 kg évités ! Bravo {{prenom_1}} pour tes partages."), store });
  assert.equal(r.source, "ia");
  assert.match(r.text, /Bravo Léa pour tes partages/);
});

test("animateur : marqueur oublié ou inventé → gabarit", async () => {
  const oublie = await composeMessage(friday, { client: client("Belle semaine l'équipe, 30 kg évités, bravo à tous !"), store });
  assert.equal(oublie.source, "gabarit");
  const invente = await composeMessage(friday, { client: client("Bravo {{prenom_1}} et {{prenom_2}}, quelle semaine !"), store });
  assert.equal(invente.source, "gabarit");
  assert.match(invente.text, /Léa/);
});

test("animateur : IA indisponible → gabarit, toujours sous 500 caractères", async () => {
  const r = await composeMessage(friday, { client: null, store });
  assert.equal(r.source, "gabarit");
  assert.ok(r.text.length <= 500 && r.text.length > 20);
});
