/**
 * Le jeu et l'impact, deux axes séparés :
 *   - le jeu = les points (défis, garder le cap, influence, témoin), seul chiffre du classement ;
 *   - l'impact = les kg de CO₂ évités, strict, qui alimente l'objectif collectif de l'entreprise.
 * Les habitudes à garder doivent rester identiques à kept_habits (0005_engagement.sql),
 * le barème à 0006_points.sql.
 */
import { COMMUTE_KG_PER_KM, MEAL_KG, TRANSPORT_KG_PER_KM, WORK_WEEKS_PER_YEAR } from "./factors.ts";
import {
  AVERAGE_CLOTHING_KG,
  AVERAGE_DEVICE_KG,
  LONG_FLIGHT_KM_ROUND_TRIP,
  MEALS_PER_WEEK,
  OTHER_MEAT_MEAL_KG,
  SHORT_FLIGHT_KM_ROUND_TRIP,
  WEEKS_PER_YEAR,
  type Habits,
} from "./footprint.ts";

/** Pousses hors défis (les défis ont leurs propres pousses, +5 avec preuve). */
export const POINTS = { preuve: 5, maintien: 10, influence: 15, temoin: 3, quete: 15, scan: 5, quiz: 5, collectif: 30, duelSeul: 40, duelDeux: 25 } as const;

/** Paliers de série de jours actifs (bonus crédités par claim_daily_rewards, 0007_pousses.sql). */
export const STREAK_MILESTONES = [
  { days: 3, pousses: 10 },
  { days: 7, pousses: 25 },
  { days: 14, pousses: 50 },
  { days: 30, pousses: 100 },
] as const;

/** Le barème, tel qu'il est expliqué dans l'application. */
export const POINT_RULES: { label: string; points: string }[] = [
  { label: "Défi du quotidien validé avec preuve (trajet, repas, vêtement, semaine de chauffage)", points: "+10" },
  { label: "Train au lieu de l'avion, avec preuve (aller simple)", points: "+30" },
  { label: "Défis expert avec preuve : végétalien, réparation, vacances en train", points: "+15 à +150" },
  { label: "Bonus de preuve (photo ou collègue témoin)", points: "+5" },
  { label: "Défi validé sans preuve : le CO₂ compte, pas les pousses", points: "0" },
  { label: "Garder le cap sur une habitude (2 récompensées par semaine)", points: "+10" },
  { label: "Les 3 quêtes du jour réussies", points: "+15" },
  { label: "Série de jours actifs : 3, 7, 14, 30 jours", points: "+10, +25, +50, +100" },
  { label: "Scanner : choisir une alternative mieux notée (3 par jour)", points: "+5" },
  { label: "Un collègue relève un défi grâce à ta publication", points: "+15" },
  { label: "Confirmer le défi d'un collègue", points: "+3" },
  { label: "Bonne réponse au quiz du jour", points: "+5" },
  { label: "Graine mystère (après les 3 quêtes du jour) : au hasard, ou une plante rare", points: "+5 à +20" },
  { label: "Défi collectif de la semaine atteint, si tu y as contribué", points: "+30" },
  { label: "Duel réussi : seul gagnant / tous les deux", points: "+40 / +25" },
];

/** Les niveaux : ta plante grandit avec tes pousses. */
export const LEVELS = [
  { name: "Graine", min: 0 },
  { name: "Germe", min: 50 },
  { name: "Jeune pousse", min: 150 },
  { name: "Plantule", min: 300 },
  { name: "Arbuste", min: 600 },
  { name: "Arbre", min: 1000 },
  { name: "Forêt", min: 2000 },
] as const;

export function levelFor(total: number) {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) if (total >= LEVELS[i].min) index = i;
  const current = LEVELS[index];
  const next = LEVELS[index + 1] ?? null;
  return {
    index,
    name: current.name,
    next: next ? { name: next.name, min: next.min, missing: next.min - total } : null,
    /** Avancement vers le niveau suivant, de 0 à 1. */
    progress: next ? (total - current.min) / (next.min - current.min) : 1,
  };
}

/** Prochain palier de série à atteindre. */
export function nextStreakMilestone(streak: number) {
  return STREAK_MILESTONES.find((m) => m.days > streak) ?? null;
}

/** Objectif collectif par défaut, par participant, sur la durée du pilote. */
export const GOAL_KG_PER_PARTICIPANT = 30;

export type KeptHabitKey = "trajet_doux" | "repas_vege" | "sans_avion" | "peu_de_neuf" | "telephone_garde";

export interface KeptHabit {
  key: KeptHabitKey;
  title: string;
  /** Ce que l'habitude évite chaque semaine par rapport à une référence ; null si non chiffrable. */
  kgWeek: number | null;
  /** Explication courte, affichée quand l'habitude n'est pas chiffrée. */
  basis: string;
  /** Référence de comparaison du chiffre (« la voiture thermique seule »). */
  versus?: string;
}

const vegMeals = (h: Habits) => MEALS_PER_WEEK - h.beefMealsWeek - h.otherMeatMealsWeek;

/**
 * Habitudes bas carbone déjà acquises, que la personne peut confirmer chaque semaine
 * (« garder le cap »). Le chiffre « évité » est une comparaison, pas une réduction.
 */
export function keptHabits(h: Habits): KeptHabit[] {
  const out: KeptHabit[] = [];
  const car = TRANSPORT_KG_PER_KM.voiture_thermique;

  if (["velo", "marche_teletravail", "transports_en_commun", "covoiturage"].includes(h.commuteMode)) {
    const weeklyKm = h.commuteKm * 2 * h.commuteDaysPerWeek;
    const kgWeek = weeklyKm > 0 ? weeklyKm * (car - COMMUTE_KG_PER_KM[h.commuteMode]) : null;
    out.push({
      key: "trajet_doux",
      title:
        h.commuteMode === "velo"
          ? "Au travail à vélo"
          : h.commuteMode === "transports_en_commun"
            ? "Au travail en transports en commun"
            : h.commuteMode === "covoiturage"
              ? "Au travail en covoiturage"
              : "Au travail à pied ou en télétravail",
      kgWeek,
      basis: kgWeek ? `${Math.round(weeklyKm)} km par semaine sans voiture` : "Trajets sans voiture",
      versus: "la voiture thermique seule",
    });
  }
  const veg = vegMeals(h);
  if (veg >= 7) {
    out.push({
      key: "repas_vege",
      title: `${veg} repas végétariens par semaine`,
      kgWeek: veg * (OTHER_MEAT_MEAL_KG - MEAL_KG.vegetarien),
      basis: `${veg} repas sur 14`,
      versus: "des repas avec porc, poulet ou poisson",
    });
  }
  if (h.shortFlightsYear + h.longFlightsYear === 0) {
    out.push({ key: "sans_avion", title: "Pas d'avion cette année", kgWeek: null, basis: "Le poste le plus lourd, évité" });
  }
  if (h.newClothesYear <= 5) {
    out.push({ key: "peu_de_neuf", title: "Peu de vêtements neufs", kgWeek: null, basis: "5 ou moins par an" });
  }
  if (!h.buysNewPhone) {
    out.push({ key: "telephone_garde", title: "Pas de smartphone neuf", kgWeek: null, basis: "Reconditionné ou gardé" });
  }
  return out;
}

/** Somme des comparaisons chiffrables : « ce que tes habitudes évitent déjà », par semaine. */
export function headStartKgWeek(h: Habits): number {
  return keptHabits(h).reduce((s, k) => s + (k.kgWeek ?? 0), 0);
}

/** Même comparaison sur un an : 45 semaines travaillées pour les trajets, 52 pour les repas. */
export function headStartKgYear(h: Habits): number {
  return keptHabits(h).reduce(
    (s, k) => s + (k.kgWeek ?? 0) * (k.key === "trajet_doux" ? WORK_WEEKS_PER_YEAR : WEEKS_PER_YEAR),
    0,
  );
}

/** Plus gros postes restants du bilan, avec le défi qui s'y attaque. */
export function remainingBigItems(h: Habits) {
  const items = [
    {
      key: "avion",
      label: "Avion",
      kgYear:
        h.shortFlightsYear * SHORT_FLIGHT_KM_ROUND_TRIP * TRANSPORT_KG_PER_KM.avion_court +
        h.longFlightsYear * LONG_FLIGHT_KM_ROUND_TRIP * TRANSPORT_KG_PER_KM.avion_moyen_long,
      templateId: h.longFlightsYear > 0 ? "vacances_train" : "train",
    },
    {
      key: "appareils",
      label: "Appareils électroniques neufs",
      kgYear: h.newDevicesYear * AVERAGE_DEVICE_KG,
      templateId: "reparation",
    },
    { key: "vetements", label: "Vêtements neufs", kgYear: h.newClothesYear * AVERAGE_CLOTHING_KG, templateId: "occasion" },
    { key: "chauffage", label: "Chauffage", kgYear: h.heatingKgYear, templateId: "chauffage" },
    {
      key: "trajets",
      label: "Trajets domicile-travail",
      kgYear: h.commuteKm * 2 * h.commuteDaysPerWeek * WORK_WEEKS_PER_YEAR * COMMUTE_KG_PER_KM[h.commuteMode],
      templateId: "velo",
    },
  ];
  return items.filter((i) => i.kgYear >= 1).sort((a, b) => b.kgYear - a.kgYear);
}

/** Lundi de la semaine d'une date AAAA-MM-JJ (même convention que date_trunc('week') en SQL). */
export function weekStart(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // lundi = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/**
 * Série en cours : nombre de semaines consécutives avec au moins une confirmation,
 * en partant de la semaine courante (ou de la précédente si celle-ci n'est pas encore faite).
 */
export function currentStreak(weeks: string[], todayIso: string): number {
  const set = new Set(weeks);
  const cursor = new Date(`${weekStart(todayIso)}T12:00:00Z`);
  const key = () => cursor.toISOString().slice(0, 10);
  if (!set.has(key())) cursor.setUTCDate(cursor.getUTCDate() - 7);
  let n = 0;
  while (set.has(key())) {
    n += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }
  return n;
}
