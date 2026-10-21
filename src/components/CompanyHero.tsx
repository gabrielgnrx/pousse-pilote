import Link from "next/link";
import { formatKg } from "@/lib/co2/challenges.ts";

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

  return (
    <Link href="/equipes/classement" className="flex flex-col gap-3 rounded-[22px] bg-[#2f5b36] p-4 text-[#f7f1e3]">
      <span className="text-[11px] font-bold tracking-[0.08em] text-[#cfe3c4] uppercase">Ensemble chez {pulse.name}</span>
      <span className="flex items-baseline gap-2">
        <span className="font-display text-[40px] leading-none font-bold tabular-nums">{formatKg(kg)}</span>
        <span className="text-sm font-semibold text-[#ddebd3]">de CO₂ évités</span>
      </span>
      {Number(pulse.today_kg) > 0 || active > 0 ? (
        <span className="self-start rounded-full bg-[#cfe3c4] px-2.5 py-1 text-xs font-bold text-[#1e4527]">
          +{formatKg(Number(pulse.today_kg))} aujourd&apos;hui · {active} collègue{active > 1 ? "s" : ""} actif{active > 1 ? "s" : ""}
        </span>
      ) : null}
      <span className="flex flex-col gap-1.5">
        <span
          className="h-2.5 overflow-hidden rounded-full bg-white/[0.18]"
          role="progressbar"
          aria-label={`Objectif de l'entreprise : ${formatKg(goal)}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
        >
          <span className="block h-full rounded-full bg-[#cfe3c4] transition-[width] duration-1000" style={{ width: `${Math.max(pct, kg > 0 ? 3 : 0)}%` }} />
        </span>
        <span className="flex justify-between text-xs text-[#ddebd3]">
          <span>{left > 0 ? `Plus que ${formatKg(left)} avant l'objectif` : "Objectif atteint !"}</span>
          <span className="font-bold">{formatKg(goal)}</span>
        </span>
      </span>
      <span className="rounded-[14px] bg-black/[0.18] px-3 py-2.5 text-[13px]">
        Dont <strong className="text-[#f7f1e3]">{formatKg(Number(pulse.my_kg))} grâce à toi</strong>
        {pulse.team_rank && pulse.team_size && pulse.team_size > 1 ? ` · ${pulse.team_rank === 1 ? "1er" : `${pulse.team_rank}e`} de ton équipe` : ""}
      </span>
    </Link>
  );
}
