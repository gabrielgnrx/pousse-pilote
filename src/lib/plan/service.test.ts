import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlan, parseInputs } from "./service.ts";
import { rankCandidates } from "./weekly.ts";
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
test("plan : les défis classés par les règles, 3 au plus, chacun avec sa phrase", () => {
  const plan = buildPlan(h, {}, week);
  assert.ok(plan);
  assert.equal(plan.length, 3);
  assert.deepEqual(plan.map((e) => e.template_id), rankCandidates(h, {}, week).slice(0, 3).map((c) => c.templateId));
  assert.ok(plan.every((e) => e.reason.length > 0));
});

test("entrées venues de la base : tout ce qui est inattendu est ignoré", () => {
  const r = parseInputs({ feasibility: { velo: "facile", vege: "peut-être", x: 3 }, stats: { counts: { velo: "4", y: "abc" }, abandoned: ["vege", 5], active: "non" } });
  assert.deepEqual(r.feasibility, { velo: "facile" });
  assert.deepEqual(r.week, { counts: { velo: 4 }, abandoned: ["vege"], active: [] });
  assert.deepEqual(parseInputs(null), { feasibility: {}, week: { counts: {}, abandoned: [], active: [] } });
});
