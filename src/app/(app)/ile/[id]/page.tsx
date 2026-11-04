import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { getIsland } from "@/lib/game/data.ts";
import { IslandProvider } from "@/components/island/IslandProvider";
import { IslandControls } from "@/components/island/IslandControls";

export const metadata = { title: "Île · Pousse" };

/** L'île d'un collègue, en visite (même entreprise uniquement, vérifié par la base). */
export default async function ColleagueIslandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireProfile();
  if (id === user.id) redirect("/ile");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await getIsland(supabase, id);
  if (!data) notFound();
  return (
    <IslandProvider initial={data} mine={false}>
      <IslandControls />
    </IslandProvider>
  );
}
