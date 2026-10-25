/**
 * Relecture automatique des questions générées, partie déterministe : forme de la question et
 * présence mot pour mot de la phrase justificative dans la source. La relecture par l'IA (une
 * seconde lecture qui doit trouver la même réponse en ne lisant que la source) vient en plus.
 */
import type { QuizSource } from "./sources.ts";

export interface GeneratedQuestion {
  source_id: string;
  question: string;
  choices: string[];
  answer_index: number;
  explanation: string;
  evidence: string;
}

const norm = (s: string) =>
  s
    .toLocaleLowerCase("fr-FR")
    .normalize("NFC")
    .replace(/[’']/g, "'")
    .replace(/[«»"“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** La phrase justificative doit figurer dans la source, presque mot pour mot (20 caractères au moins). */
export function evidenceInSource(evidence: string, source: QuizSource): boolean {
  const e = norm(evidence).replace(/[.…]+$/, "");
  return e.length >= 20 && norm(source.text).includes(e);
}

export function wellFormed(q: GeneratedQuestion): boolean {
  const choices = q.choices.map((c) => norm(c));
  return (
    q.choices.length >= 3 &&
    q.choices.length <= 4 &&
    new Set(choices).size === choices.length &&
    choices.every((c) => c.length >= 1 && c.length <= 120) &&
    Number.isInteger(q.answer_index) &&
    q.answer_index >= 0 &&
    q.answer_index < q.choices.length &&
    q.question.trim().length >= 10 &&
    q.question.length <= 220 &&
    q.explanation.trim().length >= 10 &&
    q.explanation.length <= 400
  );
}

export function preCheck(q: GeneratedQuestion, sources: QuizSource[]): QuizSource | null {
  const source = sources.find((s) => s.id === q.source_id);
  if (!source || !wellFormed(q) || !evidenceInSource(q.evidence, source)) return null;
  return source;
}
