"use client";
import { useEffect, useRef, useState } from "react";
import { formatKg } from "@/lib/co2/challenges.ts";
import { daysUntil } from "@/lib/dates";

export interface Pulse {
  name: string;
  kg: number;
  today_kg: number;
  active_today: number;
  participants: number;
  goal_kg: number;
  ends_on: string;
  my_kg: number;
  team_rank: number | null;
  team_size: number | null;
}

const ordinal = (n: number) => (n === 1 ? "1re" : `${n}e`);

/** Le compteur commun : le CO₂ évité par toute l'entreprise, qui défile à l'ouverture. */
export function CompanyPulse({ pulse }: { pulse: Pulse }) {
  const [shown, setShown] = useState(pulse.kg);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const key = "pousse.entreprise.kg";
    let previous = 0;
    try {
      const raw = window.localStorage.getItem(key);
      previous = raw !== null && Number.isFinite(Number(raw)) ? Number(raw) : pulse.kg * 0.85;
      window.localStorage.setItem(key, String(pulse.kg));
    } catch {
      return;
    }
    if (previous >= pulse.kg || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setShown(previous);
    const start = performance.now();
    const duration = 1400;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(previous + (pulse.kg - previous) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [pulse.kg]);

  const pct = Math.min(100, (pulse.kg / pulse.goal_kg) * 100);
  const missing = Math.max(0, pulse.goal_kg - pulse.kg);
  const daysLeft = Math.max(0, daysUntil(pulse.ends_on) + 1);
  const big = shown >= 1000 ? `${(shown / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t` : `${Math.round(shown).toLocaleString("fr-FR")} kg`;

  return (
    <section className="flex flex-col gap-3 rounded-[24px] bg-sapin p-4 text-sapin-clair" aria-labelledby="pulse-title">
      <p id="pulse-title" className="text-[11px] font-bold tracking-wider uppercase opacity-90">Ensemble chez {pulse.name}</p>
      <div>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-5xl leading-none font-bold tabular-nums">{big}</span>
          <span className="text-sm font-semibold">de CO₂ évités</span>
        </p>
        <p className="mt-2 inline-flex rounded-full bg-sauge px-2.5 py-1 text-xs font-bold text-sapin">
          {pulse.today_kg > 0 ? `+${formatKg(pulse.today_kg)} aujourd'hui` : "Pas encore d'action aujourd'hui"}
          {pulse.active_today > 0 ? ` · ${pulse.active_today} collègue${pulse.active_today > 1 ? "s" : ""} actif${pulse.active_today > 1 ? "s" : ""}` : ""}
        </p>
      </div>
      <div>
        <div className="relative h-3 rounded-full bg-white/15" role="progressbar" aria-label="Vers l'objectif de l'entreprise" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <div className="h-3 rounded-full bg-sauge transition-[width] duration-1000" style={{ width: `${Math.max(pct, pulse.kg > 0 ? 3 : 0)}%` }} />
        </div>
        <p className="mt-1.5 flex justify-between gap-2 text-xs opacity-90">
          <span>{missing > 0 ? `Plus que ${formatKg(missing)} avant l'objectif` : "Objectif atteint, bravo à tous !"}</span>
          <span className="shrink-0 font-bold">{formatKg(pulse.goal_kg)}{daysLeft > 0 ? ` · ${daysLeft} j` : ""}</span>
        </p>
      </div>
      <p className="border-t border-white/15 pt-2.5 text-sm">
        {pulse.my_kg > 0 ? (
          <>
            Dont <strong>{formatKg(pulse.my_kg)} grâce à toi</strong>
            {pulse.team_rank && pulse.team_size && pulse.team_size > 1 ? ` · ${ordinal(pulse.team_rank)} de ton équipe` : ""}
          </>
        ) : (
          "Ta première action fera avancer ce compteur : touche le bouton +."
        )}
      </p>
    </section>
  );
}
