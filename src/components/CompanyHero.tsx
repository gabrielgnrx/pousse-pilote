import Link from "next/link";
import { formatKg } from "@/lib/co2/challenges.ts";
import { Mascot } from "@/components/Mascot";

export interface CompanyPulse {
  name: string;
  kg: number;
  goal_kg: number;
  today_kg: number;
  active_today: number;
  my_kg: number;
  team_rank: number | null;
  team_size: number | null;
}

/**
 * En haut de l'accueil : ce que toute l'entreprise a évité ensemble, l'objectif du pilote,
 * et ta part. C'est le seul endroit où cette jauge apparaît.
 * Posé à plat sur la page (pas de carte) : c'est le haut de la tige d'où part le fil d'actu.
 */
export function CompanyHero({ pulse }: { pulse: CompanyPulse }) {
  const kg = Number(pulse.kg);
  const goal = Number(pulse.goal_kg);
  const pct = goal > 0 ? Math.min(100, (kg / goal) * 100) : 0;
  const left = Math.max(0, goal - kg);
  const shown = Math.max(pct, kg > 0 ? 3 : 0);
  const active = Number(pulse.active_today);
  const rank =
    pulse.team_rank && pulse.team_size && pulse.team_size > 1 ? (pulse.team_rank === 1 ? "1er" : `${pulse.team_rank}e`) : null;

  return (
    <Link
      href="/equipes/classement"
      aria-label={`Ensemble chez ${pulse.name} : ${formatKg(kg)} de CO₂ évités. Voir le classement des équipes`}
      className="relative flex flex-col pt-1 pb-5 text-encre"
    >
      <Mascot size={96} className="absolute -top-1 -right-1" />
      <span className="text-sm font-semibold text-brun">Ensemble chez {pulse.name}</span>
      <span className="mt-0.5 pr-24 font-display text-[48px] leading-none tracking-tight tabular-nums">{formatKg(kg)}</span>
      <span className="mt-1 text-base text-brun">de CO₂ évités ensemble (déclaré)</span>
      <span className="mt-4 flex flex-col gap-2">
        <span
          className="relative h-3 rounded-full bg-trait"
          role="progressbar"
          aria-label={`Objectif de l'entreprise : ${formatKg(goal)}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
        >
          <span className="absolute inset-y-0 left-0 rounded-full bg-chloro transition-[width] duration-1000" style={{ width: `${shown}%` }} />
          <span
            aria-hidden="true"
            className="absolute -top-[5px] -ml-[11px] size-[22px] rounded-full border-[3px] border-creme bg-pollen transition-[left] duration-1000"
            style={{ left: `${shown}%` }}
          />
        </span>
        <span className="flex justify-between text-[13px] text-brun">
          <span>{left > 0 ? `Encore ${formatKg(left)} avant l'objectif` : "Objectif atteint !"}</span>
          <span className="font-bold text-encre">{formatKg(goal)}</span>
        </span>
      </span>
      <span className="mt-3.5 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <span>
          <span className="font-bold">+{formatKg(Number(pulse.today_kg))}</span>{" "}
          <span className="text-brun">
            aujourd&apos;hui · {active} actif{active > 1 ? "s" : ""}
          </span>
        </span>
        <span>
          <span className="font-bold">{formatKg(Number(pulse.my_kg))}</span>{" "}
          <span className="text-brun">ta part{rank ? ` · ${rank} de ton équipe` : ""}</span>
        </span>
      </span>
    </Link>
  );
}
