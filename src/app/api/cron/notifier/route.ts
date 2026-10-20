import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pushConfig, sendEmptyPush } from "@/lib/push";

/**
 * Notifications ciblées (invitation en duel, vote ouvert, défi qui se termine…). Appelée toutes les
 * 5 minutes par la base elle-même (pg_cron, 0019_planification.sql) avec sa propre clé : c'est la base
 * qui la vérifie (empreinte dans cron_keys), aucun secret à configurer dans Vercel.
 * Comme le rappel du jour, la notification part vide ; le téléphone lit le texte sur /api/rappel.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const push = pushConfig();
  if (!push) return NextResponse.json({ skipped: "clés VAPID manquantes" });
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data: due, error } = await db.rpc("alerts_due", { p_token: token });
  if (error) {
    const status = error.message === "forbidden" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "non autorisé" : error.message }, { status });
  }

  const rows = (due ?? []) as { endpoint: string; user_id: string }[];
  const results = await Promise.all(rows.map(async (r) => ({ ...r, status: await sendEmptyPush(r.endpoint, push) })));
  const users = [...new Set(results.filter((r) => r.status === "sent").map((r) => r.user_id))];
  const gone = results.filter((r) => r.status === "gone").map((r) => r.endpoint);
  if (users.length || gone.length) {
    await db.rpc("alerts_pushed", { p_token: token, p_users: users, p_gone: gone });
  }
  return NextResponse.json({ due: rows.length, users: users.length, gone: gone.length });
}
