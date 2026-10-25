/**
 * Facteurs d'émission utilisés par Pousse.
 *
 * Source unique : supabase/data/emission_factors.json (Base Empreinte et Agribalyse via Impact CO₂,
 * ADEME), d'où sont générés factors.data.ts et la table SQL emission_factors (migration 0026).
 * Le calcul officiel est fait par la base (ef(), unit_kg) ; ce module sert aux aperçus et aux tests.
 */

export const SOURCES = {
  transport: "https://impactco2.fr/outils/transport",
  alimentation: "https://impactco2.fr/outils/alimentation",
  habillement: "https://impactco2.fr/outils/habillement",
  numerique: "https://impactco2.fr/outils/numerique",
  chauffage: "https://impactco2.fr/outils/chauffage",
  boisson: "https://impactco2.fr/outils/boisson",
  saison: "https://impactco2.fr/outils/fruitsetlegumes",
  servicesPublics: "https://nosgestesclimat.fr/nouveautes/lempreinte-climat-des-services-societaux",
} as const;

import { FACTOR_DATA, type FactorSlug } from "./factors.data.ts";

/** La valeur d'un facteur (kg CO₂e par unité). Erreur si le facteur n'a pas encore de valeur sourcée. */
export function factor(slug: FactorSlug): number {
  const v: number | null = FACTOR_DATA[slug].kg;
  if (v === null) throw new Error(`Facteur sans valeur sourcée : ${slug}`);
  return v;
}

/** kg CO2e par km et par personne (Base Empreinte via Impact CO₂, ADEME). */
export const TRANSPORT_KG_PER_KM = {
  voiture_thermique: factor("voiture_thermique"),
  voiture_electrique: factor("voiture_electrique"),
  covoiturage_2: factor("covoiturage_2"),
  metro: factor("metro"),
  rer: factor("rer"),
  tram: factor("tram"),
  bus_thermique: factor("bus_thermique"),
  velo: factor("velo"),
  velo_electrique: factor("velo_electrique"),
  marche: factor("velo"),
  tgv: factor("tgv"),
  avion_court: factor("avion_court"),
  avion_moyen_long: factor("avion_moyen_long"),
} as const;

/** kg CO2e par repas (Agribalyse 3.2 via Impact CO₂). */
export const MEAL_KG = {
  boeuf: factor("repas_boeuf"),
  veau: factor("repas_veau"),
  porc: factor("repas_porc"),
  poulet: factor("repas_poulet"),
  saumon: factor("repas_poisson"),
  vegetarien: factor("repas_vegetarien"),
  vegetalien: factor("repas_vegetalien"),
} as const;

/** kg CO2e par litre (Agribalyse 3.2 via Impact CO₂). L'eau du robinet y est à 0 kg (arrondi). */
export const DRINK_KG_PER_L = {
  eau_bouteille: factor("eau_bouteille"),
  eau_robinet: factor("eau_robinet"),
} as const;

/** kg CO2e pour un article neuf (Impact CO₂, ADEME). */
export const CLOTHING_KG = {
  tshirt: factor("tshirt_neuf"),
  chemise: factor("chemise_neuve"),
  chaussures_cuir: factor("chaussures_cuir_neuves"),
  jean: factor("jean_neuf"),
  pull_laine: factor("pull_laine_neuf"),
  manteau: factor("manteau_neuf"),
} as const;

/** kg CO2e par appareil neuf, fabrication et usage (Impact CO₂, ADEME). */
export const DEVICE_KG = {
  smartphone: factor("smartphone_neuf"),
  ordinateur_portable: factor("ordinateur_portable_neuf"),
  television: factor("television_neuve"),
} as const;

/**
 * kg CO2e par m² et par an selon le mode de chauffage.
 * Dérivé de l'API Impact CO₂ (valeur pour 100 m², divisée par 100).
 */
export const HEATING_KG_PER_M2_YEAR = {
  gaz: factor("chauffage_gaz"),
  fioul: factor("chauffage_fioul"),
  electrique: factor("chauffage_electrique"),
  pompe_a_chaleur: factor("chauffage_pompe_a_chaleur"),
  reseau_de_chaleur: factor("chauffage_reseau_de_chaleur"),
  poele_granules: factor("chauffage_poele_granules"),
  poele_buches: factor("chauffage_poele_buches"),
  chaudiere_granules: factor("chauffage_chaudiere_granules"),
  chaudiere_buches: factor("chauffage_chaudiere_buches"),
} as const;

/*
 * Hypothèses de calcul (pas des facteurs d'émission) : elles ne viennent pas d'une base officielle
 * avec un identifiant précis. Elles sont signalées dans PLAN.md (§ 4) en attendant une source.
 */
/** TODO source : baisse de consommation de chauffage par degré en moins (citée « ADEME », sans référence). */
export const HEATING_SAVING_PER_DEGREE = 0.07;

/** Semaines de chauffe retenues pour répartir un gain annuel. */
export const HEATING_WEEKS_PER_YEAR = 30;

/**
 * TODO source : part commune à tous les Français (services publics), ordre de grandeur donné
 * par Nos Gestes Climat : « environ 1 tonne ». À remplacer par le modèle complet.
 */
export const SHARED_SERVICES_KG_YEAR = 1000;

/** Semaines travaillées retenues pour annualiser les trajets domicile-travail. */
export const WORK_WEEKS_PER_YEAR = 45;

export type CommuteMode =
  | "voiture_seul"
  | "voiture_electrique"
  | "covoiturage"
  | "transports_en_commun"
  | "velo"
  | "marche_teletravail";

/** Facteur par km et par personne pour chaque mode de trajet domicile-travail. */
export const COMMUTE_KG_PER_KM: Record<CommuteMode, number> = {
  voiture_seul: TRANSPORT_KG_PER_KM.voiture_thermique,
  voiture_electrique: TRANSPORT_KG_PER_KM.voiture_electrique,
  covoiturage: TRANSPORT_KG_PER_KM.covoiturage_2,
  // Moyenne métro / RER, les deux modes les plus fréquents en Île-de-France.
  transports_en_commun: (TRANSPORT_KG_PER_KM.metro + TRANSPORT_KG_PER_KM.rer) / 2,
  velo: TRANSPORT_KG_PER_KM.velo,
  marche_teletravail: 0,
};

export type HeatingMode = keyof typeof HEATING_KG_PER_M2_YEAR | "inconnu";
