/**
 * Le quiz de la semaine : sources → génération → relecture (déterministe, puis par une seconde IA).
 * Seules les questions dont la réponse est justifiée par la source survivent. Au plus 5.
 */
import { runTask, type AiStore } from "../ai/run.ts";
import type { MessagesClient } from "../ai/types.ts";
import { quizGenerateTask, quizVerifyTask } from "../ai/prompts/quiz.ts";
import { preCheck, type GeneratedQuestion } from "./check.ts";
import type { QuizSource } from "./sources.ts";

export interface ReviewedQuestion {
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
  source_kind: QuizSource["kind"];
  source_title: string;
  source_url: string;
}

export interface QuizRun {
  questions: ReviewedQuestion[];
  generated: number;
  rejected: { reason: "forme_ou_source" | "relecture"; question: string }[];
}

export async function generateWeeklyQuiz(
  sources: QuizSource[],
  deps: { client: MessagesClient | null; store: AiStore; mock?: boolean },
  max = 5,
): Promise<QuizRun> {
  const run: QuizRun = { questions: [], generated: 0, rejected: [] };
  if (sources.length === 0) return run;
  const g = await runTask(quizGenerateTask, { sources }, deps);
  if (!g.ok) return run;
  run.generated = g.data.questions.length;

  for (const q of g.data.questions as GeneratedQuestion[]) {
    if (run.questions.length >= max) break;
    const source = preCheck(q, sources);
    if (!source) {
      run.rejected.push({ reason: "forme_ou_source", question: q.question });
      continue;
    }
    const v = await runTask(quizVerifyTask, { source, question: q }, deps);
    if (!v.ok || !v.data.supported || v.data.answer_index !== q.answer_index) {
      run.rejected.push({ reason: "relecture", question: q.question });
      continue;
    }
    run.questions.push({
      question: q.question.trim(),
      choices: q.choices.map((c) => c.trim()),
      answer: q.answer_index,
      explanation: q.explanation.trim(),
      source_kind: source.kind,
      source_title: source.title,
      source_url: source.url ?? "",
    });
  }
  return run;
}
