import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { getIsland } from "@/lib/game/data.ts";
import { IslandProvider } from "@/components/island/IslandProvider";
import { IslandControls } from "@/components/island/IslandControls";

export const metadata = { title: "Ton île · Pousse" };

/** L'accueil : ton île, où chaque action enregistrée donne une graine à planter. */
export default async function IlePage() {
  const { supabase, user } = await requireProfile();
  const data = await getIsland(supabase, user.id);
  if (!data) notFound();
  return (
    <IslandProvider initial={data}>
      <IslandControls />
    </IslandProvider>
  );
}
