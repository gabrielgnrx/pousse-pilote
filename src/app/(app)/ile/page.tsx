import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { getIsland } from "@/lib/game/data.ts";
import { IslandGame } from "@/components/island/IslandGame";

export const metadata = { title: "Ton île · Pousse" };

/** L'île : chaque action donne une graine à planter. */
export default async function IlePage() {
  const { supabase, user } = await requireProfile();
  const data = await getIsland(supabase, user.id);
  if (!data) notFound();
  return <IslandGame initial={data} mine />;
}
