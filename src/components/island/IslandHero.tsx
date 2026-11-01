"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { STAGE_NAMES } from "@/lib/game/garden.ts";
import { lookOf, seedsOf, type IslandData } from "@/lib/game/island.ts";
import type { IslandScene } from "./scene.ts";

/**
 * Le haut de l'accueil : ton île, animée, sous l'en-tête. Le fil remonte dessus en feuille (page Fil).
 * Toucher l'île ou le bouton ouvre l'île en grand pour planter.
 */
export function IslandHero({ data }: { data: IslandData }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const seeds = seedsOf(data).reduce((n, s) => n + s.available, 0);

  useEffect(() => {
    let disposed = false;
    let scene: IslandScene | null = null;
    import("./scene.ts")
      .then(({ createIslandScene }) => {
        if (disposed || !hostRef.current) return;
        scene = createIslandScene(hostRef.current, { onTileTap: () => {}, onEmptyTap: () => {} }, "hero");
        scene.setPlants(data.plants);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      scene?.dispose();
    };
  }, [data]);

  const described = data.plants
    .map((p) => {
      const l = lookOf(p);
      return l ? `${l.name} (${STAGE_NAMES[l.stage]})` : "";
    })
    .filter(Boolean)
    .join(", ");

  return (
    <section aria-label="Ton île" className="relative -mx-4 h-[400px] overflow-hidden bg-[#8ecbe0]">
      {failed ? null : <div ref={hostRef} aria-hidden="true" className="absolute inset-0" />}
      <Link
        href="/ile"
        className="absolute inset-0"
        aria-label={data.plants.length ? `Ouvrir ton île : ${described}` : "Ouvrir ton île, encore vide"}
      />
      <Link
        href="/ile"
        className="absolute right-4 bottom-16 flex min-h-12 items-center gap-2 rounded-full bg-pollen py-1.5 pr-4 pl-1.5 font-bold text-encre shadow-[0_6px_16px_rgba(20,38,27,0.22)] transition active:scale-[0.97]"
      >
        {seeds ? (
          <>
            <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-nuit px-2 text-sm text-pollen-pale tabular-nums">{seeds}</span>
            Planter mes graines
          </>
        ) : (
          <span className="pl-2.5">Voir mon île</span>
        )}
      </Link>
    </section>
  );
}
