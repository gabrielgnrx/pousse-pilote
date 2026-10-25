import { NextResponse, type NextRequest } from "next/server";
import { aiDepsForCron } from "@/lib/ai/client";
import { buildPlan, parseInputs } from "@/lib/plan/service";
import { habitsFromRow, type HabitsRow } from "@/lib/session";
import { bearer, cronDb, mapLimit } from "@/lib/supabase/cron";

/**
 * Recalcul hebdomadaire de Mon plan. Appelée par la base (pg_cron, migration 0032) toutes les 10 minutes
 * le lundi matin, avec la clé « ia » : chaque appel traite un lot de personnes qui n'ont pas encore leur
 * plan de la semaine, jusqu'à ce qu'il n'en reste plus. Idempotente.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 20;

interface Pending {
  user_id: string;
  company_id: string;
  habits: Omit<HabitsRow, "user_id">;
  feasibility: unknown;
  stats: unknown;
  active_recently: boolean;
}

export async function GET(request: NextRequest) {
  const token = bearer(request);
  const db = cronDb();
  const { data, error } = await db.rpc("plan_pending", { p_token: token, p_limit: BATCH });
  if (error) {
    const status = error.message.includes("not_allowed") ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "non autorisé" : "erreur" }, { status });
  }
  const rows = (data ?? []) as Pending[];
  const results = await mapLimit(rows, 4, async (r) => {
    const habits = habitsFromRow({ ...r.habits, user_id: r.user_id } as HabitsRow);
    const { feasibility, week } = parseInputs(r);
    // Sobriété : sans activité depuis un mois, le plan des règles suffit.
    const plan = await buildPlan(habits, feasibility, week, aiDepsForCron(db, token, r.company_id), r.active_recently);
    if (!plan) return "vide";
    const { error: saveError } = await db.rpc("save_plan_for", {
      p_token: token,
      p_user: r.user_id,
      p_items: plan.items,
      p_source: plan.source,
      p_version: plan.version,
    });
    return saveError ? "erreur" : plan.source;
  });
  const count = (s: string) => results.filter((x) => x === s).length;
  return NextResponse.json({ traites: rows.length, ia: count("ia") + count("mock"), regles: count("regles"), erreurs: count("erreur") });
}
