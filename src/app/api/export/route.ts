import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Export RGPD : toutes les données de la personne connectée, en JSON. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "non connecté" }, { status: 401 });

  const [profile, footprints, habits, challenges, validations, cheers, checkins, points, scans, swaps] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("footprints").select("*").eq("user_id", user.id),
    supabase.from("habits").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_challenges").select("*").eq("user_id", user.id),
    supabase.from("validations").select("*").eq("user_id", user.id),
    supabase.from("cheers").select("*").eq("user_id", user.id),
    supabase.from("habit_checkins").select("*").eq("user_id", user.id),
    supabase.from("points_ledger").select("*").eq("user_id", user.id),
    supabase.from("product_scans").select("*").eq("user_id", user.id),
    supabase.from("product_swaps").select("*").eq("user_id", user.id),
  ]);

  const body = {
    exported_at: new Date().toISOString(),
    email: user.email,
    profile: profile.data,
    footprints: footprints.data,
    habits: habits.data,
    challenges: challenges.data,
    validations: validations.data,
    cheers_given: cheers.data,
    habits_kept: checkins.data,
    points: points.data,
    product_scans: scans.data,
    product_swaps: swaps.data,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pousse-mes-donnees.json"',
    },
  });
}
