import { test } from "node:test";
import assert from "node:assert/strict";
import { GESTES, TEMPLATES, unitImpact } from "./co2/challenges.ts";
import { actionItems } from "./actions-catalog.ts";
import { DUOS, FICHES, RECETTES, recettesOfWeek } from "./informer.ts";
import { gesteOfWeek } from "./geste-semaine.ts";
import type { Habits } from "./co2/footprint.ts";

const h: Habits = {
  commuteMode: "voiture_seul",
  commuteKm: 10,
  commuteDaysPerWeek: 4,
  beefMealsWeek: 2,
  otherMeatMealsWeek: 4,
  shortFlightsYear: 0,
  longFlightsYear: 0,
  newClothesYear: 10,
  buysNewPhone: false,
  newDevicesYear: 0,
  heating: "gaz",
  heatingKgYear: 1000,
  bottledWaterLDay: 1,
};

test("bouton + : une ligne par variante, le CO₂ vient du bilan", () => {
  const items = actionItems(h);
  const n = [...TEMPLATES, ...GESTES].reduce((s, t) => s + t.variants.length, 0);
  assert.equal(items.length, n);
  assert.equal(items.find((i) => i.key === "velo:base")?.kg, 10 * 0.1106);
  assert.equal(items.find((i) => i.key === "train:500")?.kg, 0, "aucun vol déclaré : 0 kg");
  for (const g of GESTES) assert.equal(unitImpact(g.id, "base", h).kg, 0, `${g.id} : pas de CO₂ mesurable`);
});

test("S'informer : une fiche par geste, des duels qui ont un gagnant, des recettes qui tournent", () => {
  for (const t of [...TEMPLATES, ...GESTES]) assert.ok(FICHES[t.id], `fiche manquante : ${t.id}`);
  for (const d of DUOS) assert.notEqual(d.a.kg, d.b.kg);
  assert.equal(recettesOfWeek("2026-10-20").length, 3);
  assert.notDeepEqual(recettesOfWeek("2026-10-20"), recettesOfWeek("2026-10-27"));
  assert.ok(RECETTES.length >= 3);
});

test("geste de la semaine : lié au défi collectif quand il remplace une habitude", () => {
  assert.deepEqual(gesteOfWeek(h, "repas", "2026-10-20"), { id: "vege", linkedToGoal: true });
  assert.deepEqual(gesteOfWeek(h, "trajets", "2026-10-20"), { id: "velo", linkedToGoal: true });
  assert.equal(gesteOfWeek(h, "quiz", "2026-10-20").linkedToGoal, false);
});
