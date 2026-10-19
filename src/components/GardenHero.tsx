"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { LEVELS, levelFor } from "@/lib/co2/engagement.ts";
import { Plant } from "./Plant";
import { PousseCounter } from "./PousseCounter";

const FALLING = [
  { left: "12%", dx: "18px", rot: "200deg", delay: "0s" },
  { left: "30%", dx: "-14px", rot: "-160deg", delay: "0.15s" },
  { left: "48%", dx: "10px", rot: "240deg", delay: "0.05s" },
  { left: "66%", dx: "-20px", rot: "-220deg", delay: "0.25s" },
  { left: "82%", dx: "16px", rot: "180deg", delay: "0.1s" },
  { left: "92%", dx: "-8px", rot: "-200deg", delay: "0.3s" },
];

/** Le haut de l'accueil, compact : ta plante, ton total qui monte, ton niveau, ta série et ton dernier gain. */
export function GardenHero({
  total,
  week,
  streak,
  nextMilestone,
  last,
}: {
  total: number;
  week: number;
  streak: number;
  nextMilestone: { days: number; pousses: number } | null;
  /** Le dernier gain (« when » calculé côté serveur, pour éviter un décalage à l'hydratation). */
  last?: { label: string; points: number; when: string };
}) {
  const level = levelFor(total);
  const [levelUp, setLevelUp] = useState<string | null>(null);

  const onDelta = useCallback((_delta: number, previous: number) => {
    const before = levelFor(previous).index;
    const after = levelFor(previous + _delta).index;
    if (after > before) setLevelUp(LEVELS[after].name);
  }, []);

  return (
    <section className="relative overflow-hidden rounded-[24px] bg-sapin px-4 pt-3.5 pb-3 text-sapin-clair" aria-label="Tes pousses">
      {levelUp ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {FALLING.map((f, i) => (
            <svg
              key={i}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              className="animate-leaf-fall absolute top-0"
              style={{ left: f.left, animationDelay: f.delay, ["--dx" as string]: f.dx, ["--rot" as string]: f.rot }}
            >
              <path d="M12 2C6 6 4 12 6 20c8-2 12-8 6-18Z" fill={i % 2 ? "#b5c890" : "#f0a97b"} />
            </svg>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Link href="/jardin" aria-label="Voir mon jardin" className="shrink-0 rounded-2xl bg-white/10 p-1">
          <Plant level={level.index} size={60} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2">
            <span className="font-display text-4xl leading-none font-bold">
              <PousseCounter total={total} storageKey="pousse.accueil.total" onDelta={onDelta} />
            </span>
            <span className="text-sm font-semibold">pousses</span>
          </p>
          <p className="mt-1 text-sm">
            <strong>{level.name}</strong>
            {week > 0 ? <span className="opacity-90"> · +{week} cette semaine</span> : null}
          </p>
        </div>
        <p
          className="flex shrink-0 flex-col items-center rounded-xl bg-white/10 px-2.5 py-1.5 text-center"
          title={nextMilestone ? `Bonus de +${nextMilestone.pousses} pousses à ${nextMilestone.days} jours` : undefined}
        >
          <span className="flex items-center gap-1 font-display text-xl leading-none font-bold">
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill={streak > 0 ? "#f0a97b" : "none"} stroke="#f0a97b" strokeWidth="2">
              <path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10Z" />
            </svg>
            {streak}
          </span>
          <span className="text-[10px] font-semibold uppercase">{streak > 1 ? "jours" : "jour"} d&apos;affilée</span>
        </p>
      </div>

      {levelUp ? (
        <p role="status" className="animate-pousse-pop mt-2.5 rounded-xl bg-abricot px-3 py-2 text-center text-sm font-bold text-[#402a16]">
          Nouveau niveau : {levelUp} !
        </p>
      ) : null}

      <div className="mt-2.5">
        <div className="h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Vers le niveau suivant" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level.progress * 100)}>
          <div className="h-2 rounded-full bg-abricot transition-[width] duration-1000" style={{ width: `${Math.max(3, level.progress * 100)}%` }} />
        </div>
        <p className="mt-1 flex justify-between gap-2 text-xs opacity-90">
          <span>{level.next ? `Encore ${level.next.missing} pour devenir ${level.next.name}` : "Niveau maximum : tu es une forêt !"}</span>
          {nextMilestone && streak > 0 ? <span className="shrink-0">+{nextMilestone.pousses} à {nextMilestone.days} j</span> : null}
        </p>
      </div>

      {last ? (
        <Link href="/profil#pousses" className="mt-2 flex items-center gap-2 border-t border-white/15 pt-2 text-xs">
          <span className="rounded-full bg-abricot px-1.5 py-0.5 font-bold text-[#402a16]">+{last.points}</span>
          <span className="min-w-0 flex-1 truncate">{last.label}</span>
          <span className="shrink-0 opacity-80">{last.when} ›</span>
        </Link>
      ) : (
        <p className="mt-2 border-t border-white/15 pt-2 text-xs opacity-90">Lance ta série aujourd&apos;hui : +10 pousses au 3e jour d&apos;affilée.</p>
      )}
    </section>
  );
}
