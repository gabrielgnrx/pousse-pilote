import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pushConfig, sendEmptyPush } from "@/lib/push";

/**
 * Rappel de fin d'après-midi (Vercel Cron, vercel.json) aux personnes qui ont activé les rappels et
 * n'ont encore rien fait aujourd'hui. Pas de clé secrète Supabase : la base vérifie elle-même
 * CRON_SECRET (son empreinte est dans la table cron_keys).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const push = pushConfig();
  if (!secret || !push) {
    return NextResponse.json({ skipped: "CRON_SECRET ou clés VAPID manquants" });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data: due, error } = await db.rpc("reminders_due", { p_token: secret });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (due ?? []) as { endpoint: string; streak: number }[];
  const results = await Promise.all(rows.map(async (r) => [r.endpoint, await sendEmptyPush(r.endpoint, push)] as const));
  const sent = results.filter(([, s]) => s === "sent").map(([e]) => e);
  const gone = results.filter(([, s]) => s === "gone").map(([e]) => e);
  if (sent.length || gone.length) {
    await db.rpc("reminders_sent", { p_token: secret, p_sent: sent, p_gone: gone });
  }
  return NextResponse.json({ due: rows.length, sent: sent.length, gone: gone.length });
}
