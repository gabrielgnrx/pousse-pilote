/**
 * Les actions du bouton + : 16 actions générales, à noter en un geste juste après les avoir faites
 * (décision du 26/10/2026). Les vêtements et les appareils se détaillent dans l'action (quoi, combien),
 * le train demande sa distance. Le CO₂ affiché est celui du bilan de la personne (0 kg si rien n'est
 * remplacé) ; la base refait le calcul (log_action, log_action_slug).
 */
import { TEMPLATE_BY_ID, unitImpact } from "./co2/challenges.ts";
import type { Habits } from "./co2/footprint.ts";

export type Theme = "trajets" | "repas" | "achats" | "maison" | "voyages" | "bureau" | "nature";

export const THEMES: { id: Theme; label: string }[] = [
  { id: "trajets", label: "Trajets" },
  { id: "repas", label: "Repas" },
  { id: "achats", label: "Achats" },
  { id: "maison", label: "Maison" },
  { id: "voyages", label: "Voyages" },
  { id: "bureau", label: "Au bureau" },
  { id: "nature", label: "Nature" },
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
  /** Grosse action : confirmation sur l'honneur (plafond annuel ou hebdomadaire en base). */
  requiresConfirm?: boolean;
  category: string;
  /** « items » : on choisit quoi et combien (vêtements, appareils) ; « distance » : on saisit les km. */
  pick?: "items" | "distance";
  /** Les choix d'une action « items », avec le CO₂ de chacun pour cette personne. */
  choices?: { variant: string; label: string; kg: number; max: number }[];
}

/** La liste du +, dans l'ordre d'affichage. */
const QUICK: { templateId: string; variant: string; title: string; theme?: Theme; pick?: "items" | "distance" }[] = [
  { templateId: "velo", variant: "base", title: "Venu à vélo ou à pied" },
  { templateId: "transports", variant: "base", title: "Venu en transports en commun" },
  { templateId: "covoiturage", variant: "base", title: "Venu en covoiturage" },
  { templateId: "teletravail", variant: "base", title: "Journée en télétravail" },
  { templateId: "train", variant: "km", title: "Train au lieu de l'avion", pick: "distance" },
  { templateId: "vacances_train", variant: "base", title: "Vacances sans avion" },
  { templateId: "vege", variant: "repas", title: "Repas végé" },
  { templateId: "moins_boeuf", variant: "base", title: "Poulet ou poisson plutôt que bœuf" },
  { templateId: "antigaspi", variant: "base", title: "Repas anti-gaspi (restes, invendus)" },
  { templateId: "eau_robinet", variant: "base", title: "Gourde ou eau du robinet" },
  { templateId: "occasion", variant: "*", title: "Vêtement d'occasion", pick: "items" },
  { templateId: "reparation", variant: "*", title: "Appareil réparé ou reconditionné", pick: "items" },
  { templateId: "escaliers", variant: "base", title: "Escaliers plutôt que l'ascenseur" },
  { templateId: "ecran", variant: "base", title: "Ordinateur éteint le soir" },
  { templateId: "chauffage", variant: "base", title: "Chauffage baissé d'1 °C cette semaine" },
  { templateId: "ramassage", variant: "base", title: "Geste pour la nature (compost, ramassage, plantation…)" },
];

/** Combien d'articles d'un coup, par action « items » (comme les plafonds en base). */
const ITEMS_MAX: Record<string, number> = { occasion: 3, reparation: 1 };

const THEME_OF: Record<string, Theme> = {
  velo: "trajets",
  teletravail: "trajets",
  eau_robinet: "repas",
  antigaspi: "repas",
  compost: "nature",
  ramassage: "nature",
  sciences: "nature",
  plantation: "nature",
  transports: "trajets",
  covoiturage: "trajets",
  train: "voyages",
  vacances_train: "voyages",
  vege: "repas",
  moins_boeuf: "repas",
  vegetalien: "repas",
  occasion: "achats",
  reparation: "achats",
  appli_occasion: "achats",
  appli_antigaspi: "repas",
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
      return "Venu à vélo ou à pied";
    case "teletravail":
      return "Journée en télétravail";
    case "eau_robinet":
      return "Gourde ou eau du robinet";
    case "transports":
      return "Venu en transports en commun";
    case "covoiturage":
      return "Venu en covoiturage";
    case "train":
      return variant === "km" ? "Train au lieu de l'avion" : `Train au lieu de l'avion · ${v?.label ?? variant}`;
    case "vacances_train":
      return "Vacances sans avion";
    case "vege":
      return variant === "repas" ? "Repas végé" : variant === "boeuf" ? "Repas végé au lieu de bœuf" : "Repas végé au lieu de porc, poulet ou poisson";
    case "moins_boeuf":
      return "Poulet ou poisson plutôt que bœuf";
    case "ecran":
      return "Ordinateur éteint le soir";
    case "occasion":
      return `Acheté d'occasion : ${(v?.label ?? variant).toLowerCase()}`;
    case "reparation":
      return `Réparé ou reconditionné : ${(v?.label ?? variant).toLowerCase()}`;
    case "chauffage":
      return "Chauffage baissé de 1 °C cette semaine";
    case "appli_occasion":
      return `Acheté d'occasion sur une appli : ${(v?.label ?? variant).toLowerCase()}`;
    case "appli_antigaspi":
      return "Panier anti-gaspi via une appli";
    default:
      return t?.title ?? "Action";
  }
}

export function themeOf(templateId: string): Theme {
  return THEME_OF[templateId] ?? "bureau";
}

/** Les 16 actions du +, avec leur gain pour cette personne. */
export function actionItems(h: Habits): ActionItem[] {
  return QUICK.flatMap((q) => {
    const t = TEMPLATE_BY_ID[q.templateId];
    if (!t) return [];
    const base = {
      key: `${q.templateId}:${q.variant}`,
      templateId: q.templateId,
      variant: q.variant,
      title: q.title,
      theme: q.theme ?? themeOf(q.templateId),
      points: t.pointsPerUnit,
      requiresConfirm: t.requiresConfirm,
      category: t.category,
      pick: q.pick,
    };
    if (q.pick === "items") {
      const choices = t.variants.map((v) => {
        const impact = unitImpact(t.id, v.key, h);
        return { variant: v.key, label: v.label, kg: impact.eligible ? impact.kg : 0, max: ITEMS_MAX[t.id] ?? 1 };
      });
      const eligible = choices.filter((c) => c.kg > 0);
      // Le CO₂ affiché : celui du choix le moins émetteur (le détail se fait dans l'action).
      const kg = eligible.length ? Math.min(...eligible.map((c) => c.kg)) : 0;
      return [{ ...base, kg, choices, note: kg > 0 ? undefined : unitImpact(t.id, t.variants[0].key, h).reason }];
    }
    if (q.pick === "distance") {
      // Le train : CO₂ selon la distance saisie ; on montre celui d'un trajet de 500 km.
      const impact = unitImpact(t.id, "500", h);
      return [{ ...base, kg: impact.eligible ? impact.kg : 0, note: impact.eligible ? undefined : impact.reason }];
    }
    const impact = unitImpact(t.id, q.variant, h);
    return [{ ...base, kg: impact.eligible ? impact.kg : 0, note: impact.eligible ? undefined : impact.reason }];
  });
}
