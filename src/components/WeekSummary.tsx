import Link from "next/link";
import { formatKg } from "@/lib/co2/challenges.ts";
import type { CollectiveGoal, TeamRow } from "@/lib/engagement-data";
import { daysUntil } from "@/lib/dates";

const ordinal = (n: number) => (n === 1 ? "1re" : `${n}e`);

/** Ensemble, en deux tuiles : ton équipe (classement en pousses) et l'entreprise (kg de CO₂ évités). */
export function WeekSummary({
  team,
  teamsCount,
  goal,
}: {
  team: { rank: number; row: TeamRow } | null;
  teamsCount: number;
  goal: CollectiveGoal | null;
}) {
  const pct = goal ? Math.min(100, Math.round((goal.kg / goal.goal_kg) * 100)) : 0;
  const daysLeft = goal ? Math.max(0, daysUntil(goal.ends_on) + 1) : 0;
  return (
    <section className="grid grid-cols-2 gap-2.5" aria-label="Ensemble">
      <Link href="/equipes" className="flex flex-col gap-0.5 rounded-[18px] border border-encre/10 bg-papier px-3.5 py-3">
        <span className="text-[11px] font-bold tracking-wider text-terre uppercase">Ton équipe · semaine</span>
        {team ? (
          <>
            <span>
              <span className="font-display text-2xl font-bold">{ordinal(team.rank)}</span>
              <span className="ml-1 text-sm font-semibold">sur {teamsCount}</span>
            </span>
            <span className="text-xs text-terre">{team.row.points_per_person.toLocaleString("fr-FR")} pousses / pers.</span>
          </>
        ) : (
          <span className="text-xs leading-snug text-brun">Classement dès 5 participants dans ton équipe</span>
        )}
      </Link>
      {goal ? (
        <Link href="/equipes" className="flex flex-col gap-0.5 rounded-[18px] border border-encre/10 bg-papier px-3.5 py-3">
          <span className="text-[11px] font-bold tracking-wider text-terre uppercase">Entreprise · CO₂</span>
          <span>
            <span className="font-display text-2xl font-bold">{formatKg(goal.kg)}</span>
            <span className="ml-1 text-xs text-terre">/ {formatKg(goal.goal_kg)}</span>
          </span>
          <span
            className="mt-0.5 h-1.5 rounded-full bg-trait"
            role="progressbar"
            aria-label={`Objectif de l'entreprise atteint à ${pct} %`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <span className="block h-1.5 rounded-full bg-sapin" style={{ width: `${Math.max(pct, goal.kg > 0 ? 3 : 0)}%` }} />
          </span>
          <span className="text-xs text-terre">{daysLeft > 0 ? `${pct} % · encore ${daysLeft} j` : `${pct} % · terminé`}</span>
        </Link>
      ) : null}
    </section>
  );
}
