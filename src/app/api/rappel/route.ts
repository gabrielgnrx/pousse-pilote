import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reminderText } from "@/lib/push";

/** Lu par le téléphone quand un rappel arrive : le texte, calculé avec la session de la personne. */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_reminder");
  const state = data as { streak: number; active_today: boolean } | null;
  if (state?.active_today) {
    return NextResponse.json({ title: "Ta journée compte déjà", body: "Ta série continue. À demain !", url: "/fil" });
  }
  return NextResponse.json({ ...reminderText(state?.streak ?? 0), url: "/fil" });
}
