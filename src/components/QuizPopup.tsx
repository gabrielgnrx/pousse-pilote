"use client";
import { useEffect, useRef } from "react";
import type { Quiz } from "@/lib/game/quiz.ts";
import { QuizCard } from "./QuizCard";

const KEY = "pousse-quiz-popup";

/**
 * Le quiz du jour s'ouvre tout seul à la première ouverture de l'appli dans la journée, tant qu'il
 * n'est pas terminé. Une fois fermé, il ne revient pas avant demain sur cet appareil (il reste sur /quiz).
 */
export function QuizPopup({ quiz, day }: { quiz: Quiz; day: string }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(KEY);
    } catch {
      /* stockage indisponible : on l'affiche */
    }
    if (seen === day) return;
    const id = setTimeout(() => ref.current?.showModal(), 400);
    return () => clearTimeout(id);
  }, [day]);

  const remember = () => {
    try {
      localStorage.setItem(KEY, day);
    } catch {
      /* rien à faire */
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={remember}
      aria-labelledby="quiz-popup-titre"
      className="m-auto w-[calc(100%-24px)] max-w-md rounded-[24px] bg-papier p-0 text-encre shadow-2xl backdrop:bg-encre/50"
    >
      <div className="flex max-h-[88dvh] flex-col gap-3 overflow-y-auto p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-wider text-argile-fonce uppercase">Pour bien commencer</p>
            <h2 id="quiz-popup-titre" className="font-display text-xl font-bold">
              {quiz.answered > 0 ? "Termine ton quiz du jour" : "Ton quiz du jour"}
            </h2>
            <p className="text-sm text-brun">10 questions, 2 minutes, jusqu&apos;à 15 pousses.</p>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Fermer le quiz"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sable"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <QuizCard initial={quiz} />
        <button type="button" onClick={() => ref.current?.close()} className="btn-ghost min-h-11 text-sm">
          {quiz.answered > 0 ? "Fermer" : "Plus tard"}
        </button>
        <p className="-mt-1 text-center text-xs text-terre">Tu le retrouves à tout moment dans Mon plan, avec tes quêtes du jour.</p>
      </div>
    </dialog>
  );
}
