import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reminderText } from "@/lib/push";

/**
 * Lu par le téléphone quand une notification arrive : l'alerte qui vient de partir (duel, vote…),
 * sinon le rappel du jour. Le texte est calculé avec la session de la personne.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: alert } = await supabase.rpc("my_latest_alert");
  if (alert) return NextResponse.json(alert);

  const { data } = await supabase.rpc("my_reminder");
  const state = data as { streak: number; active_today: boolean } | null;
  if (state?.active_today) {
    return NextResponse.json({ title: "Ta journée compte déjà", body: "Ta série continue. À demain !", url: "/fil" });
  }
  return NextResponse.json({ ...reminderText(state?.streak ?? 0), url: "/fil" });
}
