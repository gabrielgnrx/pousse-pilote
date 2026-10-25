/**
 * Ce qu'on fait d'une phrase libre (« vélo jusqu'au bureau, 8 km ») avant de demander confirmation.
 *
 * Tout ici est déterministe et testé :
 *   - ruleParse : une règle simple suffit souvent (un seul geste reconnu, une seule quantité) → pas
 *     d'appel à l'IA (sobriété) ;
 *   - interpretItems : la sortie du LLM (ou des règles) devient des cartes de confirmation ; une
 *     confiance faible, une action inconnue, une unité incohérente ou une quantité hors bornes
 *     déclenchent un choix explicite, jamais une supposition ;
 *   - candidatesFor : les actions proches, pour l'écran de choix et le repli sans IA.
 * Le CO₂ affiché est un aperçu (engine.ts) ; la base le recalcule à l'enregistrement.
 */
import { ACTION_TYPES, type ActionType } from "../../co2/action-types.data.ts";
import { ACTION_BY_SLUG, checkQuantity, computeAvoided } from "../../co2/engine.ts";
import type { Habits } from "../../co2/footprint.ts";

export const MIN_CONFIDENCE = 0.7;
export const UNKNOWN = "inconnu";

/** Ce que renvoie le LLM pour une action (après validation zod). */
export interface ParsedItem {
  action: string;
  quantity: number | null;
  unit: string;
  confidence: number;
}

export type ChoiceReason = "low_confidence" | "unknown_action" | "unit_mismatch" | "quantity_out_of_range";

export interface ConfirmCard {
  slug: string;
  label: string;
  kind: ActionType["kind"];
  unit: string;
  min: number;
  max: number;
  /** Quantité proposée, à confirmer ; null = à saisir (on ne devine pas). */
  quantity: number | null;
  /** Aperçu du CO₂ évité pour cette quantité (la base fait foi). */
  previewKg: number;
  /** La quantité dépasse ce que le bilan permet de compter (km plafonnés au trajet déclaré). */
  capped: boolean;
  /** Pourquoi on demande de choisir ou de compléter, le cas échéant. */
  needsChoice: ChoiceReason | null;
  /** Actions proches, proposées à l'écran de choix. */
  candidates: string[];
  /** Un justificatif sera demandé (train, vacances en train, réparation…). */
  needsReceipt: boolean;
  /** Quantité reprise du bilan (trajet domicile-travail déclaré), affichée comme telle. */
  fromBilan: boolean;
}

/** Actions qui demandent un justificatif (même liste que requires_receipt en base). */
const RECEIPT_TEMPLATES = new Set(["train", "vacances_train", "reparation", "appli_antigaspi", "appli_occasion"]);
const COMMUTE = new Set(["velo", "transports", "covoiturage"]);

const fold = (s: string) =>
  s
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, " ");

// Unités reconnues : on convertit vers l'unité du catalogue, ou on refuse (jamais de conversion douteuse).
const DISTANCE_UNITS: Record<string, number> = { km: 1, kilometre: 1, kilometres: 1, kms: 1, m: 0.001, metre: 0.001, metres: 0.001 };
const COUNT_UNITS = new Set(["", "fois", "x", "unite", "unites"]);

/**
 * Convertit la quantité vers l'unité de l'action. null si l'unité ne colle pas avec l'action
 * (des km pour un repas, des repas pour un trajet).
 */
export function convertQuantity(action: ActionType, quantity: number, unit: string): number | null {
  const u = fold(unit).trim().replace(/\.$/, "");
  if (action.kind === "distance") {
    const k = DISTANCE_UNITS[u];
    return k === undefined ? null : Math.round(quantity * k * 100) / 100;
  }
  if (COUNT_UNITS.has(u)) return quantity;
  const target = fold(action.unit);
  // « repas », « jours », « articles »… au singulier ou au pluriel, ou des synonymes courants.
  const synonyms: Record<string, string[]> = {
    repas: ["repas", "dejeuner", "dejeuners", "diner", "diners", "plat", "plats"],
    jour: ["jour", "jours", "journee", "journees"],
    article: ["article", "articles", "piece", "pieces", "vetement", "vetements"],
    appareil: ["appareil", "appareils"],
    semaine: ["semaine", "semaines"],
    panier: ["panier", "paniers"],
    "aller-retour": ["aller-retour", "allers-retours", "voyage", "voyages"],
  };
  const ok = (synonyms[target] ?? [target]).includes(u) || u === `${target}s`;
  return ok ? quantity : null;
}

/** Score de proximité entre une saisie et une action (mots des alias et du libellé). */
function score(text: string, a: ActionType): number {
  const t = fold(text);
  let s = 0;
  for (const alias of a.aliases) {
    const f = fold(alias);
    if (f.length >= 3 && t.includes(f)) s += 2 + f.length / 10;
  }
  for (const w of fold(a.label).split(/[^a-z0-9]+/)) {
    if (w.length >= 5 && t.includes(w)) s += 0.5;
  }
  return s;
}

/** Les actions les plus proches d'une saisie (pour l'écran de choix), meilleure d'abord. */
export function candidatesFor(text: string, limit = 3, exclude: string[] = []): string[] {
  return ACTION_TYPES.map((a) => ({ a, s: score(text, a) }))
    .filter((x) => x.s > 0 && !exclude.includes(x.a.slug))
    .sort((x, y) => y.s - x.s)
    .slice(0, limit)
    .map((x) => x.a.slug);
}

const QUANTITY = /(\d+(?:[.,]\d+)?)\s*(km|kms|kilom[eè]tres?|m(?![a-zé])|m[eè]tres?|repas|d[ée]jeuners?|d[îi]ners?|jours?|fois)?/giu;

/**
 * Règle simple, sans IA : un seul geste nettement reconnu, et au plus une quantité cohérente.
 * Renvoie null dès qu'il y a un doute (plusieurs gestes, plusieurs nombres…) : l'IA prend le relais.
 */
export function ruleParse(text: string): ParsedItem[] | null {
  const scored = ACTION_TYPES.map((a) => ({ a, s: score(text, a) })).filter((x) => x.s >= 2);
  if (scored.length === 0) return null;
  scored.sort((x, y) => y.s - x.s);
  const [best, second] = scored;
  // Deux gestes proches (« végé » et « végé au lieu du bœuf ») : on laisse trancher l'IA.
  if (second && second.s >= best.s - 0.5) return null;
  // Plusieurs gestes dans la phrase (« vélo puis déjeuner végé ») : à l'IA aussi.
  if (scored.some((x) => x !== best && x.a.template !== best.a.template && x.s >= 2)) return null;

  const numbers = [...text.matchAll(QUANTITY)];
  if (numbers.length > 1) return null;
  if (numbers.length === 0) return [{ action: best.a.slug, quantity: null, unit: "", confidence: 0.9 }];
  const [, n, unit = ""] = numbers[0];
  const q = Number(n.replace(",", "."));
  if (convertQuantity(best.a, q, unit) === null) return null;
  return [{ action: best.a.slug, quantity: q, unit, confidence: 0.9 }];
}

/** Transforme les actions reconnues en cartes de confirmation, avec aperçu du CO₂. */
export function interpretItems(items: ParsedItem[], text: string, h: Habits | null, minConfidence = MIN_CONFIDENCE): ConfirmCard[] {
  const cards: ConfirmCard[] = [];
  for (const item of items) {
    const known = ACTION_BY_SLUG[item.action];
    // Action inconnue : la meilleure proposition par les mots, à choisir explicitement.
    const fallbackSlug = known ? null : candidatesFor(text, 1)[0];
    const action = known ?? (fallbackSlug ? ACTION_BY_SLUG[fallbackSlug] : undefined);
    if (!action) continue;

    let needsChoice: ChoiceReason | null = null;
    if (!known) needsChoice = "unknown_action";
    else if (item.confidence < minConfidence) needsChoice = "low_confidence";

    let quantity: number | null = null;
    if (item.quantity !== null) {
      const converted = convertQuantity(action, item.quantity, item.unit);
      if (converted === null) needsChoice ??= "unit_mismatch";
      else if (checkQuantity(action, converted)) needsChoice ??= "quantity_out_of_range";
      else quantity = converted;
    }
    // Une seule unité possible (télétravail, chauffage…) : la quantité va de soi.
    if (quantity === null && action.min === action.max) quantity = action.min;
    // Trajet domicile-travail sans distance : le trajet déclaré dans le bilan (affiché comme tel).
    let fromBilan = false;
    if (quantity === null && item.quantity === null && COMMUTE.has(action.template) && h && h.commuteKm >= action.min) {
      quantity = Math.min(h.commuteKm, action.max);
      fromBilan = true;
    }

    const preview = h ? computeAvoided(action.slug, action.kind === "distance" ? quantity : (quantity ?? 1), h) : null;
    cards.push({
      slug: action.slug,
      label: action.label,
      kind: action.kind,
      unit: action.unit,
      min: action.min,
      max: action.max,
      quantity,
      previewKg: preview && preview.ok ? preview.kg : 0,
      capped: preview && preview.ok ? preview.capped : false,
      needsChoice,
      candidates: needsChoice ? [action.slug, ...candidatesFor(text, 3, [action.slug])].slice(0, 3) : [],
      needsReceipt: RECEIPT_TEMPLATES.has(action.template),
      fromBilan,
    });
  }
  // Deux fois la même action dans une phrase : une seule carte.
  return cards.filter((c, i) => cards.findIndex((x) => x.slug === c.slug) === i);
}
