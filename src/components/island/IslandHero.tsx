"use client";
import type { IslandData } from "@/lib/game/island.ts";
import { IslandProvider } from "./IslandProvider";
import { IslandControls } from "./IslandControls";

/**
 * Le haut de l'accueil : ton île, animée et jouable sur place (choisir une graine, toucher une case,
 * planter). L'en-tête flotte dessus et le fil remonte dessous en feuille (page Fil).
 */
export function IslandHero({ data }: { data: IslandData }) {
  return (
    <IslandProvider initial={data} framing="hero">
      <IslandControls top={72} bottom={68} compact />
    </IslandProvider>
  );
}
