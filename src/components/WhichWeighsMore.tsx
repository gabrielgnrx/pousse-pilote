"use client";
import { useState } from "react";
import { formatKg } from "@/lib/co2/challenges.ts";
import type { Duo } from "@/lib/informer";

/** Mini-jeu : deux choses du quotidien, laquelle émet le plus de CO₂ ? Pour apprendre les ordres de grandeur. */
export function WhichWeighsMore({ duos, start }: { duos: Duo[]; start: number }) {
  const [i, setI] = useState(start % duos.length);
  const [picked, setPicked] = useState<"a" | "b" | null>(null);
  const [score, setScore] = useState({ good: 0, played: 0 });
  const duo = duos[i];
  const heavier = duo.a.kg >= duo.b.kg ? "a" : "b";

  const pick = (side: "a" | "b") => {
    if (picked) return;
    setPicked(side);
    setScore((s) => ({ good: s.good + (side === heavier ? 1 : 0), played: s.played + 1 }));
  };
  const next = () => {
    setPicked(null);
    setI((x) => (x + 1) % duos.length);
  };
  const ratio = Math.max(duo.a.kg, duo.b.kg) / Math.max(0.001, Math.min(duo.a.kg, duo.b.kg));

  return (
    <section className="flex flex-col gap-3 rounded-[20px] bg-peche p-4 text-[#3d2a0e]" aria-labelledby="lequel">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="lequel" className="text-xs font-bold tracking-wider uppercase">Lequel pèse le plus ?</h2>
        {score.played > 0 ? <span className="text-xs font-semibold">{score.good}/{score.played} trouvés</span> : <span className="text-xs">30 secondes</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["a", "b"] as const).map((side) => {
          const item = duo[side];
          const isHeavier = side === heavier;
          const tone = !picked
            ? "bg-papier"
            : isHeavier
              ? "bg-sapin text-sapin-clair"
              : "bg-papier opacity-80";
          return (
            <button
              key={side}
              type="button"
              onClick={() => pick(side)}
              aria-pressed={picked === side}
              className={`flex min-h-24 flex-col items-start justify-between gap-2 rounded-2xl p-3 text-left transition ${tone} ${picked === side ? "ring-2 ring-argile" : ""}`}
            >
              <span className="text-sm leading-snug font-bold">{item.label}</span>
              {picked ? <span className="font-display text-xl font-bold">{formatKg(item.kg)}</span> : <span className="text-xs">Toucher pour choisir</span>}
            </button>
          );
        })}
      </div>
      {picked ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm leading-snug" role="status">
            {picked === heavier ? "Bien vu ! " : "Raté ! "}
            {duo[heavier].label} pèse {ratio < 1.2 ? "à peine plus" : `environ ${ratio < 2 ? ratio.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : Math.round(ratio)} fois plus`}.
          </p>
          <button type="button" onClick={next} className="btn-dark min-h-10 shrink-0 px-4 text-sm">Suivant</button>
        </div>
      ) : (
        <p className="text-xs">Chiffres ADEME (Impact CO₂, Agribalyse), en kg de CO₂.</p>
      )}
    </section>
  );
}
