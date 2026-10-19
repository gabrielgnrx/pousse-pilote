import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { getGarden } from "@/lib/game/data.ts";
import { GardenView } from "@/components/GardenView";

export const metadata = { title: "Jardin · Pousse" };

/** Le jardin d'un collègue (même entreprise uniquement, vérifié par la base). */
export default async function ColleagueGardenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireProfile();
  if (id === user.id) redirect("/jardin");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await getGarden(supabase, id);
  if (!data) notFound();
  return <GardenView data={data} mine={false} />;
}
