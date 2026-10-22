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
 */
export function CompanyHero({ pulse }: { pulse: CompanyPulse }) {
  const kg = Number(pulse.kg);
  const goal = Number(pulse.goal_kg);
  const pct = goal > 0 ? Math.min(100, (kg / goal) * 100) : 0;
  const left = Math.max(0, goal - kg);
  const active = Number(pulse.active_today);
  const rank =
    pulse.team_rank && pulse.team_size && pulse.team_size > 1 ? (pulse.team_rank === 1 ? "1er" : `${pulse.team_rank}e`) : null;

  return (
    <Link
      href="/equipes/classement"
      className="relative flex flex-col gap-3 overflow-hidden rounded-[32px_32px_32px_12px] bg-sapin p-5 text-sapin-clair shadow-[inset_0_-6px_0_var(--color-sapin-fonce)]"
    >
      <Mascot size={88} className="absolute top-3.5 right-3.5" />
      <span className="relative text-[13px] font-semibold text-[#c8dcc4]">Ensemble chez {pulse.name}</span>
      <span className="relative flex flex-col gap-0.5 pr-24">
        <span className="font-display text-[46px] leading-none tabular-nums">{formatKg(kg)}</span>
        <span className="text-[15px] text-[#dfe9da]">de CO₂ évités ensemble (déclaré)</span>
      </span>
      <span className="relative flex flex-col gap-2">
        <span className="flex justify-between text-[13px] text-[#dfe9da]">
          <span>{left > 0 ? `Encore ${formatKg(left)} avant l'objectif` : "Objectif atteint !"}</span>
          <span className="font-semibold text-white">{formatKg(goal)}</span>
        </span>
        <span
          className="h-2.5 overflow-hidden rounded-full bg-sapin-fonce"
          role="progressbar"
          aria-label={`Objectif de l'entreprise : ${formatKg(goal)}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
        >
          <span className="block h-full rounded-full bg-feuille transition-[width] duration-1000" style={{ width: `${Math.max(pct, kg > 0 ? 3 : 0)}%` }} />
        </span>
      </span>
      <span className="relative grid grid-cols-2 gap-2">
        <span className="flex flex-col rounded-2xl bg-sapin-fonce px-3 py-2.5">
          <span className="text-lg font-bold">+{formatKg(Number(pulse.today_kg))}</span>
          <span className="text-xs text-[#c8dcc4]">
            aujourd&apos;hui · {active} actif{active > 1 ? "s" : ""}
          </span>
        </span>
        <span className="flex flex-col rounded-2xl bg-creme px-3 py-2.5 text-encre">
          <span className="text-lg font-bold">{formatKg(Number(pulse.my_kg))}</span>
          <span className="text-xs text-terre">ta part{rank ? ` · ${rank} de ton équipe` : ""}</span>
        </span>
      </span>
    </Link>
  );
}
