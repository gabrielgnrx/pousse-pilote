import { test } from "node:test";
import assert from "node:assert/strict";
import { factsFor, fallbackMessage, fillNames, type Due } from "./facts.ts";
import { goodForBike, parseForecast } from "./weather.ts";

const due = (slot: Due["slot"], context: Record<string, unknown>): Due => ({ team_id: "t", company_id: "c", slot, ref: "", context });

test("vendredi : les prénoms ne partent pas dans les faits, seulement des marqueurs", () => {
  const f = factsFor(due("friday", { kg: 42.5, actions: 31, top: ["velo", "vege"], publishers: ["Léa", "Malik"], rank: { rank: 2, teams: 3 }, rank_monday: { rank: 3 } }));
  const text = f.lines.join("\n");
  assert.ok(!text.includes("Léa") && !text.includes("Malik"));
  assert.match(text, /\{\{prenom_1\}\}, \{\{prenom_2\}\}/);
  assert.match(text, /2e sur 3, en progrès \(3e lundi\)/);
  assert.match(text, /43 kg de CO₂|42,5 kg/);
  assert.deepEqual(f.names, ["Léa", "Malik"]);
});

test("vendredi sans publication : personne n'est nommé", () => {
  const f = factsFor(due("friday", { kg: 10, actions: 5, publishers: [] }));
  const msg = fallbackMessage(f);
  assert.ok(!/\{\{/.test(msg));
  assert.ok(msg.length <= 500);
});

test("marqueurs : réinjectés, et retirés s'ils ne correspondent à personne", () => {
  assert.equal(fillNames("Bravo {{prenom_1}} et {{prenom_2}} !", ["Léa", "Malik"]), "Bravo Léa et Malik !");
  assert.equal(fillNames("Bravo {{prenom_3}} !", ["Léa"]), "Bravo !");
});

test("faits : les données inattendues sont ignorées", () => {
  const f = factsFor(due("vote_open", { options: ["repas", "pirate", 3], last_week: { actions: "abc" } }));
  assert.match(f.lines.join(" "), /repas végé/);
  assert.ok(!f.lines.join(" ").includes("pirate"));
});

test("relance du mercredi : bienveillante, jamais culpabilisante", () => {
  const msg = fallbackMessage(factsFor(due("midweek", { this_week: 2, last_week: 9 })));
  assert.ok(!/(honte|nul|décevant|pas assez)/i.test(msg));
  assert.match(msg, /repart/);
});

test("météo : vélo seulement s'il fait beau, sec et doux", () => {
  assert.equal(goodForBike({ date: "d", tempMax: 18, precipitationProbability: 5, weatherCode: 1 }), true);
  assert.equal(goodForBike({ date: "d", tempMax: 18, precipitationProbability: 60, weatherCode: 61 }), false);
  assert.equal(goodForBike({ date: "d", tempMax: 4, precipitationProbability: 0, weatherCode: 0 }), false);
  assert.equal(goodForBike({ date: "d", tempMax: 33, precipitationProbability: 0, weatherCode: 0 }), false);
});

test("météo : lecture de la prévision Open-Meteo, robuste aux réponses incomplètes", () => {
  const json = { daily: { time: ["2026-10-27", "2026-10-28"], temperature_2m_max: [15, 12], precipitation_probability_max: [10, 80], weather_code: [2, 63] } };
  assert.deepEqual(parseForecast(json, "2026-10-28"), { date: "2026-10-28", tempMax: 12, precipitationProbability: 80, weatherCode: 63 });
  assert.equal(parseForecast(json, "2026-11-01"), null);
  assert.equal(parseForecast({}, "2026-10-28"), null);
});
