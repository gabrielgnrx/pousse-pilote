import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { getGarden } from "@/lib/game/data.ts";
import { GardenView } from "@/components/GardenView";

export const metadata = { title: "Ton jardin · Pousse" };

export default async function JardinPage() {
  const { supabase, user } = await requireProfile();
  const data = await getGarden(supabase, user.id);
  if (!data) notFound();
  return <GardenView data={data} mine />;
}
