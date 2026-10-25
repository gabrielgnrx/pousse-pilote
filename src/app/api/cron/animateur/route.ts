import { NextResponse, type NextRequest } from "next/server";
import { aiDepsForCron } from "@/lib/ai/client";
import { composeMessage } from "@/lib/animateur/compose";
import { factsFor, type Due } from "@/lib/animateur/facts";
import { fetchTomorrow, goodForBike } from "@/lib/animateur/weather";
import { bearer, cronDb, mapLimit } from "@/lib/supabase/cron";

/**
 * L'animateur du QG. Appelée par la base (pg_cron, migration 0035) toutes les 10 minutes en journée,
 * avec la clé « ia ». La base dit ce qui est dû (animator_due) et refuse tout message en trop
 * (animator_post : un message fixe par créneau, au plus un message spontané par jour et par équipe).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const token = bearer(request);
  const db = cronDb();
  const { data, error } = await db.rpc("animator_due", { p_token: token });
  if (error) {
    const status = error.message.includes("not_allowed") ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "non autorisé" : "erreur" }, { status });
  }
  const due = (data ?? []) as Due[];

  // Météo de demain : une seule requête par passage, et seulement si une équipe peut en parler.
  const meteo = due.find((d) => d.slot === "meteo");
  const tomorrow = meteo ? await fetchTomorrow(String(meteo.context.tomorrow)) : null;
  const sunny = tomorrow && goodForBike(tomorrow) ? { goodForBike: true, tempMax: tomorrow.tempMax } : null;

  const results = await mapLimit(due, 3, async (d) => {
    // Pas de beau temps demain, ou personne en voiture dans l'équipe : rien à dire.
    if (d.slot === "meteo" && (!sunny || !(Number(d.context.car_commuters) > 0))) return "sans_objet";
    const facts = factsFor(d, sunny);
    const { text, source } = await composeMessage(facts, aiDepsForCron(db, token, d.company_id));
    const meta = d.slot === "vote_open" ? { rank: d.context.rank ?? null, source } : { source };
    const { data: posted, error: postError } = await db.rpc("animator_post", {
      p_token: token,
      p_team: d.team_id,
      p_slot: d.slot,
      p_ref: d.ref,
      p_body: text,
      p_meta: meta,
    });
    if (postError) return "erreur";
    return posted ? source : "deja_dit";
  });
  const count = (s: string) => results.filter((r) => r === s).length;
  return NextResponse.json({ dus: due.length, ia: count("ia"), gabarits: count("gabarit"), erreurs: count("erreur") });
}
