/**
 * Mon plan : les défis proposés cette semaine, déterministes et expliqués.
 *
 * 1. Les candidats viennent du plan d'action (actionPlan) : uniquement des défis du catalogue dont le
 *    CO₂ est calculé à partir des facteurs (jamais un défi inventé).
 * 2. Tri : potentiel de CO₂ pour la personne (par palier), puis faisabilité déclarée, puis kg exacts.
 * 3. La semaine écoulée ajuste l'ordre : un défi abandonné recule (on le garde, sans insister), une
 *    action déjà régulière est marquée « sur ta lancée » et laisse la place à un nouveau levier.
 * L'IA (coach) choisit ensuite parmi les premiers candidats et formule le « pourquoi toi » ; sans IA,
 * les phrases d'ici servent telles quelles.
 */
import { actionPlan, type PlanItem } from "../co2/plan.ts";
import { formatKg } from "../co2/challenges.ts";
import type { Habits } from "../co2/footprint.ts";

export const FEASIBILITY = ["facile", "possible", "difficile", "impossible"] as const;
export type Feasibility = (typeof FEASIBILITY)[number];

export type Signal = "nouveau" | "abandonne" | "sur_sa_lancee" | "en_cours";

export interface LastWeek {
  /** Nombre d'actions enregistrées la semaine dernière, par défi (template). */
  counts: Record<string, number>;
  /** Défis abandonnés la semaine dernière. */
  abandoned: string[];
  /** Défis en cours aujourd'hui. */
  active: string[];
}

export interface PlanCandidate {
  templateId: string;
  variant: string;
  title: string;
  kgYear: number;
  basis: string;
  feasibility: Feasibility | null;
  signal: Signal;
  lastWeekCount: number;
  /** Phrase courte « pourquoi toi », sans IA. */
  reason: string;
}

/** Une action faite au moins 3 fois la semaine dernière est « sur sa lancée ». */
export const STREAK_THRESHOLD = 3;
export const PLAN_SIZE = 3;
/** Nombre de candidats proposés au coach IA (il en garde PLAN_SIZE). */
export const COACH_POOL = 6;

const TIER = (kg: number) => (kg >= 200 ? 0 : kg >= 50 ? 1 : 2);
const FEAS_RANK: Record<Feasibility, number> = { facile: 0, possible: 1, difficile: 2, impossible: 3 };
const SIGNAL_RANK: Record<Signal, number> = { nouveau: 0, en_cours: 0, sur_sa_lancee: 1, abandonne: 2 };

export function signalFor(templateId: string, w: LastWeek): Signal {
  if (w.abandoned.includes(templateId)) return "abandonne";
  if ((w.counts[templateId] ?? 0) >= STREAK_THRESHOLD) return "sur_sa_lancee";
  if (w.active.includes(templateId)) return "en_cours";
  return "nouveau";
}

export function fallbackReason(c: Omit<PlanCandidate, "reason">): string {
  const kg = `environ ${formatKg(c.kgYear)} par an d'après ton bilan`;
  switch (c.signal) {
    case "abandonne":
      return `Tu l'avais mis de côté : rien ne presse, mais c'est ${kg}.`;
    case "sur_sa_lancee":
      return `Déjà ${c.lastWeekCount} fois la semaine dernière : continue sur ta lancée.`;
    case "en_cours":
      return `Ton défi en cours : ${kg}.`;
    default:
      return c.feasibility === "facile" ? `Facile pour toi et ${kg}.` : `Un de tes plus gros leviers : ${kg}.`;
  }
}

/** Tous les candidats de la semaine, triés. Les défis jugés impossibles par la personne sont écartés. */
export function rankCandidates(h: Habits, feasibility: Record<string, Feasibility>, w: LastWeek): PlanCandidate[] {
  return actionPlan(h)
    .map((p: PlanItem) => {
      const base = {
        templateId: p.templateId,
        variant: p.variant,
        title: p.title,
        kgYear: Math.round(p.kgYear),
        basis: p.basis,
        feasibility: feasibility[p.templateId] ?? null,
        signal: signalFor(p.templateId, w),
        lastWeekCount: w.counts[p.templateId] ?? 0,
      };
      return { ...base, reason: fallbackReason(base) };
    })
    .filter((c) => c.feasibility !== "impossible" && c.kgYear > 0)
    .sort(
      (a, b) =>
        SIGNAL_RANK[a.signal] - SIGNAL_RANK[b.signal] ||
        TIER(a.kgYear) - TIER(b.kgYear) ||
        FEAS_RANK[a.feasibility ?? "possible"] - FEAS_RANK[b.feasibility ?? "possible"] ||
        b.kgYear - a.kgYear,
    );
}

export interface PlanEntry {
  template_id: string;
  variant: string;
  kg_year: number;
  signal: Signal;
  reason: string;
}

/** Le plan sans IA : les premiers candidats, avec leurs phrases. */
export function rulePlan(candidates: PlanCandidate[], size = PLAN_SIZE): PlanEntry[] {
  return candidates.slice(0, size).map((c) => toEntry(c));
}

export function toEntry(c: PlanCandidate, reason = c.reason): PlanEntry {
  return { template_id: c.templateId, variant: c.variant, kg_year: c.kgYear, signal: c.signal, reason };
}

/**
 * Applique le choix du coach IA : seuls les candidats proposés sont retenus (un défi hors liste est
 * ignoré), dans l'ordre du coach ; le plan est complété par les règles s'il manque des défis.
 */
export function mergeCoachChoice(pool: PlanCandidate[], picks: { template: string; reason: string }[], size = PLAN_SIZE): PlanEntry[] {
  const byId = new Map(pool.map((c) => [c.templateId, c]));
  const chosen: PlanEntry[] = [];
  for (const p of picks) {
    const c = byId.get(p.template);
    if (!c || chosen.some((e) => e.template_id === c.templateId)) continue;
    const reason = p.reason.trim();
    chosen.push(toEntry(c, reason.length >= 10 ? reason : c.reason));
    if (chosen.length === size) break;
  }
  for (const c of pool) {
    if (chosen.length === size) break;
    if (!chosen.some((e) => e.template_id === c.templateId)) chosen.push(toEntry(c));
  }
  return chosen;
}
