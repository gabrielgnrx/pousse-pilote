import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFootprint, type BilanAnswers } from "./footprint.ts";
import { TEMPLATES, templateEligibility, unitImpact } from "./challenges.ts";
import { actionPlan } from "./plan.ts";

const gabriel: BilanAnswers = {
  commuteMode: "voiture_seul",
  commuteKm: 6,
  commuteDaysPerWeek: 5,
  carType: "thermique",
  carOtherKmYear: 5000,
  shortFlightsYear: 0,
  longFlightsYear: 0,
  beefMealsWeek: 4,
  otherMeatMealsWeek: 1,
  heating: "gaz",
  surfaceM2: 45,
  householdSize: 1,
  newClothesYear: 15,
  phoneEveryYears: 3,
  newDevicesYear: 0,
  bottledWaterLDay: 0,
};

const near = (a: number, b: number, eps = 0.01) =>
  assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

test("bilan : postes calculés avec les facteurs ADEME", () => {
  const f = computeFootprint(gabriel);
  // 6 km × 2 × 5 j × 45 sem × 0,1106 + 5 000 km × 0,1106
  assert.equal(f.byCategory.transport, Math.round(298.62 + 553));
  // 52 × (4 × 4,97 + 1 × 1,5233 + 9 × 0,85)
  assert.equal(f.byCategory.alimentation, Math.round(52 * (19.88 + 1.52333 + 7.65)));
  // 45 m² × 17,84 kg/m²
  assert.equal(f.byCategory.logement, Math.round(45 * 17.84));
  // 15 × 13,2 + 80,2 / 3
  assert.equal(f.byCategory.consommation, Math.round(198 + 26.7333));
  assert.equal(f.byCategory.services, 1000);
  assert.equal(
    f.totalKg,
    Object.values(f.byCategory).reduce((s, v) => s + v, 0),
  );
});

test("bilan : réponses absurdes bornées", () => {
  const f = computeFootprint({ ...gabriel, beefMealsWeek: 99, otherMeatMealsWeek: 99, commuteKm: -5 });
  assert.equal(f.habits.beefMealsWeek, 14);
  assert.equal(f.habits.otherMeatMealsWeek, 0);
  assert.equal(f.habits.commuteKm, 0);
});

test("défis : gains par unité", () => {
  const h = computeFootprint(gabriel).habits;
  near(unitImpact("velo", "base", h).kg, 0.6636);
  near(unitImpact("transports", "base", h).kg, 6 * (0.1106 - 0.0054));
  near(unitImpact("covoiturage", "base", h).kg, 0.3318);
  near(unitImpact("vege", "boeuf", h).kg, 4.12);
  near(unitImpact("vege", "autre", h).kg, 0.6733);
  near(unitImpact("moins_boeuf", "base", h).kg, 3.4467);
  near(unitImpact("occasion", "jean", h).kg, 25.1);
  near(unitImpact("chauffage", "base", h).kg, (803 * 0.07) / 30);
});

test("défis : rien n'est compté sans habitude remplacée", () => {
  const cyclist = computeFootprint({
    ...gabriel,
    commuteMode: "velo",
    beefMealsWeek: 0,
    otherMeatMealsWeek: 0,
    newClothesYear: 0,
  }).habits;
  for (const id of ["velo", "transports", "covoiturage", "moins_boeuf", "train"]) {
    const r = unitImpact(id, id === "train" ? "500" : "base", cyclist);
    assert.equal(r.eligible, false, id);
    assert.equal(r.kg, 0, id);
  }
  assert.equal(unitImpact("vege", "boeuf", cyclist).eligible, false);
  assert.equal(unitImpact("occasion", "jean", cyclist).eligible, false);
});

test("défis : éligibilité par modèle", () => {
  const h = computeFootprint(gabriel).habits;
  const eligible = TEMPLATES.filter((t) => templateEligibility(t, h).eligible).map((t) => t.id);
  assert.deepEqual(eligible.sort(), [
    "chauffage",
    "covoiturage",
    "moins_boeuf",
    "occasion",
    "reparation",
    "teletravail",
    "transports",
    "vege",
    "vegetalien",
    "velo",
  ]);
});

test("télétravail et eau du robinet : calculés depuis le bilan", () => {
  const h = computeFootprint(gabriel).habits;
  const tele = unitImpact("teletravail", "base", h);
  const velo = unitImpact("velo", "base", h);
  assert.equal(tele.kg, 2 * velo.kg, "un jour de télétravail = l'aller et le retour");
  assert.equal(unitImpact("eau_robinet", "base", { ...h, bottledWaterLDay: 0 }).eligible, false);
  assert.equal(unitImpact("eau_robinet", "base", { ...h, bottledWaterLDay: 1.5 }).kg, 1.5 * 0.32);
  const withWater = computeFootprint({ ...gabriel, bottledWaterLDay: 1 });
  assert.equal(
    withWater.byCategory.alimentation - computeFootprint(gabriel).byCategory.alimentation,
    Math.round(365 * 0.32),
    "1 L par jour : 117 kg par an",
  );
});

test("plan d'action : trié par impact, seulement des habitudes déclarées", () => {
  const h = computeFootprint(gabriel).habits;
  const plan = actionPlan(h);
  assert.equal(plan[0].templateId, "vege");
  near(plan[0].kgYear, 4 * 52 * 4.12, 0.1); // ≈ 857 kg
  for (let i = 1; i < plan.length; i++) assert.ok(plan[i - 1].kgYear >= plan[i].kgYear);
  assert.ok(!plan.some((p) => p.templateId === "train"), "pas de train sans vol déclaré");
  const velo = plan.find((p) => p.templateId === "velo")!;
  near(velo.kgYear, 270 * 0.6636, 0.1); // 3 jours × 2 × 45 semaines
});
