import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { getMyIsland } from "@/lib/game/data.ts";
import { IslandProvider } from "@/components/island/IslandProvider";
import { IslandControls } from "@/components/island/IslandControls";

export const metadata = { title: "Ton île · Pousse" };

/** Ton île en grand : planter les espèces débloquées et les faire grandir avec ses pousses. */
export default async function IlePage({ searchParams }: { searchParams: Promise<{ planter?: string }> }) {
  const { planter } = await searchParams;
  const { supabase, user } = await requireProfile();
  const data = await getMyIsland(supabase, user.id);
  if (!data) notFound();
  // « Planter » depuis la Serre : l'espèce est déjà choisie, ses cases s'allument.
  const initialSeed = planter && /^[a-z_]{2,30}$/.test(planter) && (data.unlocked ?? []).includes(planter) ? planter : null;
  return (
    <IslandProvider initial={data} initialSeed={initialSeed}>
      <IslandControls />
    </IslandProvider>
  );
}
