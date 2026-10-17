import { formatKg } from "@/lib/co2/challenges.ts";
import type { CollectiveGoal } from "@/lib/engagement-data";

/** L'impact : objectif de l'entreprise en kg de CO₂ évités, tous ensemble. */
export function GoalCard({ goal, compact = false }: { goal: CollectiveGoal; compact?: boolean }) {
  const pct = Math.min(100, Math.round((goal.kg / goal.goal_kg) * 100));
  const daysLeft = Math.max(0, Math.ceil((new Date(`${goal.ends_on}T23:59:59`).getTime() - Date.now()) / 86_400_000));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className={`font-bold ${compact ? "text-sm" : "text-base"}`}>
          {formatKg(goal.kg)} <span className="font-normal text-terre">sur {formatKg(goal.goal_kg)} de CO₂ évités</span>
        </p>
        <p className="shrink-0 text-xs text-terre">{daysLeft > 0 ? `encore ${daysLeft} j` : "terminé"}</p>
      </div>
      <div
        className="h-2.5 rounded-full bg-trait"
        role="progressbar"
        aria-label={`Objectif de l'entreprise atteint à ${pct} %`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-2.5 rounded-full bg-sapin" style={{ width: `${Math.max(pct, goal.kg > 0 ? 2 : 0)}%` }} />
      </div>
      {!compact ? (
        <p className="text-xs leading-relaxed text-terre">
          Objectif de {goal.name} : 30 kg par participant ({goal.participants}) sur la durée du pilote. Chaque défi
          validé fait avancer tout le monde.
        </p>
      ) : null}
    </div>
  );
}
