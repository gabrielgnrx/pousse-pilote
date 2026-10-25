import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlan, parseInputs } from "./service.ts";
import { planCoachTask, planCoachUser, PLAN_COACH_SYSTEM } from "../ai/prompts/plan-coach.ts";
import { rankCandidates } from "./weekly.ts";
import type { AiStore } from "../ai/run.ts";
import type { MessagesClient } from "../ai/types.ts";
import type { Habits } from "../co2/footprint.ts";

const h: Habits = {
  commuteMode: "voiture_seul",
  commuteKm: 15,
  commuteDaysPerWeek: 4,
  beefMealsWeek: 4,
  otherMeatMealsWeek: 5,
  shortFlightsYear: 2,
  longFlightsYear: 0,
  newClothesYear: 20,
  buysNewPhone: false,
  newDevicesYear: 0,
  heating: "gaz",
  heatingKgYear: 1500,
  bottledWaterLDay: 0,
};
const week = { counts: {}, abandoned: [], active: [] };
const store: AiStore = { consume: async () => true, cacheGet: async () => null, cachePut: async () => undefined, log: async () => undefined };

function client(json: unknown) {
  let calls = 0;
  const c: MessagesClient = {
    messages: {
      create: async () => {
        calls++;
        return { content: [{ type: "text", text: JSON.stringify(json) }], stop_reason: "end_turn", usage: { input_tokens: 500, output_tokens: 120 } };
      },
    },
  };
  return { c, calls: () => calls };
}

test("plan avec coach : l'ordre et les phrases du coach, dans la liste des candidats", async () => {
  const pool = rankCandidates(h, {}, week);
  const { c } = client({ items: [{ template: pool[1].templateId, reason: "Tes 15 km en voiture : le vélo t'irait bien." }] });
  const plan = await buildPlan(h, {}, week, { client: c, store });
  assert.ok(plan);
  assert.equal(plan.source, "ia");
  assert.equal(plan.items[0].template_id, pool[1].templateId);
  assert.equal(plan.items.length, 3);
});

test("plan : coach indisponible ou réponse invalide → plan des règles", async () => {
  const { c } = client({ items: [{ template: "pas_un_defi", reason: "Inventé, refusé par le schéma." }] });
  const plan = await buildPlan(h, {}, week, { client: c, store });
  assert.equal(plan?.source, "regles");
  const none = await buildPlan(h, {}, week, { client: null, store });
  assert.equal(none?.source, "regles");
});

test("sobriété : personne inactive → pas d'appel au coach", async () => {
  const { c, calls } = client({ items: [] });
  const plan = await buildPlan(h, {}, week, { client: c, store }, false);
  assert.equal(plan?.source, "regles");
  assert.equal(calls(), 0);
});

test("entrées venues de la base : tout ce qui est inattendu est ignoré", () => {
  const r = parseInputs({ feasibility: { velo: "facile", vege: "peut-être", x: 3 }, stats: { counts: { velo: "4", y: "abc" }, abandoned: ["vege", 5], active: "non" } });
  assert.deepEqual(r.feasibility, { velo: "facile" });
  assert.deepEqual(r.week, { counts: { velo: 4 }, abandoned: ["vege"], active: [] });
  assert.deepEqual(parseInputs(null), { feasibility: {}, week: { counts: {}, abandoned: [], active: [] } });
});

test("coach : seules des données agrégées et anonymes partent dans le prompt", () => {
  const user = planCoachUser({ candidates: rankCandidates(h, { velo: "facile" }, week).slice(0, 6) });
  assert.match(user, /kg de CO₂ par an/);
  assert.ok(!/@|prénom|nom :/i.test(user));
  assert.match(PLAN_COACH_SYSTEM, /n'invente aucun autre chiffre/);
  assert.match(PLAN_COACH_SYSTEM, /Jamais culpabilisante/);
  assert.equal(planCoachTask.model, "writer");
});
