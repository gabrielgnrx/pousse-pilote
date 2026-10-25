"use client";
import { useState, useTransition } from "react";
import { answerWeekQuiz, type WeekQuestion } from "@/lib/game/actions";

/**
 * Le quiz de la semaine : questions tirées des fiches et des bonnes nouvelles de la semaine, générées
 * par l'IA puis relues (la réponse est toujours justifiée par la source, citée sous chaque question).
 */
export function WeekQuiz({ initial }: { initial: WeekQuestion[] }) {
  const [quiz, setQuiz] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!quiz.length) return null;
  const done = quiz.filter((q) => q.my_choice !== null).length;
  const good = quiz.filter((q) => q.correct).length;

  return (
    <section aria-labelledby="quiz-semaine" className="flex flex-col gap-3">
      <div>
        <h2 id="quiz-semaine" className="font-display text-xl">Quiz de la semaine</h2>
        <p className="text-sm text-terre">
          Tiré des fiches et des bonnes nouvelles de la semaine. +2 pousses par bonne réponse, 10 au plus.
          {done ? ` ${good}/${done} pour l'instant.` : ""}
        </p>
      </div>
      {quiz.map((q) => {
        const answered = q.my_choice !== null;
        return (
          <article key={q.id} className="card flex flex-col gap-2.5">
            <p className="label">{q.source_kind === "actu" ? "Bonne nouvelle" : "Fiche geste"} · {q.source_title}</p>
            <h3 className="font-bold leading-snug">{q.question}</h3>
            <div className="flex flex-col gap-1.5" role="group" aria-label="Choix de réponse">
              {q.choices.map((c, i) => {
                const isAnswer = answered && q.answer === i;
                const isMine = q.my_choice === i;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={answered || pending}
                    aria-pressed={isMine}
                    onClick={() =>
                      start(async () => {
                        const r = await answerWeekQuiz(q.id, i);
                        if (r.ok) {
                          setQuiz(r.quiz);
                          setError(null);
                        } else setError(r.error);
                      })
                    }
                    className={`min-h-11 rounded-2xl border px-3 py-2 text-left text-sm ${
                      isAnswer ? "border-sapin bg-sauge font-semibold text-sapin" : isMine ? "border-argile bg-peche text-argile-fonce" : "border-trait bg-papier"
                    }`}
                  >
                    {c}
                    {isAnswer ? <span className="sr-only"> (bonne réponse)</span> : null}
                  </button>
                );
              })}
            </div>
            {answered && q.explanation ? (
              <p className="text-sm text-brun" role="status">
                {q.correct ? "Bien vu ! " : "Pas tout à fait. "}
                {q.explanation}{" "}
                {q.source_url ? (
                  <a href={q.source_url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                    Lire la source
                  </a>
                ) : null}
              </p>
            ) : null}
          </article>
        );
      })}
      {error ? <p role="alert" className="text-sm font-semibold text-argile-fonce">{error}</p> : null}
      <p className="text-xs text-terre">Questions rédigées par l&apos;IA de Pousse, puis relues automatiquement : chaque réponse est justifiée par sa source.</p>
    </section>
  );
}
