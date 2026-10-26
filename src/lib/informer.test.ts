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

test("bouton + : 16 actions générales, le CO₂ vient du bilan", () => {
  const items = actionItems(h);
  assert.equal(items.length, 16);
  assert.equal(new Set(items.map((i) => i.key)).size, 16, "une seule ligne par action");
  assert.ok(!items.some((i) => i.templateId.startsWith("appli_")), "plus d'action « via une appli »");
  assert.ok(["train", "vacances_train", "reparation"].every((id) => items.find((i) => i.templateId === id)?.requiresConfirm), "grosses actions : sur l'honneur");
  const clothes = items.find((i) => i.templateId === "occasion")!;
  assert.equal(clothes.pick, "items");
  assert.deepEqual(clothes.choices?.map((c) => c.variant), ["tshirt", "chemise", "chaussures", "jean", "pull", "manteau"]);
  assert.equal(clothes.choices?.find((c) => c.variant === "jean")?.kg, unitImpact("occasion", "jean", h).kg, "chaque vêtement garde son facteur");
  assert.equal(clothes.kg, unitImpact("occasion", "tshirt", h).kg, "affiché : à partir du moins émetteur");
  assert.equal(items.find((i) => i.templateId === "train")?.pick, "distance");
  assert.equal(items.find((i) => i.key === "velo:base")?.kg, 10 * 0.1106);
  assert.equal(items.find((i) => i.templateId === "train")?.kg, 0, "aucun vol déclaré : 0 kg");
  // Repas végé : repas habituel du bilan (2 bœuf, 4 autres viandes), pondéré.
  const vege = items.find((i) => i.key === "vege:repas")!;
  const expected = (2 * unitImpact("vege", "boeuf", h).kg + 4 * unitImpact("vege", "autre", h).kg) / 6;
  assert.ok(Math.abs(vege.kg - expected) < 1e-9, "végé pondéré par les repas déclarés");
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
