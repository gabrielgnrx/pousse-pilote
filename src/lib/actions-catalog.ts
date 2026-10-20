/**
 * Les actions qu'on enregistre avec le bouton +, une ligne par variante utile.
 * Le CO₂ affiché est celui du bilan de la personne (0 kg si rien n'est remplacé) ;
 * la base refait le calcul (log_action, 0012_actions_libres.sql).
 */
import { GESTES, TEMPLATE_BY_ID, TEMPLATES, unitImpact } from "./co2/challenges.ts";
import type { Habits } from "./co2/footprint.ts";

export type Theme = "trajets" | "repas" | "achats" | "maison" | "voyages" | "bureau";

export const THEMES: { id: Theme; label: string }[] = [
  { id: "trajets", label: "Trajets" },
  { id: "repas", label: "Repas" },
  { id: "achats", label: "Occasion et réparation" },
  { id: "maison", label: "Maison" },
  { id: "voyages", label: "Voyages" },
  { id: "bureau", label: "Au bureau" },
];

export interface ActionItem {
  key: string;
  templateId: string;
  variant: string;
  title: string;
  theme: Theme;
  /** kg de CO₂ évités par cette action, pour cette personne. */
  kg: number;
  points: number;
  /** Pourquoi 0 kg, le cas échéant. */
  note?: string;
}

const THEME_OF: Record<string, Theme> = {
  velo: "trajets",
  transports: "trajets",
  covoiturage: "trajets",
  train: "voyages",
  vacances_train: "voyages",
  vege: "repas",
  moins_boeuf: "repas",
  vegetalien: "repas",
  occasion: "achats",
  reparation: "achats",
  chauffage: "maison",
  escaliers: "bureau",
  gourde: "bureau",
  ecran: "bureau",
};

/** Le titre d'une action, au passé ou à l'infinitif court, comme on la raconte. */
export function actionTitle(templateId: string, variant: string): string {
  const t = TEMPLATE_BY_ID[templateId];
  const v = t?.variants.find((x) => x.key === variant);
  switch (templateId) {
    case "velo":
      return "Venu au bureau à vélo";
    case "transports":
      return "Métro ou RER au lieu de la voiture";
    case "covoiturage":
      return "Covoiturage à deux au lieu de rouler seul";
    case "train":
      return `Train au lieu de l'avion · ${v?.label ?? variant}`;
    case "vege":
      return variant === "boeuf" ? "Repas végé au lieu de bœuf" : "Repas végé au lieu de porc, poulet ou poisson";
    case "occasion":
      return `Acheté d'occasion : ${(v?.label ?? variant).toLowerCase()}`;
    case "reparation":
      return `Réparé au lieu de racheter : ${(v?.label ?? variant).toLowerCase()}`;
    case "chauffage":
      return "Chauffage baissé de 1 °C cette semaine";
    default:
      return t?.title ?? "Action";
  }
}

export function themeOf(templateId: string): Theme {
  return THEME_OF[templateId] ?? "bureau";
}

/** Toutes les actions possibles, avec leur gain pour cette personne. */
export function actionItems(h: Habits): ActionItem[] {
  return [...TEMPLATES, ...GESTES].flatMap((t) =>
    t.variants.map((v) => {
      const impact = unitImpact(t.id, v.key, h);
      return {
        key: `${t.id}:${v.key}`,
        templateId: t.id,
        variant: v.key,
        title: actionTitle(t.id, v.key),
        theme: themeOf(t.id),
        kg: impact.eligible ? impact.kg : 0,
        points: t.pointsPerUnit,
        note: impact.eligible ? undefined : impact.reason,
      };
    }),
  );
}
