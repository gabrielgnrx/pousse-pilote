import Link from "next/link";
import type { CollectiveGoal, TeamRow } from "@/lib/engagement-data";
import { GoalCard } from "./GoalCard";

const ordinal = (n: number) => (n === 1 ? "1re" : `${n}e`);

/** Ensemble : ton équipe (classement en pousses) et l'entreprise (kg de CO₂ évités). */
export function WeekSummary({
  team,
  teamsCount,
  goal,
}: {
  team: { rank: number; row: TeamRow } | null;
  teamsCount: number;
  goal: CollectiveGoal | null;
}) {
  return (
    <section className="overflow-hidden rounded-[20px] border border-encre/10 bg-papier" aria-labelledby="ensemble">
      <div className="flex items-baseline justify-between bg-sable px-4 py-2.5">
        <h2 id="ensemble" className="text-[11px] font-bold tracking-wider uppercase">Ensemble, cette semaine</h2>
        <Link href="/regles" className="text-xs font-semibold underline underline-offset-2">Comment ça marche ?</Link>
      </div>

      <Link href="/equipes" className="flex items-center gap-3 border-b border-encre/10 px-4 py-3">
        <span className="w-20 text-xs font-bold text-terre uppercase">Ton équipe</span>
        <span className="flex-1">
          {team ? (
            <>
              <span className="font-display text-2xl font-bold">{ordinal(team.rank)}</span>
              <span className="ml-1 text-sm font-semibold">sur {teamsCount}</span>
              <span className="block text-xs text-terre">
                {team.row.points_per_person.toLocaleString("fr-FR")} pousses par participant
              </span>
            </>
          ) : (
            <span className="block text-sm text-brun">Le classement démarre dès 5 participants dans ton équipe.</span>
          )}
        </span>
        <span aria-hidden="true" className="text-terre">›</span>
      </Link>

      {goal ? (
        <Link href="/equipes" className="flex items-start gap-3 px-4 py-3">
          <span className="w-20 pt-0.5 text-xs font-bold text-terre uppercase">Entreprise</span>
          <span className="flex-1">
            <GoalCard goal={goal} compact />
          </span>
          <span aria-hidden="true" className="pt-0.5 text-terre">›</span>
        </Link>
      ) : null}
    </section>
  );
}
