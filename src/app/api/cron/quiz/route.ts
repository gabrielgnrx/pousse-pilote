import { NextResponse, type NextRequest } from "next/server";
import { aiDepsForCron } from "@/lib/ai/client";
import { QUIZ_GENERATE_VERSION } from "@/lib/ai/prompts/quiz";
import { weekStart } from "@/lib/co2/engagement";
import { todayParis } from "@/lib/dates";
import { getDailyGoodNews } from "@/lib/news";
import { generateWeeklyQuiz } from "@/lib/quiz/generate";
import { ficheSources, newsSources } from "@/lib/quiz/sources";
import { bearer, cronDb } from "@/lib/supabase/cron";

/**
 * Génère le quiz de la semaine (le lundi matin, pg_cron, migration 0037, clé « ia ») à partir des fiches
 * et des bonnes nouvelles de la semaine. Seules les questions relues sont enregistrées.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const token = bearer(request);
  const db = cronDb();
  const week = weekStart(todayParis());
  // La clé est vérifiée par la base dès le premier appel (une semaine déjà remplie n'est pas refaite).
  const { data: probe, error: probeError } = await db.rpc("quiz_week_insert", { p_token: token, p_week: week, p_questions: [], p_version: "verification" });
  if (probeError) {
    const status = probeError.message.includes("not_allowed") ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "non autorisé" : "erreur" }, { status });
  }
  if (probe === -1) return NextResponse.json({ semaine: week, deja_fait: true });

  const sources = [...ficheSources(week), ...newsSources(await getDailyGoodNews())];
  const run = await generateWeeklyQuiz(sources, aiDepsForCron(db, token, null));
  if (run.questions.length === 0) {
    return NextResponse.json({ semaine: week, generees: run.generated, gardees: 0, rejetees: run.rejected.length });
  }
  const { data: saved, error } = await db.rpc("quiz_week_insert", {
    p_token: token,
    p_week: week,
    p_questions: run.questions,
    p_version: QUIZ_GENERATE_VERSION,
  });
  if (error) return NextResponse.json({ error: "enregistrement impossible" }, { status: 500 });
  return NextResponse.json({ semaine: week, generees: run.generated, gardees: saved, rejetees: run.rejected.length });
}
