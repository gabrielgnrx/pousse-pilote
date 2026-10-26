import { test } from "node:test";
import assert from "node:assert/strict";
import { keyFigures, monthLabel, monthNarrative, parseReportData, pickQuotes } from "./report.ts";

const raw = {
  month: "2026-10", k: 5, participants: 42, active: 27, kg: 318.4, kg_previous: 250, actions: 512,
  by_poste: { mobilite: 210.2, alimentation: 98, consommation: null, energie: 10.2, pirate: 3 },
  top_actions: [{ template: "velo", count: 140, people: 18 }, { template: "inexistant", count: 3, people: 9 }],
  challenges_done: 12, teams: [{ name: "Data", members: 9, kg: 120 }], quotes: ["Trop bien ce défi, merci à tous !", "court"],
};

test("données du rapport : relecture sans confiance", () => {
  const d = parseReportData(raw);
  assert.deepEqual(Object.keys(d.by_poste).sort(), ["alimentation", "consommation", "energie", "mobilite"]);
  assert.deepEqual(d.top_actions.map((a) => a.template), ["velo"]);
  assert.deepEqual(d.quotes, ["Trop bien ce défi, merci à tous !"]);
});

test("chiffres clés : mis en forme par le code, valeurs masquées sous 5 personnes", () => {
  const f = keyFigures(parseReportData(raw));
  assert.ok(f.some((x) => x.label.startsWith("Évolution") && x.value === "+27 %"));
  const masked = keyFigures(parseReportData({ ...raw, active: null, kg: null }));
  assert.ok(masked.some((x) => x.value === "moins de 5 personnes"));
});

test("verbatims : les plus positifs d'abord, 3 au plus", () => {
  assert.deepEqual(pickQuotes(["Une phrase neutre ici.", "Bravo pour cette semaine !", "Merci, c'était sympa", "Autre phrase"], 2), [
    "Bravo pour cette semaine !",
    "Merci, c'était sympa",
  ]);
});

test("synthèse du mois par les règles, et libellé du mois", () => {
  const text = monthNarrative(parseReportData(raw));
  assert.match(text, /318 kg de CO₂, \+27 % par rapport au mois précédent/);
  assert.match(text, /27 personnes sur 42/);
  assert.match(text, /mobilité/);
  assert.equal(text.split("\n").filter((l) => l.startsWith("- ")).length, 3);
  assert.match(monthNarrative(parseReportData({ ...raw, kg: null, active: null, teams: [], top_actions: [], by_poste: {} })), /Pas assez de participants/);
  assert.equal(monthLabel("2026-10"), "octobre 2026");
});
