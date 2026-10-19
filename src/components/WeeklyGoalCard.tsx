import Link from "next/link";
import type { WeeklyGoal } from "@/lib/game/data.ts";
import { GOAL_KINDS } from "@/lib/game/labels.ts";
import { daysUntil } from "@/lib/dates";

/** Le défi collectif de la semaine : une jauge commune à toute l'entreprise. */
export function WeeklyGoalCard({ goal }: { goal: WeeklyGoal }) {
  const k = GOAL_KINDS[goal.kind];
  if (!k) return null;
  const pct = Math.min(100, Math.round((goal.progress / goal.target) * 100));
  const left = Math.max(0, daysUntil(goal.ends_on) + 1);
  const missing = Math.max(0, goal.target - goal.progress);
  return (
    <section className={`flex flex-col gap-2 rounded-[20px] p-4 ${goal.reached ? "bg-sapin text-sapin-clair" : "bg-sable"}`} aria-labelledby="collectif">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="collectif" className="text-[11px] font-bold tracking-wider uppercase">Défi collectif de la semaine</h2>
        <span className="text-xs opacity-80">{left > 1 ? `encore ${left} j` : "dernier jour"}</span>
      </div>
      <p className="font-display text-xl leading-tight font-bold">
        {goal.progress} / {goal.target} {k.label}
      </p>
      <div className={`h-3 overflow-hidden rounded-full ${goal.reached ? "bg-white/20" : "bg-papier"}`} role="progressbar" aria-label="Avancement du défi collectif" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className={`h-3 rounded-full transition-[width] duration-1000 ${goal.reached ? "bg-abricot" : "bg-sapin"}`} style={{ width: `${Math.max(pct, goal.progress > 0 ? 3 : 0)}%` }} />
      </div>
      <p className="text-xs leading-snug">
        {goal.reached
          ? goal.mine > 0
            ? `Objectif atteint ensemble ! +30 pousses pour toi (${goal.mine} ${goal.mine > 1 ? k.label : k.one}).`
            : "Objectif atteint ! Contribue au moins une fois pour gagner tes +30 pousses."
          : (
            <>
              Encore {missing} pour gagner <strong>+30 pousses chacun</strong>.{" "}
              {goal.mine > 0 ? `Ta part : ${goal.mine}.` : k.hint}{" "}
              <Link href={k.href} className="font-bold underline underline-offset-2">J&apos;y vais</Link>
            </>
          )}
      </p>
    </section>
  );
}
