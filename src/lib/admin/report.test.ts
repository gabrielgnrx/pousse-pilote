import { test } from "node:test";
import assert from "node:assert/strict";
import { fallbackNarrative, keyFigures, monthLabel, numbersSupported, parseReportData, pickQuotes, reportFacts } from "./report.ts";

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

test("contrôle : aucun chiffre absent des agrégats dans le texte de l'IA", () => {
  const facts = reportFacts(parseReportData(raw));
  assert.equal(numbersSupported("318 kg évités ce mois-ci, 27 personnes actives, +27 % sur le mois.", facts), true);
  assert.equal(numbersSupported("319 kg évités ce mois-ci.", facts), false);
  assert.equal(numbersSupported("27 personnes actives et 512 actions enregistrées.", facts), true);
  assert.equal(numbersSupported("Le vélo a été choisi 999 fois.", facts), false);
  assert.equal(numbersSupported("1. Relayer le défi. 2. Valoriser les équipes.", facts), true);
});

test("verbatims : les plus positifs d'abord, 3 au plus", () => {
  assert.deepEqual(pickQuotes(["Une phrase neutre ici.", "Bravo pour cette semaine !", "Merci, c'était sympa", "Autre phrase"], 2), [
    "Bravo pour cette semaine !",
    "Merci, c'était sympa",
  ]);
});

test("texte sans IA et libellé du mois", () => {
  assert.match(fallbackNarrative(parseReportData(raw)), /Recommandations/);
  assert.equal(monthLabel("2026-10"), "octobre 2026");
});
