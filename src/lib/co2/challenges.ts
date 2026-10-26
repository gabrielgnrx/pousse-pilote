/**
 * Catalogue des défis et calcul du CO₂ évité.
 *
 * Principe : un défi ne rapporte du CO₂ que s'il remplace une habitude déclarée dans
 * le bilan. Le gain est toujours « habitude remplacée − action réalisée ».
 * Ce fichier sert à l'affichage et aux aperçus ; le calcul qui fait foi est refait
 * dans la base (fonction SQL validate_challenge_day), avec les mêmes valeurs.
 */
import {
  CLOTHING_KG,
  COMMUTE_KG_PER_KM,
  DRINK_KG_PER_L,
  DEVICE_KG,
  HEATING_SAVING_PER_DEGREE,
  HEATING_WEEKS_PER_YEAR,
  MEAL_KG,
  SOURCES,
  TRANSPORT_KG_PER_KM,
  type CommuteMode,
} from "./factors.ts";
import { LONG_FLIGHT_KM_ROUND_TRIP, MEALS_PER_WEEK, OTHER_MEAT_MEAL_KG, type Habits } from "./footprint.ts";

export type Category = "transport" | "alimentation" | "consommation" | "logement" | "quotidien" | "nature";

export interface Variant {
  key: string;
  label: string;
}

export interface ChallengeTemplate {
  id: string;
  category: Category;
  title: string;
  /** Unité comptée à chaque validation. */
  unit: { one: string; many: string };
  variants: Variant[];
  variantQuestion?: string;
  proofHint: string;
  pointsPerUnit: number;
  /** Nombre maximum d'unités validables par jour, toutes variantes confondues. */
  dailyCap: number;
  defaultTarget: number;
  source: string;
  /** « expert » : pour aller plus loin quand les gestes du quotidien sont déjà acquis. */
  level?: "standard" | "expert";
  /** Explication courte affichée dans le catalogue pour les défis expert. */
  pitch?: string;
  /** Action qui rapporte beaucoup : confirmation sur l'honneur, et plafond annuel calé sur le bilan (0043). */
  requiresConfirm?: boolean;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  transport: "Transport",
  alimentation: "Alimentation",
  consommation: "Consommation",
  logement: "Logement",
  quotidien: "Au quotidien",
  nature: "Nature",
};

export const TEMPLATES: ChallengeTemplate[] = [
  {
    id: "velo",
    category: "transport",
    title: "Vélo au lieu de la voiture",
    unit: { one: "trajet", many: "trajets" },
    variants: [{ key: "base", label: "Ton trajet domicile-travail" }],
    proofHint: "Photo de ton vélo ou confirmation d'un collègue",
    pointsPerUnit: 10,
    dailyCap: 2,
    defaultTarget: 10,
    source: SOURCES.transport,
  },
  {
    id: "transports",
    category: "transport",
    title: "Métro ou RER au lieu de la voiture",
    unit: { one: "trajet", many: "trajets" },
    variants: [{ key: "base", label: "Ton trajet domicile-travail" }],
    proofHint: "Photo de ton titre de transport",
    pointsPerUnit: 10,
    dailyCap: 2,
    defaultTarget: 10,
    source: SOURCES.transport,
  },
  {
    id: "covoiturage",
    category: "transport",
    title: "Covoiturer à deux au lieu de rouler seul",
    unit: { one: "trajet", many: "trajets" },
    variants: [{ key: "base", label: "Ton trajet domicile-travail" }],
    proofHint: "Confirmation du collègue covoituré",
    pointsPerUnit: 10,
    dailyCap: 2,
    defaultTarget: 8,
    source: SOURCES.transport,
  },
  {
    id: "teletravail",
    category: "transport",
    title: "Télétravail au lieu du trajet",
    unit: { one: "jour", many: "jours" },
    variants: [{ key: "base", label: "Un aller-retour domicile-travail évité" }],
    proofHint: "Aucune preuve demandée",
    pointsPerUnit: 10,
    dailyCap: 1,
    defaultTarget: 8,
    source: SOURCES.transport,
  },
  {
    id: "train",
    category: "transport",
    title: "Train au lieu de l'avion",
    unit: { one: "aller simple", many: "allers simples" },
    variantQuestion: "Distance du trajet",
    variants: [
      { key: "300", label: "300 km" },
      { key: "500", label: "500 km" },
      { key: "800", label: "800 km" },
    ],
    proofHint: "Confirmation sur l'honneur",
    pointsPerUnit: 30,
    dailyCap: 2,
    defaultTarget: 3,
    source: SOURCES.transport,
    requiresConfirm: true,
  },
  {
    id: "vege",
    category: "alimentation",
    title: "Repas végétarien",
    unit: { one: "repas", many: "repas" },
    variantQuestion: "Au lieu d'un repas…",
    variants: [
      { key: "repas", label: "habituel (d'après ton bilan)" },
      { key: "boeuf", label: "au bœuf" },
      { key: "autre", label: "au porc, poulet ou poisson" },
    ],
    proofHint: "Photo du plat",
    pointsPerUnit: 10,
    dailyCap: 2,
    defaultTarget: 5,
    source: SOURCES.alimentation,
  },
  {
    id: "eau_robinet",
    category: "alimentation",
    title: "Eau du robinet au lieu d'eau en bouteille",
    unit: { one: "jour", many: "jours" },
    variants: [{ key: "base", label: "Ta consommation d'eau en bouteille du jour" }],
    proofHint: "Photo de ta gourde ou de ta carafe",
    pointsPerUnit: 5,
    dailyCap: 1,
    defaultTarget: 20,
    source: SOURCES.boisson,
  },
  {
    id: "moins_boeuf",
    category: "alimentation",
    title: "Porc, poulet ou poisson au lieu du bœuf",
    unit: { one: "repas", many: "repas" },
    variants: [{ key: "base", label: "Au lieu d'un repas au bœuf" }],
    proofHint: "Photo du plat",
    pointsPerUnit: 10,
    dailyCap: 2,
    defaultTarget: 5,
    source: SOURCES.alimentation,
  },
  {
    id: "occasion",
    category: "consommation",
    title: "Vêtement d'occasion au lieu de neuf",
    unit: { one: "vêtement", many: "vêtements" },
    variantQuestion: "Quel vêtement ?",
    variants: [
      { key: "tshirt", label: "T-shirt" },
      { key: "chemise", label: "Chemise" },
      { key: "chaussures", label: "Chaussures en cuir" },
      { key: "jean", label: "Jean" },
      { key: "pull", label: "Pull en laine" },
      { key: "manteau", label: "Manteau" },
    ],
    proofHint: "Photo de l'achat ou de l'annonce",
    pointsPerUnit: 10,
    dailyCap: 3,
    defaultTarget: 3,
    source: SOURCES.habillement,
  },
  {
    id: "chauffage",
    category: "logement",
    title: "Chauffage baissé de 1 °C",
    unit: { one: "semaine", many: "semaines" },
    variants: [{ key: "base", label: "7 % de ton chauffage déclaré" }],
    proofHint: "Photo du thermostat",
    pointsPerUnit: 10,
    dailyCap: 1,
    defaultTarget: 4,
    source: SOURCES.chauffage,
  },
  // Défis expert : les postes qui restent quand le quotidien est déjà sobre.
  {
    id: "vegetalien",
    category: "alimentation",
    title: "Repas végétalien au lieu de végétarien",
    unit: { one: "repas", many: "repas" },
    variants: [{ key: "base", label: "Au lieu d'un repas végétarien" }],
    proofHint: "Photo du plat",
    pointsPerUnit: 15,
    dailyCap: 2,
    defaultTarget: 10,
    source: SOURCES.alimentation,
    level: "expert",
    pitch: "Déjà végétarien ? Sans œufs ni produits laitiers, un repas émet encore un tiers de moins.",
  },
  {
    id: "vacances_train",
    category: "transport",
    title: "Vacances en train au lieu du long-courrier",
    unit: { one: "aller-retour évité", many: "allers-retours évités" },
    variants: [{ key: "base", label: "Une destination en train plutôt qu'un vol long-courrier" }],
    proofHint: "Confirmation sur l'honneur",
    pointsPerUnit: 150,
    dailyCap: 1,
    defaultTarget: 1,
    source: SOURCES.transport,
    level: "expert",
    pitch: "Le plus gros geste possible : un aller-retour long-courrier pèse à lui seul près de 2 tonnes.",
    requiresConfirm: true,
  },
  {
    id: "reparation",
    category: "consommation",
    title: "Réparer au lieu de racheter neuf",
    unit: { one: "appareil", many: "appareils" },
    variantQuestion: "Quel appareil ?",
    variants: [
      { key: "smartphone", label: "Smartphone" },
      { key: "ordinateur", label: "Ordinateur, tablette ou console" },
    ],
    proofHint: "Confirmation sur l'honneur",
    pointsPerUnit: 60,
    dailyCap: 2,
    defaultTarget: 1,
    source: SOURCES.numerique,
    level: "expert",
    pitch: "La fabrication fait l'essentiel de l'empreinte d'un appareil : le garder, c'est l'éviter.",
    requiresConfirm: true,
  },
];

/**
 * Petits gestes du quotidien : ils s'enregistrent avec le bouton +, sans défi.
 * Aucun gain de CO₂ mesurable (ordre de grandeur trop faible), mais ils comptent pour la série.
 * Mêmes valeurs que supabase/migrations/0012_actions_libres.sql.
 */
export const GESTES: ChallengeTemplate[] = [
  {
    id: "escaliers",
    category: "quotidien",
    title: "Escaliers plutôt que l'ascenseur",
    unit: { one: "fois", many: "fois" },
    variants: [{ key: "base", label: "Aujourd'hui" }],
    proofHint: "Aucune preuve demandée",
    pointsPerUnit: 2,
    dailyCap: 1,
    defaultTarget: 5,
    source: SOURCES.transport,
  },
  {
    id: "gourde",
    category: "quotidien",
    title: "Gourde ou tasse au lieu d'un gobelet jetable",
    unit: { one: "fois", many: "fois" },
    variants: [{ key: "base", label: "Aujourd'hui" }],
    proofHint: "Aucune preuve demandée",
    pointsPerUnit: 2,
    dailyCap: 1,
    defaultTarget: 5,
    source: SOURCES.alimentation,
  },
  {
    id: "ecran",
    category: "quotidien",
    title: "Ordinateur éteint en partant le soir",
    unit: { one: "fois", many: "fois" },
    variants: [{ key: "base", label: "Aujourd'hui" }],
    proofHint: "Aucune preuve demandée",
    pointsPerUnit: 2,
    dailyCap: 1,
    defaultTarget: 5,
    source: SOURCES.numerique,
  },
];

const nature = (id: string, title: string, points: number): ChallengeTemplate => ({
  id,
  category: "nature",
  title,
  unit: { one: "fois", many: "fois" },
  variants: [{ key: "base", label: "Aujourd'hui" }],
  proofHint: "Une photo pour publier dans le fil",
  pointsPerUnit: points,
  dailyCap: 1,
  defaultTarget: 4,
  source: "https://www.vigienature.fr",
});

GESTES.push(
  {
    id: "antigaspi",
    category: "alimentation",
    title: "Repas anti-gaspi (restes ou panier d'invendus)",
    unit: { one: "repas", many: "repas" },
    variants: [{ key: "base", label: "Aujourd'hui" }],
    proofHint: "Aucune preuve demandée",
    pointsPerUnit: 3,
    dailyCap: 1,
    defaultTarget: 5,
    source: SOURCES.alimentation,
  },
  nature("compost", "Déchets alimentaires au compost", 3),
  nature("ramassage", "Ramassage de déchets dans la nature ou la rue", 5),
  nature("sciences", "Comptage pour un programme de sciences participatives", 5),
  nature("plantation", "Plantation, nichoir ou coin de nature aménagé", 5),
);

/**
 * Anciens achats « via une appli » (0021) : plus proposés depuis le 26/10/2026 (un achat d'occasion est
 * un achat d'occasion, quel que soit l'endroit). Gardés pour afficher l'historique.
 */
export const APP_TEMPLATES: ChallengeTemplate[] = [
  {
    id: "appli_occasion",
    category: "consommation",
    title: "Achat d'occasion sur une appli (Vinted, Leboncoin, Back Market…)",
    unit: { one: "achat", many: "achats" },
    variantQuestion: "Qu'as-tu acheté ?",
    variants: [
      { key: "tshirt", label: "T-shirt" },
      { key: "chemise", label: "Chemise" },
      { key: "chaussures", label: "Chaussures en cuir" },
      { key: "jean", label: "Jean" },
      { key: "pull", label: "Pull en laine" },
      { key: "manteau", label: "Manteau" },
      { key: "smartphone", label: "Smartphone reconditionné" },
      { key: "ordinateur", label: "Ordinateur, tablette ou console reconditionné" },
    ],
    proofHint: "Confirmation sur l'honneur",
    pointsPerUnit: 30,
    dailyCap: 2,
    defaultTarget: 3,
    source: SOURCES.habillement,
    requiresConfirm: true,
  },
  {
    id: "appli_antigaspi",
    category: "alimentation",
    title: "Panier anti-gaspi via une appli (Too Good To Go, Phenix…)",
    unit: { one: "panier", many: "paniers" },
    variants: [{ key: "base", label: "Un panier d'invendus récupéré" }],
    proofHint: "Confirmation sur l'honneur",
    pointsPerUnit: 30,
    dailyCap: 1,
    defaultTarget: 4,
    source: SOURCES.alimentation,
    requiresConfirm: true,
  },
];

/** Remplacer une habitude, ou la réduire : la façon dont le geste est présenté dans « Mon plan ». */
export function verbOf(templateId: string): "Remplacer" | "Réduire" | "Au quotidien" {
  if (["moins_boeuf", "chauffage"].includes(templateId)) return "Réduire";
  if (GESTES.some((g) => g.id === templateId)) return "Au quotidien";
  return "Remplacer";
}

export const TEMPLATE_BY_ID = Object.fromEntries([...TEMPLATES, ...GESTES, ...APP_TEMPLATES].map((t) => [t.id, t])) as Record<
  string,
  ChallengeTemplate
>;

const CAR_MODES: CommuteMode[] = ["voiture_seul", "voiture_electrique"];
const TRANSIT_KG_PER_KM = COMMUTE_KG_PER_KM.transports_en_commun;
const TRAIN_SAVING_PER_KM = TRANSPORT_KG_PER_KM.avion_court - TRANSPORT_KG_PER_KM.tgv;
/** Vacances en train : un aller-retour long-courrier remplacé par 2 000 km de TGV. */
export const HOLIDAY_TRAIN_KM = 2000;
const HOLIDAY_SAVING =
  LONG_FLIGHT_KM_ROUND_TRIP * TRANSPORT_KG_PER_KM.avion_moyen_long - HOLIDAY_TRAIN_KM * TRANSPORT_KG_PER_KM.tgv;
const CLOTHING_BY_VARIANT: Record<string, number> = {
  tshirt: CLOTHING_KG.tshirt,
  chemise: CLOTHING_KG.chemise,
  chaussures: CLOTHING_KG.chaussures_cuir,
  jean: CLOTHING_KG.jean,
  pull: CLOTHING_KG.pull_laine,
  manteau: CLOTHING_KG.manteau,
};

export interface UnitImpact {
  /** kg de CO₂ évités pour une unité ; 0 si le défi ne remplace aucune habitude. */
  kg: number;
  eligible: boolean;
  /** Pourquoi le défi (ou la variante) n'est pas proposé. */
  reason?: string;
  /** Le calcul en clair, affiché sous le chiffre. */
  formula: string;
}

const fmt = (n: number, digits = 2) =>
  n.toLocaleString("fr-FR", { maximumFractionDigits: digits });

const no = (reason: string): UnitImpact => ({ kg: 0, eligible: false, reason, formula: "" });

/** CO₂ évité pour une unité de défi, pour une personne et ses habitudes. */
export function unitImpact(templateId: string, variantKey: string, h: Habits): UnitImpact {
  const commuteFactor = COMMUTE_KG_PER_KM[h.commuteMode];
  const hasCommute = h.commuteKm > 0 && h.commuteDaysPerWeek > 0;

  switch (templateId) {
    case "velo": {
      if (!hasCommute || commuteFactor <= 0)
        return no("Ton trajet domicile-travail déclaré n'émet déjà rien.");
      const kg = h.commuteKm * commuteFactor;
      return { kg, eligible: true, formula: `${fmt(h.commuteKm, 1)} km × ${fmt(commuteFactor, 4)} kg/km` };
    }
    case "transports": {
      if (!hasCommute || commuteFactor <= TRANSIT_KG_PER_KM)
        return no("Ton trajet déclaré émet déjà moins que le métro ou le RER.");
      const kg = h.commuteKm * (commuteFactor - TRANSIT_KG_PER_KM);
      return {
        kg,
        eligible: true,
        formula: `${fmt(h.commuteKm, 1)} km × (${fmt(commuteFactor, 4)} − ${fmt(TRANSIT_KG_PER_KM, 4)}) kg/km`,
      };
    }
    case "covoiturage": {
      if (!hasCommute || !CAR_MODES.includes(h.commuteMode))
        return no("Tu n'as pas déclaré aller au travail seul en voiture.");
      const kg = (h.commuteKm * commuteFactor) / 2;
      return { kg, eligible: true, formula: `${fmt(h.commuteKm, 1)} km × ${fmt(commuteFactor, 4)} kg/km ÷ 2` };
    }
    case "train": {
      if (h.shortFlightsYear <= 0) return no("Aucun vol court déclaré dans ton bilan.");
      const km = Number(variantKey);
      if (!Number.isFinite(km) || km <= 0) return no("Distance inconnue.");
      return {
        kg: km * TRAIN_SAVING_PER_KM,
        eligible: true,
        formula: `${km} km × (${fmt(TRANSPORT_KG_PER_KM.avion_court, 4)} − ${fmt(TRANSPORT_KG_PER_KM.tgv, 4)}) kg/km`,
      };
    }
    case "vege": {
      if (variantKey === "repas") {
        // Le repas habituel du bilan : bœuf et autres viandes, pondérés par les repas déclarés de chacun.
        const meat = h.beefMealsWeek + h.otherMeatMealsWeek;
        if (meat <= 0) return no("Tu n'as pas déclaré manger de viande ou de poisson.");
        const usual = (h.beefMealsWeek * MEAL_KG.boeuf + h.otherMeatMealsWeek * OTHER_MEAT_MEAL_KG) / meat;
        return {
          kg: usual - MEAL_KG.vegetarien,
          eligible: true,
          formula: `repas habituel ${fmt(usual)} − ${fmt(MEAL_KG.vegetarien)} kg (${h.beefMealsWeek} bœuf, ${h.otherMeatMealsWeek} autres viandes par semaine)`,
        };
      }
      if (variantKey === "boeuf") {
        if (h.beefMealsWeek <= 0) return no("Tu n'as pas déclaré manger de bœuf.");
        return {
          kg: MEAL_KG.boeuf - MEAL_KG.vegetarien,
          eligible: true,
          formula: `${fmt(MEAL_KG.boeuf)} − ${fmt(MEAL_KG.vegetarien)} kg par repas`,
        };
      }
      if (variantKey === "autre") {
        if (h.otherMeatMealsWeek <= 0)
          return no("Tu n'as pas déclaré manger de porc, poulet ou poisson.");
        return {
          kg: OTHER_MEAT_MEAL_KG - MEAL_KG.vegetarien,
          eligible: true,
          formula: `${fmt(OTHER_MEAT_MEAL_KG)} − ${fmt(MEAL_KG.vegetarien)} kg par repas`,
        };
      }
      return no("Variante inconnue.");
    }
    case "moins_boeuf": {
      if (h.beefMealsWeek <= 0) return no("Tu n'as pas déclaré manger de bœuf.");
      return {
        kg: MEAL_KG.boeuf - OTHER_MEAT_MEAL_KG,
        eligible: true,
        formula: `${fmt(MEAL_KG.boeuf)} − ${fmt(OTHER_MEAT_MEAL_KG)} kg par repas`,
      };
    }
    case "occasion": {
      if (h.newClothesYear <= 0) return no("Tu n'as pas déclaré acheter de vêtements neufs.");
      const kg = CLOTHING_BY_VARIANT[variantKey];
      if (kg === undefined) return no("Vêtement inconnu.");
      return { kg, eligible: true, formula: `fabrication d'un article neuf évitée : ${fmt(kg, 1)} kg` };
    }
    case "chauffage": {
      if (h.heatingKgYear <= 0) return no("Aucun chauffage déclaré.");
      const kg = (h.heatingKgYear * HEATING_SAVING_PER_DEGREE) / HEATING_WEEKS_PER_YEAR;
      return {
        kg,
        eligible: true,
        formula: `${fmt(h.heatingKgYear, 0)} kg/an × 7 % ÷ ${HEATING_WEEKS_PER_YEAR} semaines`,
      };
    }
    case "vegetalien": {
      const vegMeals = MEALS_PER_WEEK - h.beefMealsWeek - h.otherMeatMealsWeek;
      if (vegMeals <= 0) return no("Tu n'as pas déclaré de repas végétariens.");
      const kg = MEAL_KG.vegetarien - MEAL_KG.vegetalien;
      return { kg, eligible: true, formula: `${fmt(MEAL_KG.vegetarien)} − ${fmt(MEAL_KG.vegetalien)} kg par repas` };
    }
    case "vacances_train": {
      if (h.longFlightsYear <= 0) return no("Aucun vol long-courrier déclaré dans ton bilan.");
      return {
        kg: HOLIDAY_SAVING,
        eligible: true,
        formula: `${fmt(LONG_FLIGHT_KM_ROUND_TRIP, 0)} km × ${fmt(TRANSPORT_KG_PER_KM.avion_moyen_long, 4)} − ${fmt(HOLIDAY_TRAIN_KM, 0)} km × ${fmt(TRANSPORT_KG_PER_KM.tgv, 4)} kg/km`,
      };
    }
    case "reparation": {
      if (variantKey === "smartphone") {
        if (!h.buysNewPhone) return no("Tu n'as pas déclaré acheter de smartphone neuf.");
        return { kg: DEVICE_KG.smartphone, eligible: true, formula: `fabrication d'un smartphone neuf évitée : ${fmt(DEVICE_KG.smartphone, 1)} kg` };
      }
      if (variantKey === "ordinateur") {
        if (h.newDevicesYear <= 0) return no("Tu n'as pas déclaré acheter d'appareils électroniques neufs.");
        return {
          kg: DEVICE_KG.ordinateur_portable,
          eligible: true,
          formula: `fabrication d'un ordinateur portable neuf évitée : ${fmt(DEVICE_KG.ordinateur_portable, 0)} kg`,
        };
      }
      return no("Appareil inconnu.");
    }
    case "teletravail": {
      if (!hasCommute || commuteFactor <= 0)
        return no("Ton trajet domicile-travail déclaré n'émet déjà rien.");
      const kg = 2 * h.commuteKm * commuteFactor;
      return { kg, eligible: true, formula: `2 trajets × ${fmt(h.commuteKm, 1)} km × ${fmt(commuteFactor, 4)} kg/km` };
    }
    case "eau_robinet": {
      const litres = h.bottledWaterLDay ?? 0;
      if (litres <= 0) return no("Tu as déclaré boire déjà l'eau du robinet.");
      return {
        kg: litres * DRINK_KG_PER_L.eau_bouteille,
        eligible: true,
        formula: `${fmt(litres, 1)} L × ${fmt(DRINK_KG_PER_L.eau_bouteille)} kg/L d'eau en bouteille`,
      };
    }
    case "appli_occasion":
      return unitImpact(["smartphone", "ordinateur"].includes(variantKey) ? "reparation" : "occasion", variantKey, h);
    case "appli_antigaspi":
      return no("Pas de CO₂ compté sur un panier, mais 30 pousses avec le reçu.");
    case "escaliers":
    case "gourde":
    case "ecran":
    case "antigaspi":
    case "compost":
    case "ramassage":
    case "sciences":
    case "plantation":
      return no("Pas de CO₂ mesurable, mais ça compte pour ta série.");
    default:
      return no("Défi inconnu.");
  }
}

/** Un défi est proposé si au moins une de ses variantes remplace une habitude. */
export function templateEligibility(t: ChallengeTemplate, h: Habits) {
  const impacts = t.variants.map((v) => ({ variant: v, impact: unitImpact(t.id, v.key, h) }));
  const ok = impacts.filter((i) => i.impact.eligible);
  return {
    eligible: ok.length > 0,
    reason: ok.length === 0 ? impacts[0]?.impact.reason : undefined,
    minKg: ok.length ? Math.min(...ok.map((i) => i.impact.kg)) : 0,
    maxKg: ok.length ? Math.max(...ok.map((i) => i.impact.kg)) : 0,
    impacts,
  };
}

/** Niveau d'impact affiché, sur l'objectif par défaut du défi. */
export function impactLevel(totalKg: number): "fort" | "moyen" | "modeste" {
  if (totalKg >= 50) return "fort";
  if (totalKg >= 10) return "moyen";
  return "modeste";
}

/** Équivalence parlante : kilomètres en voiture thermique. */
export function carKmEquivalent(kg: number) {
  return Math.round(kg / TRANSPORT_KG_PER_KM.voiture_thermique);
}

export function formatKg(kg: number) {
  if (kg >= 1000) return `${fmt(kg / 1000, 1)} t`;
  if (kg >= 10) return `${fmt(kg, 0)} kg`;
  return `${fmt(kg, 1)} kg`;
}

/**
 * Les actions « habitude » : elles rapportent leurs pousses même à 0 kg, quand la personne le fait déjà
 * (même liste que is_habit_action, migration 0024). Le CO₂, lui, reste à 0.
 */
export const HABIT_ACTIONS = ["velo", "transports", "covoiturage", "teletravail", "vege", "moins_boeuf", "vegetalien", "occasion", "chauffage"];
export const isHabitAction = (templateId: string) => HABIT_ACTIONS.includes(templateId);

/** Actions qui se font une fois par semaine au plus (plafond sur 7 jours, comme en base). */
const WEEKLY_ACTIONS = ["chauffage", "reparation", "vacances_train"];
/** Objectif minimum d'un défi : 3, ou 1 pour une action hebdomadaire (check_new_challenge, migration 0024). */
export const minTarget = (templateId: string) => (WEEKLY_ACTIONS.includes(templateId) ? 1 : 3);
