import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { ACTION_BY_SLUG, checkCaps, computeAvoided, roundKg, weeklyCap, windowCap, type AvoidedResult } from "./engine.ts";
import { ACTION_TYPES } from "./action-types.data.ts";
import { FACTOR_DATA } from "./factors.data.ts";
import { MEAL_KG, TRANSPORT_KG_PER_KM, factor } from "./factors.ts";
import { TEMPLATE_BY_ID } from "./challenges.ts";
import type { Habits } from "./footprint.ts";

const car: Habits = {
  commuteMode: "voiture_seul",
  commuteKm: 10,
  commuteDaysPerWeek: 3,
  beefMealsWeek: 3,
  otherMeatMealsWeek: 4,
  shortFlightsYear: 2,
  longFlightsYear: 1,
  newClothesYear: 10,
  buysNewPhone: true,
  newDevicesYear: 1,
  heating: "gaz",
  heatingKgYear: 1200,
  bottledWaterLDay: 1,
};
const sober: Habits = {
  ...car,
  commuteMode: "velo",
  beefMealsWeek: 0,
  otherMeatMealsWeek: 0,
  shortFlightsYear: 0,
  longFlightsYear: 0,
};

function ok(slug: string, q: number | null, h: Habits): AvoidedResult {
  const r = computeAvoided(slug, q, h);
  assert.ok(r.ok, `calcul refusé pour ${slug}`);
  return r;
}

test("vélo : km saisis × facteur de la voiture déclarée", () => {
  const r = ok("velo", 8, car);
  assert.equal(r.kg, roundKg(8 * TRANSPORT_KG_PER_KM.voiture_thermique));
  assert.equal(r.kg, 0.885);
  assert.equal(r.units, 1);
  assert.equal(r.capped, false);
});

test("vélo : quantité absente = trajet déclaré", () => {
  assert.equal(ok("velo", null, car).kg, roundKg(10 * TRANSPORT_KG_PER_KM.voiture_thermique));
});

test("plafond anti-triche : les km sont plafonnés au trajet déclaré", () => {
  const r = ok("velo", 25, car);
  assert.equal(r.capped, true);
  assert.equal(r.quantity, 10);
  assert.equal(r.kg, ok("velo", 10, car).kg);
});

test("référence personnelle : déjà à vélo, un trajet à vélo évite 0 kg", () => {
  const r = ok("velo", 8, sober);
  assert.equal(r.kg, 0);
  assert.match(r.reason ?? "", /n'émet déjà rien/);
});

test("transports au lieu de la voiture : différence avec la moyenne métro / RER", () => {
  const transit = (TRANSPORT_KG_PER_KM.metro + TRANSPORT_KG_PER_KM.rer) / 2;
  assert.equal(ok("transports", 10, car).kg, roundKg(10 * (TRANSPORT_KG_PER_KM.voiture_thermique - transit)));
});

test("covoiturage : la moitié du trajet en voiture", () => {
  assert.equal(ok("covoiturage", 10, car).kg, roundKg((10 * TRANSPORT_KG_PER_KM.voiture_thermique) / 2));
  assert.equal(ok("covoiturage", 10, sober).kg, 0);
});

test("repas : la quantité compte en unités (2 repas = 2 unités, 2 × l'écart)", () => {
  const r = ok("vege_boeuf", 2, car);
  assert.equal(r.units, 2);
  assert.equal(r.kg, roundKg(2 * (MEAL_KG.boeuf - MEAL_KG.vegetarien)));
});

test("unités : une quantité hors bornes ou décimale est refusée, jamais devinée", () => {
  assert.deepEqual(computeAvoided("vege_boeuf", 3, car), { ok: false, error: "quantity_out_of_range" });
  assert.deepEqual(computeAvoided("vege_boeuf", 1.5, car), { ok: false, error: "quantity_out_of_range" });
  assert.deepEqual(computeAvoided("velo", 0, car), { ok: false, error: "quantity_out_of_range" });
  assert.deepEqual(computeAvoided("velo", 120, car), { ok: false, error: "quantity_out_of_range" });
  assert.deepEqual(computeAvoided("velo", Number.NaN, car), { ok: false, error: "quantity_out_of_range" });
  assert.deepEqual(computeAvoided("fusee", 1, car), { ok: false, error: "unknown_action" });
});

test("train : km saisis × (avion court − TGV), seulement avec un vol court déclaré", () => {
  assert.equal(ok("train", 500, car).kg, roundKg(500 * (TRANSPORT_KG_PER_KM.avion_court - TRANSPORT_KG_PER_KM.tgv)));
  assert.equal(ok("train", 500, sober).kg, 0);
});

test("petits gestes : 0 kg, avec une raison", () => {
  const r = ok("escaliers", 1, car);
  assert.equal(r.kg, 0);
  assert.ok(r.reason);
});

test("arrondis au gramme, comme round(x, 3) en base", () => {
  assert.equal(roundKg(0.0004), 0);
  assert.equal(roundKg(0.0005), 0.001);
  assert.equal(roundKg(1.23456), 1.235);
  assert.equal(roundKg(110.95), 110.95);
});

test("plafonds : 2 trajets par jour, partagés", () => {
  assert.equal(checkCaps("velo", 1, { usedInWindow: 1, usedThisWeek: 1 }, car), null);
  assert.equal(checkCaps("velo", 1, { usedInWindow: 2, usedThisWeek: 2 }, car), "cap_reached");
});

test("plafonds : la semaine est calée sur les jours de bureau déclarés", () => {
  assert.equal(weeklyCap("velo", car), 6);
  assert.equal(checkCaps("transports", 1, { usedInWindow: 0, usedThisWeek: 6 }, car), "week_cap_reached");
  assert.equal(weeklyCap("velo", { ...car, commuteDaysPerWeek: 0 }), 2);
  assert.equal(weeklyCap("teletravail", car), 5);
  assert.equal(weeklyCap("vege", car), null);
});

test("plafonds : plusieurs unités d'un coup comptent toutes", () => {
  assert.equal(checkCaps("vege", 2, { usedInWindow: 1, usedThisWeek: 1 }, car), "cap_reached");
  assert.equal(checkCaps("vege", 2, { usedInWindow: 0, usedThisWeek: 9 }, car), null);
});

test("plafonds : réparation et vacances en train sur 7 jours", () => {
  assert.deepEqual(windowCap("reparation"), { units: 1, days: 7 });
  assert.deepEqual(windowCap("vacances_train"), { units: 1, days: 7 });
});

test("catalogue : chaque action est reliée à un défi et à des facteurs existants", () => {
  for (const a of ACTION_TYPES) {
    const t = TEMPLATE_BY_ID[a.template];
    assert.ok(t, `${a.slug} : défi ${a.template} inconnu`);
    for (const f of a.factors) assert.ok(f in FACTOR_DATA, `${a.slug} : facteur ${f} inconnu`);
    if (a.referenceRule !== "aucun") assert.ok(a.factors.length > 0, `${a.slug} : aucun facteur`);
    if (a.kind === "count") assert.ok(a.max <= t.dailyCap, `${a.slug} : max au-dessus du plafond du jour`);
    assert.equal(ACTION_BY_SLUG[a.slug], a);
  }
});

test("facteurs : chaque valeur est sourcée et positive", () => {
  for (const [slug, f] of Object.entries(FACTOR_DATA)) {
    assert.ok(["base_empreinte", "agribalyse", "nos_gestes_climat"].includes(f.source), slug);
    if (f.kg !== null) assert.ok(f.kg >= 0, slug);
  }
  assert.equal(factor("voiture_thermique"), 0.1106);
});

test("fichiers générés (facteurs, catalogue, migrations) à jour", () => {
  execFileSync(process.execPath, ["scripts/generate-factors.ts", "--check"], { stdio: "pipe" });
});

test("scénario SQL de parité TypeScript / base à jour", () => {
  execFileSync(process.execPath, ["scripts/generate-parity.ts", "--check"], { stdio: "pipe" });
});
