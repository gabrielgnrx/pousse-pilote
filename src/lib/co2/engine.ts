/**
 * Moteur de calcul du CO₂ évité pour une action du + (v2).
 *
 * L'action (slug + quantité) vient du + ; le code calcule. Ce module est le miroir exact de
 * avoided_kg / effective_quantity / log_action (migration 0028) : il sert aux aperçus à l'écran
 * (interface optimiste) et aux tests. Le chiffre qui fait foi est toujours recalculé par la base.
 */
import { ACTION_TYPES, type ActionType } from "./action-types.data.ts";
import { TEMPLATE_BY_ID, unitImpact } from "./challenges.ts";
import { TRANSPORT_KG_PER_KM } from "./factors.ts";
import type { Habits } from "./footprint.ts";

export type { ActionType };

export const ACTION_BY_SLUG: Readonly<Record<string, ActionType>> = Object.fromEntries(ACTION_TYPES.map((a) => [a.slug, a]));

const COMMUTE_TEMPLATES = ["velo", "transports", "covoiturage"];
/** Actions plafonnées sur 7 jours (cap_window_days = 7 en base). */
const WEEKLY_WINDOW = ["chauffage", "reparation", "vacances_train"];

export type QuantityError = "quantity_out_of_range" | "unknown_action";

export interface AvoidedResult {
  ok: true;
  action: ActionType;
  /** Unités comptées dans les plafonds et les défis (repas, articles… ; 1 pour un trajet). */
  units: number;
  /** Quantité retenue pour le calcul (km plafonnés au trajet déclaré, par exemple). */
  quantity: number;
  /** La quantité saisie dépassait ce que le bilan permet de compter. */
  capped: boolean;
  /** kg de CO₂ évités, arrondis au gramme comme en base. */
  kg: number;
  /** Pourquoi 0 kg, le cas échéant. */
  reason?: string;
}

export type ComputeResult = AvoidedResult | { ok: false; error: QuantityError };

/** Arrondi au gramme, comme round(x, 3) en base. */
export function roundKg(kg: number): number {
  return Math.round((kg + Number.EPSILON) * 1000) / 1000;
}

/** Contrôle de la quantité saisie, comme log_action (bornes du catalogue, entiers pour « count »). */
export function checkQuantity(action: ActionType, quantity: number): QuantityError | null {
  if (!Number.isFinite(quantity) || quantity < action.min || quantity > action.max) return "quantity_out_of_range";
  if (action.kind === "count" && !Number.isInteger(quantity)) return "quantity_out_of_range";
  return null;
}

/** Quantité retenue (effective_quantity en base). */
export function effectiveQuantity(action: ActionType, quantity: number | null, h: Habits): number {
  if (COMMUTE_TEMPLATES.includes(action.template)) return Math.min(quantity ?? h.commuteKm, h.commuteKm);
  return quantity ?? 1;
}

/**
 * CO₂ évité par une action entière, pour une personne et son bilan.
 * `quantity` null = valeur par défaut (trajet déclaré, une unité).
 */
export function computeAvoided(slug: string, quantity: number | null, h: Habits): ComputeResult {
  const action = ACTION_BY_SLUG[slug];
  if (!action) return { ok: false, error: "unknown_action" };
  if (quantity !== null) {
    const err = checkQuantity(action, quantity);
    if (err) return { ok: false, error: err };
  }
  const q = effectiveQuantity(action, quantity, h);
  const units = action.kind === "count" ? q : 1;
  const capped = quantity !== null && q < quantity;

  let kg = 0;
  let reason: string | undefined;
  if (q > 0) {
    if (COMMUTE_TEMPLATES.includes(action.template)) {
      const unit = unitImpact(action.template, action.variant, h);
      if (h.commuteKm > 0 && unit.eligible) kg = (unit.kg * q) / h.commuteKm;
      else reason = unit.reason;
    } else if (action.template === "train" && action.variant === "km") {
      if (h.shortFlightsYear > 0) kg = q * (TRANSPORT_KG_PER_KM.avion_court - TRANSPORT_KG_PER_KM.tgv);
      else reason = "Aucun vol court déclaré dans ton bilan.";
    } else {
      const unit = unitImpact(action.template, action.variant, h);
      if (unit.eligible) kg = unit.kg * q;
      else reason = unit.reason;
    }
  } else {
    reason = "Ton trajet domicile-travail déclaré fait 0 km.";
  }
  return { ok: true, action, units, quantity: q, capped, kg: roundKg(kg), reason: kg > 0 ? undefined : reason };
}

/** Ce que la personne a déjà enregistré, pour vérifier les plafonds avant d'appeler la base. */
export interface CapUsage {
  /** Unités déjà comptées dans le même groupe de plafond, sur la fenêtre du plafond (1 ou 7 jours). */
  usedInWindow: number;
  /** Unités déjà comptées dans le même groupe depuis lundi. */
  usedThisWeek: number;
}

/** Plafond de la semaine calé sur le bilan (weekly_cap en base). null = pas de plafond hebdomadaire. */
export function weeklyCap(template: string, h: Habits): number | null {
  if (COMMUTE_TEMPLATES.includes(template)) return 2 * Math.max(h.commuteDaysPerWeek, 1);
  if (template === "teletravail") return 5;
  if (template === "occasion") return 3;
  return null;
}

/** Plafond du jour (ou de 7 jours) de l'action, depuis le catalogue des défis (cap_units en base). */
export function windowCap(template: string): { units: number; days: 1 | 7 } {
  const t = TEMPLATE_BY_ID[template];
  return { units: t?.dailyCap ?? 1, days: WEEKLY_WINDOW.includes(template) ? 7 : 1 };
}

export type CapError = "cap_reached" | "week_cap_reached";

/** Les plafonds anti-triche, dans le même ordre qu'en base : fenêtre du jour, puis semaine. */
export function checkCaps(template: string, units: number, usage: CapUsage, h: Habits): CapError | null {
  if (usage.usedInWindow + units > windowCap(template).units) return "cap_reached";
  const w = weeklyCap(template, h);
  if (w !== null && usage.usedThisWeek + units > w) return "week_cap_reached";
  return null;
}
