import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFootprint, type BilanAnswers } from "./footprint.ts";
import { TEMPLATES, templateEligibility, unitImpact } from "./challenges.ts";
import { actionPlan } from "./plan.ts";
import { currentStreak, headStartKgWeek, headStartKgYear, keptHabits, levelFor, nextStreakMilestone, remainingBigItems, weekStart } from "./engagement.ts";

const near = (a: number, b: number, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

// Mêmes habitudes que Gabriel dans scenario.sql : voiture seul 6 km, bœuf 4 fois, 15 vêtements.
const gabriel: BilanAnswers = {
  commuteMode: "voiture_seul", commuteKm: 6, commuteDaysPerWeek: 5, carType: "thermique", carOtherKmYear: 5000,
  shortFlightsYear: 0, longFlightsYear: 0, beefMealsWeek: 4, otherMeatMealsWeek: 1, heating: "gaz",
  surfaceM2: 45, householdSize: 1, newClothesYear: 15, phoneEveryYears: 3, newDevicesYear: 0,
};

// Profil déjà engagé : vélo, végétarien, pas d'avion, reconditionné, mais un vol long-courrier par an.
const engaged: BilanAnswers = {
  ...gabriel, commuteMode: "velo", commuteKm: 5, beefMealsWeek: 0, otherMeatMealsWeek: 0, newClothesYear: 2,
  phoneEveryYears: 0, heating: "pompe_a_chaleur", longFlightsYear: 1, newDevicesYear: 1,
};

test("habitudes à garder : mêmes règles que kept_habits (SQL)", () => {
  assert.deepEqual(keptHabits(computeFootprint(gabriel).habits).map((k) => k.key), ["repas_vege", "sans_avion"]);
  const h = computeFootprint(engaged).habits;
  assert.deepEqual(keptHabits(h).map((k) => k.key), ["trajet_doux", "repas_vege", "peu_de_neuf", "telephone_garde"]);
  // 5 km × 2 × 5 jours = 50 km comparés à la voiture (5,53 kg) + 14 repas × 0,673 (9,43 kg)
  near(headStartKgWeek(h), 50 * 0.1106 + 14 * (1.5233 - 0.85), 0.02);
  near(headStartKgYear(h), 50 * 0.1106 * 45 + 14 * (1.5233 - 0.85) * 52, 0.5);
});

test("défis expert proposés au profil engagé, pas les défis du quotidien", () => {
  const h = computeFootprint(engaged).habits;
  const eligible = TEMPLATES.filter((t) => templateEligibility(t, h).eligible).map((t) => t.id).sort();
  assert.deepEqual(eligible, ["chauffage", "occasion", "reparation", "vacances_train", "vegetalien"]);
  near(unitImpact("vacances_train", "base", h).kg, 12000 * 0.1665 - 2000 * 0.0023);
  near(unitImpact("reparation", "ordinateur", h).kg, 193);
  assert.equal(unitImpact("reparation", "smartphone", h).eligible, false);
  near(unitImpact("vegetalien", "base", h).kg, 0.31);
  // Le plan met en tête le plus gros poste restant : l'avion.
  assert.equal(actionPlan(h)[0].templateId, "vacances_train");
  assert.equal(remainingBigItems(h)[0].key, "avion");
});

test("semaines : lundi et série en cours", () => {
  assert.equal(weekStart("2026-10-17"), "2026-10-12"); // samedi → lundi
  assert.equal(weekStart("2026-10-12"), "2026-10-12");
  assert.equal(currentStreak(["2026-10-12", "2026-10-05", "2026-09-28", "2026-09-14"], "2026-10-17"), 3);
  // Semaine en cours pas encore faite : la série de la semaine passée compte encore.
  assert.equal(currentStreak(["2026-10-05", "2026-09-28"], "2026-10-14"), 2);
  assert.equal(currentStreak(["2026-09-28"], "2026-10-14"), 0);
});

test("niveaux : la plante grandit avec les pousses", () => {
  assert.equal(levelFor(0).name, "Graine");
  assert.deepEqual(levelFor(20).next, { name: "Germe", min: 50, missing: 30 });
  near(levelFor(20).progress, 0.4);
  assert.equal(levelFor(150).name, "Pousse");
  assert.equal(levelFor(5000).name, "Forêt");
  assert.equal(levelFor(5000).next, null);
  assert.equal(levelFor(5000).progress, 1);
});

test("séries : prochain palier", () => {
  assert.deepEqual(nextStreakMilestone(0), { days: 3, pousses: 10 });
  assert.deepEqual(nextStreakMilestone(7), { days: 14, pousses: 50 });
  assert.equal(nextStreakMilestone(30), null);
});
