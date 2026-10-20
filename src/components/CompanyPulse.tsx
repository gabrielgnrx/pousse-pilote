"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatKg } from "@/lib/co2/challenges.ts";
import { levelFor } from "@/lib/co2/engagement.ts";

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

function bigKg(kg: number) {
  return kg >= 1000
    ? { value: `${(kg / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t`, unit: "de CO₂ évitées (déclaré)" }
    : { value: `${Math.round(kg).toLocaleString("fr-FR")} kg`, unit: "de CO₂ évités (déclaré)" };
}

/** Fait défiler un nombre depuis la dernière valeur vue sur cet appareil. */
function useCountUp(target: number, storageKey: string) {
  const [shown, setShown] = useState(target);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    let previous = target;
    try {
      const raw = window.localStorage.getItem(storageKey);
      previous = raw !== null && Number.isFinite(Number(raw)) ? Number(raw) : target * 0.85;
      window.localStorage.setItem(storageKey, String(target));
    } catch {
      return;
    }
    if (previous >= target || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setShown(previous);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1400);
      setShown(previous + (target - previous) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, storageKey]);
  return shown;
}

/**
 * Le haut de l'accueil : le CO₂ évité par toute l'entreprise (qui défile à l'ouverture),
 * l'objectif commun, ta plante et ta part de l'effort.
 */
export function CompanyPulse({ pulse, total, today }: { pulse: Pulse; total: number; today: number }) {
  const kg = useCountUp(pulse.kg, "pousse.entreprise.kg");
  const pousses = Math.round(useCountUp(total, "pousse.accueil.total"));
  const level = levelFor(total);
  const big = bigKg(kg);
  const pct = Math.min(100, (pulse.kg / pulse.goal_kg) * 100);
  const missing = Math.max(0, pulse.goal_kg - pulse.kg);

  return (
    <section className="flex flex-col gap-3.5 rounded-[24px] bg-[#2f5b36] p-[18px] text-[#f7f1e3]" aria-labelledby="pulse-title">
      <div className="flex flex-col gap-0.5">
        <p id="pulse-title" className="text-xs font-bold tracking-[0.08em] text-[#cfe3c4] uppercase">Ensemble chez {pulse.name}</p>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-[52px] leading-none font-bold tabular-nums">{big.value}</span>
          <span className="text-[15px] font-semibold text-[#ddebd3]">{big.unit}</span>
        </p>
        <p className="mt-1.5 self-start rounded-full bg-[#cfe3c4] px-2.5 py-1 text-[13px] font-bold text-[#1e4527]">
          {pulse.today_kg > 0 ? `+${formatKg(pulse.today_kg)} aujourd'hui` : "Pas encore d'action aujourd'hui"}
          {pulse.active_today > 0
            ? ` · ${pulse.active_today} collègue${pulse.active_today > 1 ? "s" : ""} actif${pulse.active_today > 1 ? "s" : ""}`
            : ""}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="relative h-3 rounded-full bg-white/[0.18]" role="progressbar" aria-label="Vers l'objectif de l'entreprise" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <div className="h-full rounded-full bg-[#cfe3c4] transition-[width] duration-1000" style={{ width: `${pct}%` }} />
          <span
            aria-hidden="true"
            className="absolute -top-1 -ml-2.5 size-5 rounded-full border-[3px] border-[#2f5b36] bg-[#f7f1e3]"
            style={{ left: `${Math.max(2, pct)}%` }}
          />
        </div>
        <p className="flex justify-between gap-2 text-xs text-[#ddebd3]">
          <span>{missing > 0 ? `Plus que ${formatKg(missing)} avant l'objectif` : "Objectif atteint, bravo à tous !"}</span>
          <span className="font-bold">{formatKg(pulse.goal_kg)}</span>
        </p>
      </div>

      <Link href="/jardin" className="flex items-center gap-3 rounded-2xl bg-black/[0.18] p-3" aria-label={`Ma plante : ${level.name}, ${total} pousses`}>
        <span
          className="flex size-[52px] shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(#cfe3c4 0 ${level.progress * 100}%, rgba(255,255,255,0.2) ${level.progress * 100}% 100%)` }}
        >
          <span className="flex size-[42px] items-center justify-center rounded-full bg-[#264a2c]">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#cfe3c4" strokeWidth="2" strokeLinecap="round">
              <path d="M12 21V11" />
              <path d="M12 11C12 7 9 5 5 5c0 4 3 6 7 6Z" />
              <path d="M12 13c0-3 2-5 6-5 0 3-2 5-6 5Z" />
            </svg>
          </span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-bold">
            {level.name} · <span className="tabular-nums">{pousses.toLocaleString("fr-FR")}</span> pousses
          </span>
          <span className="text-xs text-[#ddebd3]">
            {level.next ? `Encore ${level.next.missing} pour devenir ${level.next.name}` : "Niveau maximum : tu es une forêt !"}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="text-[15px] font-bold text-[#cfe3c4]">{today >= 0 ? `+${today}` : today}</span>
          <span className="text-[11px] text-[#ddebd3]">aujourd&apos;hui</span>
        </span>
      </Link>

      <p className="text-[13px] text-[#ddebd3]">
        {pulse.my_kg > 0 ? (
          <>
            Dont <strong className="text-[#f7f1e3]">{formatKg(pulse.my_kg)} grâce à toi</strong>
            {pulse.team_rank && pulse.team_size && pulse.team_size > 1 ? ` · ${ordinal(pulse.team_rank)} de ton équipe` : ""}
          </>
        ) : (
          "Ta première action fera avancer ce compteur : touche le bouton +."
        )}
      </p>
    </section>
  );
}
