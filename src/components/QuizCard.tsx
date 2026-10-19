"use client";
import { useState, useTransition } from "react";
import type { Quiz } from "@/lib/game/data.ts";
import { answerQuiz } from "@/lib/game/actions";

/** Le quiz du jour : une question, la même pour toute l'entreprise, +5 si c'est juste. */
export function QuizCard({ initial }: { initial: Quiz }) {
  const [quiz, setQuiz] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const pick = (i: number) =>
    start(async () => {
      setError(null);
      const r = await answerQuiz(i);
      if ("error" in r) setError(r.error);
      else setQuiz(r);
    });

  return (
    <section id="quiz" className="card flex scroll-mt-4 flex-col gap-2.5 py-3.5" aria-labelledby="quiz-titre">
      <div className="flex items-center justify-between gap-2">
        <h2 id="quiz-titre" className="font-display text-base font-bold">Quiz du jour</h2>
        <span className={`chip ${quiz.answered ? (quiz.correct ? "bg-sauge" : "bg-creme") : "bg-peche"}`}>
          {quiz.answered ? (quiz.correct ? "+5 pousses" : "raté, à demain") : "+5 pousses"}
        </span>
      </div>
      <p className="text-sm font-semibold leading-snug">{quiz.question}</p>
      <ul className="flex flex-col gap-1.5">
        {quiz.choices.map((c, i) => {
          const isAnswer = quiz.answered && i === quiz.answer;
          const isWrongPick = quiz.answered && i === quiz.choice && !quiz.correct;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={quiz.answered || pending}
                onClick={() => pick(i)}
                className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${
                  isAnswer ? "bg-sauge font-bold text-[#2e3a22]" : isWrongPick ? "bg-peche line-through" : "bg-creme hover:bg-sable disabled:hover:bg-creme"
                } ${quiz.answered && !isAnswer && !isWrongPick ? "opacity-60" : ""}`}
              >
                <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-terre/40 text-xs font-bold">
                  {isAnswer ? "✓" : String.fromCharCode(65 + i)}
                </span>
                {c}
              </button>
            </li>
          );
        })}
      </ul>
      {quiz.answered ? (
        <div role="status" className="flex flex-col gap-1 text-xs leading-relaxed">
          <p className="text-brun">{quiz.explanation}</p>
          {quiz.answers && quiz.answers > 1 ? (
            <p className="font-semibold text-terre">
              {Math.round(((quiz.good ?? 0) / quiz.answers) * 100)} % de bonnes réponses parmi les {quiz.answers} collègues qui ont joué.
            </p>
          ) : (
            <p className="font-semibold text-terre">Tu es le premier à répondre aujourd&apos;hui.</p>
          )}
        </div>
      ) : null}
      {error ? <p role="alert" className="text-xs font-semibold text-argile-fonce">{error}</p> : null}
    </section>
  );
}
