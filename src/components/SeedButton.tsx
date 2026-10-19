"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openSeed } from "@/lib/game/actions";
import { RARE_BY_KEY } from "@/lib/game/garden.ts";
import { PlantArt } from "./PlantArt";

/** La graine mystère du jour : on la secoue, elle s'ouvre, surprise. */
export function SeedButton({ opened }: { opened?: { plant: string | null; points: number } }) {
  const [result, setResult] = useState(opened ?? null);
  const [shaking, setShaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const router = useRouter();

  const open = () => {
    setShaking(true);
    start(async () => {
      const [r] = await Promise.all([openSeed(), new Promise((ok) => setTimeout(ok, 900))]);
      setShaking(false);
      if ("error" in r) setError(r.error);
      else {
        setResult(r);
        router.refresh();
      }
    });
  };

  if (result) {
    const rare = result.plant ? RARE_BY_KEY[result.plant] : null;
    return (
      <div role="status" className="animate-pousse-pop flex items-center gap-3 rounded-xl bg-abricot px-3 py-2 text-[#402a16]">
        {rare ? <PlantArt shape={rare.shape} color={rare.color} accent={rare.accent} stage={4} size={44} /> : <span className="font-display text-2xl font-bold">+{result.points}</span>}
        <p className="flex-1 text-sm">
          {rare ? (
            <>Plante rare : <strong>{rare.name}</strong> ! Elle rejoint ton jardin.</>
          ) : (
            <>Ta graine mystère t&apos;a donné <strong>{result.points} pousses</strong>.</>
          )}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={open}
        disabled={shaking}
        className="flex min-h-12 items-center gap-3 rounded-xl bg-abricot px-3 py-2 text-left text-[#402a16]"
      >
        <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" className={shaking ? "animate-seed-shake" : "animate-seed-wobble"}>
          <ellipse cx="12" cy="13" rx="6" ry="8" fill="#8a5a33" />
          <path d="M12 5c1-2 3-3 5-3-1 2-2 3-5 3Z" fill="#6f9a3e" />
          <path d="M9 10c1 2 1 5 0 7" stroke="#b07a4a" strokeWidth="1.2" fill="none" />
        </svg>
        <span className="flex-1 text-sm">
          <strong className="block">Ta graine mystère t&apos;attend</strong>
          <span className="text-xs">+5, +10, +20 pousses… ou une plante rare</span>
        </span>
        <span className="btn-dark min-h-9 px-3.5 text-sm">{shaking ? "…" : "Ouvrir"}</span>
      </button>
      {error ? <p role="alert" className="text-xs font-semibold text-argile-fonce">{error}</p> : null}
    </div>
  );
}
