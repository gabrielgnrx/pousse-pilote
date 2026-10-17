"use client";
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

/** Le haut de l'accueil : ta plante, ton total de pousses qui monte, ton niveau, ta série. */
export function GardenHero({
  total,
  week,
  streak,
  nextMilestone,
}: {
  total: number;
  week: number;
  streak: number;
  nextMilestone: { days: number; pousses: number } | null;
}) {
  const level = levelFor(total);
  const [levelUp, setLevelUp] = useState<string | null>(null);

  const onDelta = useCallback((_delta: number, previous: number) => {
    const before = levelFor(previous).index;
    const after = levelFor(previous + _delta).index;
    if (after > before) setLevelUp(LEVELS[after].name);
  }, []);

  return (
    <section className="relative overflow-hidden rounded-[24px] bg-sapin p-4 text-sapin-clair" aria-label="Tes pousses">
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
        <div className="shrink-0 rounded-2xl bg-white/10 p-1.5">
          <Plant level={level.index} size={84} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold tracking-wider uppercase opacity-90">Tes pousses</p>
          <p className="font-display text-5xl leading-none font-bold">
            <PousseCounter total={total} storageKey="pousse.accueil.total" onDelta={onDelta} />
          </p>
          <p className="mt-1.5 text-sm font-semibold">
            Niveau {level.name}
            {week > 0 ? <span className="font-normal opacity-90"> · +{week} cette semaine</span> : null}
          </p>
        </div>
      </div>

      {levelUp ? (
        <p role="status" className="animate-pousse-pop mt-3 rounded-xl bg-abricot px-3 py-2 text-center text-sm font-bold text-[#402a16]">
          Nouveau niveau : {levelUp} !
        </p>
      ) : null}

      <div className="mt-3">
        <div className="h-2.5 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Vers le niveau suivant" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level.progress * 100)}>
          <div className="h-2.5 rounded-full bg-abricot transition-[width] duration-1000" style={{ width: `${Math.max(3, level.progress * 100)}%` }} />
        </div>
        <p className="mt-1 text-xs opacity-90">
          {level.next ? `Encore ${level.next.missing} pousses pour devenir ${level.next.name}` : "Niveau maximum : tu es une forêt !"}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill={streak > 0 ? "#f0a97b" : "none"} stroke="#f0a97b" strokeWidth="2">
          <path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10Z" />
        </svg>
        <p className="text-sm">
          {streak > 0 ? (
            <>
              <strong>{streak} jour{streak > 1 ? "s" : ""} d&apos;affilée</strong>
              {nextMilestone ? ` · bonus de +${nextMilestone.pousses} à ${nextMilestone.days} jours` : " · série légendaire"}
            </>
          ) : (
            <>Lance ta série aujourd&apos;hui : +10 pousses au 3e jour d&apos;affilée</>
          )}
        </p>
      </div>
    </section>
  );
}
