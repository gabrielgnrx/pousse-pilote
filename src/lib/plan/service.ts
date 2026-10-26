/**
 * Calcul du plan de la semaine, par les règles seulement (weekly.ts) : à la première visite de la
 * semaine sur Mon plan, il est calculé puis gardé jusqu'au lundi suivant.
 */
import type { Habits } from "../co2/footprint.ts";
import { FEASIBILITY, rankCandidates, rulePlan, type Feasibility, type LastWeek, type PlanEntry } from "./weekly.ts";

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

/** Le plan de la semaine : les premiers défis classés, avec leur phrase « pourquoi toi ». */
export function buildPlan(h: Habits, feasibility: Record<string, Feasibility>, week: LastWeek): PlanEntry[] | null {
  const candidates = rankCandidates(h, feasibility, week);
  return candidates.length ? rulePlan(candidates) : null;
}
