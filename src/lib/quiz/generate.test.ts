import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWeeklyQuiz } from "./generate.ts";
import type { QuizSource } from "./sources.ts";
import type { AiStore } from "../ai/run.ts";
import type { MessagesClient, MessageParams } from "../ai/types.ts";

const store: AiStore = { consume: async () => true, cacheGet: async () => null, cachePut: async () => undefined, log: async () => undefined };
const sources: QuizSource[] = [
  { id: "fiche:velo", kind: "fiche", title: "Vélo", text: "Un trajet à vélo n'émet rien à l'usage. Garde une tenue de rechange au bureau.", url: null },
];
const good = { source_id: "fiche:velo", question: "Combien émet un trajet à vélo à l'usage ?", choices: ["Rien", "Beaucoup", "Un peu"], answer_index: 0, explanation: "La fiche dit qu'il n'émet rien à l'usage.", evidence: "Un trajet à vélo n'émet rien à l'usage." };
const invented = { ...good, question: "Quelle est la vitesse moyenne d'un vélo en ville ?", evidence: "Un vélo roule à 15 km/h en moyenne en ville." };
const disputed = { ...good, question: "Que garder au bureau ?", choices: ["Une tenue de rechange", "Un casque", "Une pompe"], answer_index: 1, evidence: "Garde une tenue de rechange au bureau." };

function client(verifyAnswer: (p: MessageParams) => unknown): MessagesClient {
  return {
    messages: {
      create: async (p) => {
        const isGenerate = p.model === "claude-sonnet-5-5";
        const json = isGenerate ? { questions: [good, invented, disputed] } : verifyAnswer(p);
        return { content: [{ type: "text", text: JSON.stringify(json) }], stop_reason: "end_turn", usage: { input_tokens: 800, output_tokens: 300 } };
      },
    },
  };
}

test("quiz : seule la question justifiée par la source et confirmée par la relecture est gardée", async () => {
  // La relecture trouve « 0 » pour chaque question : la question « disputée » (réponse 1) est rejetée.
  const run = await generateWeeklyQuiz(sources, { client: client(() => ({ supported: true, answer_index: 0 })), store });
  assert.equal(run.generated, 3);
  assert.deepEqual(run.questions.map((q) => q.question), [good.question]);
  assert.deepEqual(run.rejected.map((r) => r.reason), ["forme_ou_source", "relecture"]);
  assert.equal(run.questions[0].source_kind, "fiche");
});

test("quiz : relecture qui ne trouve pas la justification → rejet", async () => {
  const run = await generateWeeklyQuiz(sources, { client: client(() => ({ supported: false, answer_index: null })), store });
  assert.equal(run.questions.length, 0);
});

test("quiz : IA indisponible → pas de quiz cette semaine (rien d'inventé)", async () => {
  const run = await generateWeeklyQuiz(sources, { client: null, store });
  assert.deepEqual(run, { questions: [], generated: 0, rejected: [] });
});
