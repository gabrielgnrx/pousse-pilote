import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeCoachChoice, rankCandidates, rulePlan, signalFor, type LastWeek } from "./weekly.ts";
import { TEMPLATE_BY_ID } from "../co2/challenges.ts";
import { ACTION_TYPES } from "../co2/action-types.data.ts";
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
const empty: LastWeek = { counts: {}, abandoned: [], active: [] };

test("plan initial : trié par potentiel de CO₂, uniquement des défis du catalogue reliés à des facteurs", () => {
  const c = rankCandidates(h, {}, empty);
  assert.ok(c.length >= 3);
  for (const x of c) {
    assert.ok(TEMPLATE_BY_ID[x.templateId], x.templateId);
    const action = ACTION_TYPES.find((a) => a.template === x.templateId);
    assert.ok(action && action.factors.length > 0, `${x.templateId} sans facteur`);
    assert.ok(x.reason.length > 10);
  }
  // Paliers de potentiel : le premier est au moins aussi gros que les suivants du même signal.
  assert.ok(c[0].kgYear >= c[c.length - 1].kgYear);
});

test("faisabilité : à potentiel comparable, le défi facile passe devant ; l'impossible disparaît", () => {
  const base = rankCandidates(h, {}, empty);
  const first = base[0].templateId;
  const withImpossible = rankCandidates(h, { [first]: "impossible" }, empty);
  assert.ok(!withImpossible.some((x) => x.templateId === first));
  const easy = base.find((x, i) => i > 0 && Math.abs(x.kgYear - base[0].kgYear) < 1000 && (x.kgYear >= 200) === (base[0].kgYear >= 200));
  if (easy) {
    const ranked = rankCandidates(h, { [easy.templateId]: "facile", [first]: "difficile" }, empty);
    assert.equal(ranked[0].templateId, easy.templateId);
  }
});

test("semaine écoulée : un défi abandonné recule, une action régulière est « sur sa lancée »", () => {
  const base = rankCandidates(h, {}, empty);
  const top = base[0].templateId;
  const after = rankCandidates(h, {}, { counts: {}, abandoned: [top], active: [] });
  assert.notEqual(after[0].templateId, top);
  assert.equal(after.find((x) => x.templateId === top)?.signal, "abandonne");
  assert.equal(signalFor("vege", { counts: { vege: 4 }, abandoned: [], active: [] }), "sur_sa_lancee");
  const streak = rankCandidates(h, {}, { counts: { [top]: 5 }, abandoned: [], active: [] });
  assert.match(streak.find((x) => x.templateId === top)!.reason, /5 fois la semaine dernière/);
});

test("plan sans IA : les 3 premiers candidats, avec leurs phrases", () => {
  const plan = rulePlan(rankCandidates(h, {}, empty));
  assert.equal(plan.length, 3);
  assert.ok(plan.every((e) => e.reason && e.kg_year > 0));
});

test("coach : un défi hors liste est ignoré, le plan est complété par les règles", () => {
  const pool = rankCandidates(h, {}, empty).slice(0, 6);
  const plan = mergeCoachChoice(pool, [
    { template: "fusee_spatiale", reason: "Inventé par l'IA, refusé." },
    { template: pool[2].templateId, reason: "Tu fais déjà 15 km : le vélo électrique t'irait bien." },
    { template: pool[2].templateId, reason: "Doublon." },
  ]);
  assert.equal(plan.length, 3);
  assert.equal(plan[0].template_id, pool[2].templateId);
  assert.match(plan[0].reason, /vélo électrique/);
  assert.ok(!plan.some((e) => e.template_id === "fusee_spatiale"));
  assert.equal(new Set(plan.map((e) => e.template_id)).size, 3);
});

test("coach : une phrase vide ou trop courte est remplacée par celle des règles", () => {
  const pool = rankCandidates(h, {}, empty);
  const [e] = mergeCoachChoice(pool, [{ template: pool[0].templateId, reason: "ok" }], 1);
  assert.equal(e.reason, pool[0].reason);
});
