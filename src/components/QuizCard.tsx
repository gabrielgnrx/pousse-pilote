"use client";
import { useState, useTransition } from "react";
import type { Quiz, QuizDone } from "@/lib/game/quiz.ts";
import { answerQuiz } from "@/lib/game/actions";

const LETTERS = ["A", "B", "C", "D"];

/** Le quiz du jour : 10 questions difficiles, une à la fois, avec la correction après chaque réponse. */
export function QuizCard({ initial }: { initial: Quiz }) {
  const [quiz, setQuiz] = useState(initial);
  const [reveal, setReveal] = useState<QuizDone | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const pick = (questionId: number, i: number) =>
    start(async () => {
      setError(null);
      const r = await answerQuiz(questionId, i);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setQuiz(r);
      setReveal(r.done.find((d) => d.id === questionId) ?? null);
    });

  const finished = !quiz.current && !reveal;
  const position = reveal ? quiz.done.findIndex((d) => d.id === reveal.id) + 1 : quiz.answered + 1;

  return (
    <section id="quiz" className="card flex scroll-mt-4 flex-col gap-3 py-3.5" aria-labelledby="quiz-titre">
      <div className="flex items-center justify-between gap-2">
        <h2 id="quiz-titre" className="font-display text-base font-bold">Quiz du jour</h2>
        <span className="chip bg-peche">
          {finished ? `${quiz.score}/${quiz.total}` : `Question ${Math.min(position, quiz.total)}/${quiz.total} · ${quiz.score} juste${quiz.score > 1 ? "s" : ""}`}
        </span>
      </div>

      <ol className="grid grid-cols-10 gap-1" aria-label="Avancement du quiz">
        {Array.from({ length: quiz.total }, (_, i) => {
          const d = quiz.done[i];
          return (
            <li
              key={i}
              className={`h-1.5 rounded-full ${d ? (d.correct ? "bg-sapin" : "bg-argile") : i === quiz.answered ? "bg-terre/50" : "bg-trait"}`}
            >
              <span className="sr-only">{d ? (d.correct ? "juste" : "faux") : "à venir"}</span>
            </li>
          );
        })}
      </ol>

      {reveal ? (
        <div className="flex flex-col gap-2.5" role="status">
          <p className="text-sm leading-snug font-semibold">{reveal.question}</p>
          <ul className="flex flex-col gap-1.5">
            {reveal.choices.map((c, i) => {
              const isAnswer = i === reveal.answer;
              const isWrongPick = i === reveal.choice && !reveal.correct;
              return (
                <li
                  key={i}
                  className={`flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                    isAnswer ? "bg-sauge font-bold text-[#2e3a22]" : isWrongPick ? "bg-peche line-through" : "bg-creme opacity-60"
                  }`}
                >
                  <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-terre/40 text-xs font-bold">
                    {isAnswer ? "✓" : LETTERS[i]}
                  </span>
                  {c}
                </li>
              );
            })}
          </ul>
          <p className={`text-sm font-bold ${reveal.correct ? "text-sapin" : "text-argile-fonce"}`}>
            {reveal.correct ? "Bien vu ! +1 pousse" : "Raté."}
          </p>
          <p className="text-xs leading-relaxed text-brun">{reveal.explanation}</p>
          {reveal.good_pct !== null ? (
            <p className="text-xs font-semibold text-terre">{reveal.good_pct} % des collègues ont trouvé.</p>
          ) : null}
          <button type="button" onClick={() => setReveal(null)} className="btn-dark min-h-11 text-sm">
            {quiz.current ? "Question suivante" : "Voir mon score"}
          </button>
        </div>
      ) : quiz.current ? (
        <div className="flex flex-col gap-2.5">
          <p className="text-sm leading-snug font-semibold">{quiz.current.question}</p>
          <ul className="flex flex-col gap-1.5">
            {quiz.current.choices.map((c, i) => (
              <li key={i}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => pick(quiz.current!.id, i)}
                  className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-creme px-3 py-2 text-left text-sm hover:bg-sable disabled:opacity-60"
                >
                  <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-terre/40 text-xs font-bold">
                    {LETTERS[i]}
                  </span>
                  {c}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-terre">+1 pousse par bonne réponse · +5 de bonus à 8/10 · chiffres ADEME</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="font-display text-3xl font-bold">
            {quiz.score}/{quiz.total}
          </p>
          <p className="text-sm text-brun">
            {quiz.score >= 8
              ? `Excellent ! ${quiz.score} pousses + 5 de bonus.`
              : quiz.score >= 7
                ? `Quiz réussi : ${quiz.score} pousses. Encore une bonne réponse et c'était le bonus.`
                : `${quiz.score} pousse${quiz.score > 1 ? "s" : ""}. Il faut 7/10 pour un quiz réussi : retente demain avec 10 nouvelles questions.`}
          </p>
          {quiz.finished > 1 && quiz.avg_score !== null ? (
            <p className="text-xs font-semibold text-terre">
              {quiz.finished} collègues ont terminé aujourd&apos;hui, avec {String(quiz.avg_score).replace(".", ",")}/10 en moyenne.
            </p>
          ) : null}
          <details className="text-sm">
            <summary className="cursor-pointer font-bold underline underline-offset-2">Revoir les corrections</summary>
            <ol className="mt-2 flex flex-col gap-2.5">
              {quiz.done.map((d, i) => (
                <li key={d.id} className="flex flex-col gap-0.5 border-t border-encre/10 pt-2">
                  <span className="text-xs font-bold">
                    {i + 1}. {d.correct ? "Juste" : "Faux"} · bonne réponse : {d.choices[d.answer]}
                  </span>
                  <span className="text-xs text-brun">{d.question}</span>
                  <span className="text-[11px] text-terre">{d.explanation}</span>
                </li>
              ))}
            </ol>
          </details>
          <p className="text-xs text-terre">10 nouvelles questions demain, jamais déjà posées.</p>
        </div>
      )}
      {error ? <p role="alert" className="text-xs font-semibold text-argile-fonce">{error}</p> : null}
    </section>
  );
}
