import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pushConfig, sendEmptyPush } from "@/lib/push";
import { bearer } from "@/lib/supabase/cron";

/**
 * Rappel de fin d'après-midi aux personnes qui ont activé les rappels et n'ont encore rien fait
 * aujourd'hui. Appelée par la base (pg_cron, migration 0044) avec la clé « rappels » : la base la
 * vérifie elle-même (son empreinte est dans cron_keys), aucun secret n'est à copier dans Vercel.
 */
export async function GET(request: NextRequest) {
  const push = pushConfig();
  if (!push) return NextResponse.json({ skipped: "clés VAPID manquantes" });
  const secret = bearer(request);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data: due, error } = await db.rpc("reminders_due", { p_token: secret });
  if (error) {
    const status = error.message.includes("forbidden") ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "non autorisé" : "erreur" }, { status });
  }

  const rows = (due ?? []) as { endpoint: string; streak: number }[];
  const results = await Promise.all(rows.map(async (r) => [r.endpoint, await sendEmptyPush(r.endpoint, push)] as const));
  const sent = results.filter(([, s]) => s === "sent").map(([e]) => e);
  const gone = results.filter(([, s]) => s === "gone").map(([e]) => e);
  if (sent.length || gone.length) {
    await db.rpc("reminders_sent", { p_token: secret, p_sent: sent, p_gone: gone });
  }
  return NextResponse.json({ due: rows.length, sent: sent.length, gone: gone.length });
}
