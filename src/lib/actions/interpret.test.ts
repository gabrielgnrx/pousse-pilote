import { test } from "node:test";
import assert from "node:assert/strict";
import { candidatesFor, convertQuantity, interpretItems, parsePhrase, ruleParse, type ParsedItem } from "./interpret.ts";
import { ACTION_BY_SLUG } from "../co2/engine.ts";
import { TRANSPORT_KG_PER_KM } from "../co2/factors.ts";
import type { Habits } from "../co2/footprint.ts";

const h: Habits = {
  commuteMode: "voiture_seul",
  commuteKm: 12,
  commuteDaysPerWeek: 3,
  beefMealsWeek: 3,
  otherMeatMealsWeek: 4,
  shortFlightsYear: 1,
  longFlightsYear: 0,
  newClothesYear: 10,
  buysNewPhone: true,
  newDevicesYear: 0,
  heating: "gaz",
  heatingKgYear: 1200,
  bottledWaterLDay: 0,
};

const item = (action: string, quantity: number | null, unit = "", confidence = 0.95): ParsedItem => ({ action, quantity, unit, confidence });

test("règle simple : « vélo jusqu'au bureau ce matin, 8 km »", () => {
  assert.deepEqual(ruleParse("vélo jusqu'au bureau ce matin, 8 km"), [item("velo", 8, "km", 0.9)]);
  assert.deepEqual(ruleParse("Télétravail aujourd'hui"), [item("teletravail", null, "", 0.9)]);
});

test("règle simple : dans le doute, rien (plusieurs gestes, plusieurs nombres, inconnu)", () => {
  assert.equal(ruleParse("vélo 8 km puis déjeuner végé"), null);
  assert.equal(ruleParse("vélo 8 km aller et 9 km retour"), null);
  assert.equal(ruleParse("j'ai fait un truc bien"), null);
  assert.equal(ruleParse("vélo 2 repas"), null);
});

test("phrase à plusieurs gestes : découpée, chaque morceau reconnu seul", () => {
  assert.deepEqual(parsePhrase("vélo 8 km puis déjeuner végé"), [item("velo", 8, "km", 0.9), item(ruleParse("déjeuner végé")![0].action, null, "", 0.9)]);
  assert.deepEqual(parsePhrase("vélo jusqu'au bureau ce matin, 8 km"), [item("velo", 8, "km", 0.9)]);
  assert.equal(parsePhrase("télétravail et déjeuner végé")?.length, 2);
});

test("phrase à plusieurs gestes : un morceau ambigu rend tout ambigu (on ne devine pas)", () => {
  assert.equal(parsePhrase("vélo 8 km aller et 9 km retour"), null);
  assert.equal(parsePhrase("j'ai fait un truc bien et un autre"), null);
  assert.deepEqual(parsePhrase("vélo"), ruleParse("vélo"));
});

test("cartes : quantité convertie, aperçu du CO₂ calculé par le moteur", () => {
  const [c] = interpretItems([item("velo", 8, "km")], "vélo 8 km", h);
  assert.equal(c.quantity, 8);
  assert.equal(c.previewKg, Math.round(8 * TRANSPORT_KG_PER_KM.voiture_thermique * 1000) / 1000);
  assert.equal(c.needsChoice, null);
  assert.equal(c.fromBilan, false);
  const [m] = interpretItems([item("velo", 800, "m")], "vélo 800 m", h);
  assert.equal(m.quantity, 0.8);
});

test("cartes : confiance faible → choix explicite, avec des actions proches", () => {
  const [c] = interpretItems([item("vege_autre", 1, "repas", 0.4)], "déjeuner végé à la cantine", h);
  assert.equal(c.needsChoice, "low_confidence");
  assert.equal(c.candidates[0], "vege_autre");
  assert.ok(c.candidates.length >= 1);
});

test("cartes : action inconnue → meilleure proposition à choisir, jamais enregistrée d'office", () => {
  const [c] = interpretItems([item("inconnu", null)], "trajet en vélotaf", h);
  assert.equal(c.slug, "velo");
  assert.equal(c.needsChoice, "unknown_action");
  assert.deepEqual(interpretItems([item("inconnu", null)], "rien à voir", h), []);
});

test("cartes : unité incohérente ou quantité hors bornes → quantité à saisir", () => {
  const [u] = interpretItems([item("vege_boeuf", 8, "km")], "végé 8 km", h);
  assert.equal(u.needsChoice, "unit_mismatch");
  assert.equal(u.quantity, null);
  const [o] = interpretItems([item("vege_boeuf", 5, "repas")], "5 repas végé", h);
  assert.equal(o.needsChoice, "quantity_out_of_range");
  assert.equal(o.quantity, null);
});

test("cartes : trajet sans distance → trajet déclaré, signalé comme tel ; km plafonnés", () => {
  const [c] = interpretItems([item("velo", null)], "vélo au bureau", h);
  assert.equal(c.quantity, 12);
  assert.equal(c.fromBilan, true);
  const [big] = interpretItems([item("velo", 30, "km")], "vélo 30 km", h);
  assert.equal(big.quantity, 30);
  assert.equal(big.capped, true);
  assert.equal(big.previewKg, Math.round(12 * TRANSPORT_KG_PER_KM.voiture_thermique * 1000) / 1000);
});

test("cartes : confirmation demandée pour le train ; train sans distance → à saisir", () => {
  const [t] = interpretItems([item("train", null)], "train pour Lyon", h);
  assert.equal(t.needsConfirm, true);
  assert.equal(t.quantity, null);
});

test("cartes : plusieurs actions, sans doublon", () => {
  const cards = interpretItems([item("velo", 8, "km"), item("vege_autre", 1, "repas"), item("velo", 8, "km")], "vélo 8 km et végé", h);
  assert.deepEqual(cards.map((c) => c.slug), ["velo", "vege_autre"]);
});

test("unités : synonymes acceptés, conversions refusées quand elles n'ont pas de sens", () => {
  assert.equal(convertQuantity(ACTION_BY_SLUG.vege_autre, 2, "déjeuners"), 2);
  assert.equal(convertQuantity(ACTION_BY_SLUG.teletravail, 1, "journée"), 1);
  assert.equal(convertQuantity(ACTION_BY_SLUG.velo, 5, "kilomètres"), 5);
  assert.equal(convertQuantity(ACTION_BY_SLUG.velo, 5, "repas"), null);
  assert.equal(convertQuantity(ACTION_BY_SLUG.occasion_jean, 1, "km"), null);
});

test("propositions : les actions proches d'une saisie", () => {
  assert.equal(candidatesFor("j'ai pris le RER")[0], "transports");
  assert.equal(candidatesFor("acheté un jean en friperie")[0], "occasion_jean");
  assert.deepEqual(candidatesFor("blablabla"), []);
});
