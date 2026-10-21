"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatKg } from "@/lib/co2/challenges.ts";
import { levelFor } from "@/lib/co2/engagement.ts";

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
      previous = raw !== null && Number.isFinite(Number(raw)) ? Number(raw) : target;
      window.localStorage.setItem(storageKey, String(target));
    } catch {
      return;
    }
    if (previous >= target || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setShown(previous);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1200);
      setShown(previous + (target - previous) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, storageKey]);
  return shown;
}

const RING = 2 * Math.PI * 23;

/**
 * La barre du haut, façon jeu : ton niveau autour de ton avatar, tes pousses, ta série,
 * et juste en dessous la jauge de toute l'entreprise. Présente sur toutes les pages.
 */
export function ProgressHud({
  initial,
  total,
  streak,
  notifications,
  company,
}: {
  initial: string;
  total: number;
  streak: number;
  notifications: number;
  company: { name: string; kg: number; goalKg: number } | null;
}) {
  const level = levelFor(total);
  const pousses = Math.round(useCountUp(total, "pousse.hud.total"));
  const kg = useCountUp(company?.kg ?? 0, "pousse.hud.kg");
  const pct = company && company.goalKg > 0 ? Math.min(100, (company.kg / company.goalKg) * 100) : 0;

  return (
    <header className="flex flex-col gap-2.5 px-4 pt-3.5 pb-2">
      <div className="flex items-center gap-2.5">
        <Link
          href="/profil"
          aria-label={`Ton profil : niveau ${level.index + 1}, ${level.name}, ${total} pousses${level.next ? ` sur ${level.next.min}` : ""}`}
          className="relative size-[52px] shrink-0"
        >
          <svg aria-hidden="true" width="52" height="52" viewBox="0 0 52 52" className="absolute inset-0">
            <circle cx="26" cy="26" r="23" fill="none" stroke="#e6dcc6" strokeWidth="5" />
            <circle
              cx="26"
              cy="26"
              r="23"
              fill="none"
              stroke="#2f6b3a"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={RING}
              strokeDashoffset={RING * (1 - Math.max(0.03, level.progress))}
              transform="rotate(-90 26 26)"
              className="transition-[stroke-dashoffset] duration-1000"
            />
          </svg>
          <span className="absolute inset-[7px] flex items-center justify-center rounded-full bg-abricot font-display text-[17px] font-bold text-[#402a16]">
            {initial}
          </span>
          <span className="absolute -right-1 -bottom-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#f4e8d0] bg-sapin px-1 text-[11px] font-bold text-sapin-clair">
            {level.index + 1}
          </span>
        </Link>

        <Link href="/jardin" className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[11px] font-bold tracking-[0.06em] text-[#5e4630] uppercase">
            Niveau {level.index + 1} · {level.name}
          </span>
          <span className="flex items-baseline gap-1">
            <span className="font-display text-xl font-bold tabular-nums">{pousses.toLocaleString("fr-FR")}</span>
            <span className="truncate text-xs text-terre">
              {level.next ? `/ ${level.next.min.toLocaleString("fr-FR")} pousses` : "pousses · niveau max"}
            </span>
          </span>
        </Link>

        <Link
          href="/profil#pousses"
          aria-label={`Série de ${streak} jour${streak > 1 ? "s" : ""} d'affilée`}
          className="flex h-[38px] items-center gap-1.5 rounded-full bg-sable px-3 text-sm font-bold text-brun"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill={streak > 0 ? "#f0a97b" : "none"} stroke="#c15f2c" strokeWidth="2">
            <path d="M12 2c2 4-2 5-2 8a4 4 0 1 0 8 0c0-2-1-3-2-4 1 3-1 4-2 3 1-2-1-3-2-7Z" />
          </svg>
          {streak}
        </Link>
        <Link
          href="/notifications"
          aria-label={notifications ? `Notifications, ${notifications} nouvelle${notifications > 1 ? "s" : ""}` : "Notifications"}
          className="relative flex size-[38px] shrink-0 items-center justify-center rounded-full bg-sable"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a4030" strokeWidth="1.8">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          {notifications ? <span className="absolute top-1.5 right-2 size-2.5 rounded-full bg-argile" /> : null}
        </Link>
      </div>

      {company ? (
        <Link href="/equipes/classement" className="flex items-center gap-2.5 rounded-[14px] bg-[#2f5b36] px-3 py-2 text-[#f7f1e3]">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cfe3c4" strokeWidth="2" strokeLinecap="round">
            <path d="M3 21h18M5 21V10l7-6 7 6v11" />
            <path d="M10 21v-5h4v5" />
          </svg>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex justify-between gap-2 text-xs">
              <span className="truncate font-bold">
                {company.name} · <span className="tabular-nums">{formatKg(kg)}</span> de CO₂ évités (déclaré)
              </span>
              <span className="shrink-0 text-[#cfe3c4]">{Math.round(pct)} %</span>
            </span>
            <span
              className="h-1.5 overflow-hidden rounded-full bg-white/[0.18]"
              role="progressbar"
              aria-label={`Objectif de l'entreprise : ${formatKg(company.goalKg)}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pct)}
            >
              <span className="block h-full rounded-full bg-abricot transition-[width] duration-1000" style={{ width: `${Math.max(pct, company.kg > 0 ? 3 : 0)}%` }} />
            </span>
          </span>
        </Link>
      ) : null}
    </header>
  );
}
