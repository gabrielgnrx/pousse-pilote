"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Compteur de pousses : il monte depuis la dernière valeur vue sur cet appareil, et fait
 * s'envoler un « +N ». La mémoire est locale (confort d'affichage) ; le vrai total vient du serveur.
 */
export function PousseCounter({
  total,
  storageKey,
  className = "",
  onDelta,
}: {
  total: number;
  storageKey: string;
  className?: string;
  onDelta?: (delta: number, previous: number) => void;
}) {
  const [shown, setShown] = useState(total);
  const [delta, setDelta] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    let previous = total;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw !== null && Number.isFinite(Number(raw))) previous = Number(raw);
      window.localStorage.setItem(storageKey, String(total));
    } catch {
      /* stockage indisponible : on affiche le total sans animation */
    }
    const diff = total - previous;
    if (diff <= 0) return;
    onDelta?.(diff, previous);
    setDelta(diff);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    setShown(previous);
    const start = performance.now();
    const duration = Math.min(1600, 500 + diff * 12);
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(previous + diff * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [total, storageKey, onDelta]);

  return (
    <span className={`relative inline-block tabular-nums ${className}`}>
      <span key={delta} className={delta > 0 ? "animate-pousse-pop inline-block" : "inline-block"}>
        {shown.toLocaleString("fr-FR")}
      </span>
      {delta > 0 ? (
        <span
          aria-hidden="true"
          className="animate-pousse-float pointer-events-none absolute -top-3 left-full ml-1 rounded-full bg-abricot px-1.5 py-0.5 font-sans text-xs font-bold whitespace-nowrap text-[#402a16]"
        >
          +{delta}
        </span>
      ) : null}
      {delta > 0 ? <span className="sr-only">, dont {delta} nouvelles pousses</span> : null}
    </span>
  );
}
