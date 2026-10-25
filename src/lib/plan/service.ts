/**
 * Calcul du plan de la semaine : règles déterministes, puis formulation par le coach IA si possible.
 * Utilisé par la page Mon plan (à la première visite de la semaine) et par la tâche planifiée du lundi.
 */
import { runTask, type AiStore } from "../ai/run.ts";
import type { MessagesClient } from "../ai/types.ts";
import { planCoachTask, PLAN_COACH_VERSION } from "../ai/prompts/plan-coach.ts";
import type { Habits } from "../co2/footprint.ts";
import { COACH_POOL, FEASIBILITY, mergeCoachChoice, rankCandidates, rulePlan, type Feasibility, type LastWeek, type PlanEntry } from "./weekly.ts";

export interface BuiltPlan {
  items: PlanEntry[];
  source: "regles" | "ia" | "mock";
  version: string | null;
}

/** Lit sans confiance les données venues de la base (jsonb) : tout ce qui est inattendu est ignoré. */
export function parseInputs(raw: { feasibility?: unknown; stats?: unknown } | null | undefined): {
  feasibility: Record<string, Feasibility>;
  week: LastWeek;
} {
  const feasibility: Record<string, Feasibility> = {};
  if (raw?.feasibility && typeof raw.feasibility === "object") {
    for (const [k, v] of Object.entries(raw.feasibility as Record<string, unknown>)) {
      if (typeof v === "string" && (FEASIBILITY as readonly string[]).includes(v)) feasibility[k] = v as Feasibility;
    }
  }
  const s = (raw?.stats ?? {}) as { counts?: unknown; abandoned?: unknown; active?: unknown };
  const counts: Record<string, number> = {};
  if (s.counts && typeof s.counts === "object") {
    for (const [k, v] of Object.entries(s.counts as Record<string, unknown>)) if (Number.isFinite(Number(v))) counts[k] = Number(v);
  }
  const list = (x: unknown) => (Array.isArray(x) ? x.filter((y): y is string => typeof y === "string") : []);
  return { feasibility, week: { counts, abandoned: list(s.abandoned), active: list(s.active) } };
}

export async function buildPlan(
  h: Habits,
  feasibility: Record<string, Feasibility>,
  week: LastWeek,
  deps: { client: MessagesClient | null; store: AiStore; mock?: boolean },
  useAi = true,
): Promise<BuiltPlan | null> {
  const candidates = rankCandidates(h, feasibility, week);
  if (candidates.length === 0) return null;
  const fallback: BuiltPlan = { items: rulePlan(candidates), source: "regles", version: null };
  // Sobriété : un seul candidat, ou une personne inactive depuis un mois → pas besoin de l'IA.
  if (!useAi || candidates.length === 1) return fallback;

  const pool = candidates.slice(0, COACH_POOL);
  const r = await runTask(planCoachTask, { candidates: pool }, deps);
  if (!r.ok) return fallback;
  return { items: mergeCoachChoice(pool, r.data.items), source: r.source === "mock" ? "mock" : "ia", version: PLAN_COACH_VERSION };
}
