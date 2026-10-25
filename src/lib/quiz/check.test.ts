import { test } from "node:test";
import assert from "node:assert/strict";
import { evidenceInSource, preCheck, wellFormed, type GeneratedQuestion } from "./check.ts";
import { ficheSources, newsSources, type QuizSource } from "./sources.ts";

const source: QuizSource = {
  id: "fiche:velo",
  kind: "fiche",
  title: "Vélo au lieu de la voiture",
  text: "Une voiture thermique émet 0,111 kg de CO₂ par km et par personne. Un trajet à vélo n'émet rien à l'usage.",
  url: null,
};
const q: GeneratedQuestion = {
  source_id: "fiche:velo",
  question: "Combien émet un trajet à vélo à l'usage ?",
  choices: ["Rien", "La moitié d'une voiture", "Autant qu'un bus"],
  answer_index: 0,
  explanation: "La fiche indique qu'un trajet à vélo n'émet rien à l'usage.",
  evidence: "Un trajet à vélo n’émet rien à l’usage.",
};

test("relecture : la phrase justificative doit être dans la source", () => {
  assert.equal(evidenceInSource(q.evidence, source), true);
  assert.equal(evidenceInSource("Un trajet à vélo émet 50 g par km.", source), false);
  assert.equal(evidenceInSource("vélo", source), false);
});

test("relecture : forme de la question (choix distincts, réponse valide)", () => {
  assert.equal(wellFormed(q), true);
  assert.equal(wellFormed({ ...q, choices: ["Rien", "rien", "Oui"] }), false);
  assert.equal(wellFormed({ ...q, answer_index: 3 }), false);
  assert.equal(wellFormed({ ...q, choices: ["A", "B"] }), false);
});

test("relecture : source inconnue ou justification absente → question rejetée", () => {
  assert.equal(preCheck(q, [source])?.id, "fiche:velo");
  assert.equal(preCheck({ ...q, source_id: "fiche:autre" }, [source]), null);
  assert.equal(preCheck({ ...q, evidence: "Inventé de toutes pièces par le modèle." }, [source]), null);
});

test("sources : 3 fiches différentes chaque semaine, bonnes nouvelles avec lien https", () => {
  const a = ficheSources("2026-10-19");
  const b = ficheSources("2026-10-26");
  assert.equal(a.length, 3);
  assert.notDeepEqual(a.map((s) => s.id), b.map((s) => s.id));
  const news = newsSources([
    { source: "Vert", title: "Une bonne nouvelle", link: "https://vert.eco/x", excerpt: "x".repeat(80), image: null, publishedAt: "", score: 3 },
    { source: "Autre", title: "Lien non sécurisé", link: "http://exemple.fr", excerpt: "y".repeat(80), image: null, publishedAt: "", score: 3 },
  ]);
  assert.deepEqual(news.map((s) => s.url), ["https://vert.eco/x"]);
});
