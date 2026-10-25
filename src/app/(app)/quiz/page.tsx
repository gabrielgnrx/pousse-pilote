import Link from "next/link";
import { requireProfile } from "@/lib/session";
import { getQuiz } from "@/lib/game/data.ts";
import { QuizCard } from "@/components/QuizCard";
import { WeekQuiz } from "@/components/WeekQuiz";
import type { WeekQuestion } from "@/lib/game/actions";

export const metadata = { title: "Quiz du jour · Pousse" };

export default async function QuizPage() {
  const { supabase } = await requireProfile();
  const [quiz, { data: week }] = await Promise.all([getQuiz(supabase), supabase.rpc("week_quiz")]);

  return (
    <>
      <Link href="/informer" className="flex h-11 items-center gap-1 self-start rounded-full bg-papier pr-4 pl-3 text-sm font-bold">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
        S&apos;informer
      </Link>
      <div>
        <h1 className="font-display text-2xl">Quiz du jour</h1>
        <p className="mt-1 text-sm text-terre">10 questions difficiles, jamais déjà posées. +1 pousse par bonne réponse, +5 de bonus à 8/10.</p>
      </div>
      {quiz ? <QuizCard initial={quiz} /> : <p className="card text-sm">Le quiz n&apos;a pas pu se charger. Réessaie dans un instant.</p>}
      <WeekQuiz initial={(week ?? []) as WeekQuestion[]} />
    </>
  );
}
