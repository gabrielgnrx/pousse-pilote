/**
 * Facteurs d'émission utilisés par Pousse.
 *
 * Règle : chaque valeur vient d'une source publique de l'ADEME, relevée le 15/10/2026.
 * Toute modification doit aussi être reportée dans supabase/migrations/0003_seed.sql
 * (catalogue des défis), qui sert au calcul officiel côté base de données.
 */

export const SOURCES = {
  transport: "https://impactco2.fr/outils/transport",
  alimentation: "https://impactco2.fr/outils/alimentation",
  habillement: "https://impactco2.fr/outils/habillement",
  numerique: "https://impactco2.fr/outils/numerique",
  chauffage: "https://impactco2.fr/outils/chauffage",
  servicesPublics: "https://nosgestesclimat.fr/nouveautes/lempreinte-climat-des-services-societaux",
} as const;

/** kg CO2e par km et par personne (Impact CO₂, ADEME). */
export const TRANSPORT_KG_PER_KM = {
  voiture_thermique: 0.1106,
  voiture_electrique: 0.0121,
  covoiturage_2: 0.0553,
  metro: 0.0042,
  rer: 0.0066,
  tram: 0.0038,
  bus_thermique: 0.1135,
  velo: 0,
  velo_electrique: 0.0022,
  marche: 0,
  tgv: 0.0023,
  avion_court: 0.2242,
  avion_moyen_long: 0.1665,
} as const;

/** kg CO2e par repas (Agribalyse 3.2 via Impact CO₂). */
export const MEAL_KG = {
  boeuf: 4.97,
  veau: 4.12,
  porc: 1.65,
  poulet: 1.46,
  saumon: 1.46,
  vegetarien: 0.85,
  vegetalien: 0.54,
} as const;

/** kg CO2e pour un article neuf (Impact CO₂, ADEME). */
export const CLOTHING_KG = {
  tshirt: 6.43,
  chemise: 13.2,
  chaussures_cuir: 15,
  jean: 25.1,
  pull_laine: 56.7,
  manteau: 101,
} as const;

/** kg CO2e par appareil neuf, fabrication et usage (Impact CO₂, ADEME). */
export const DEVICE_KG = {
  smartphone: 80.2,
  ordinateur_portable: 193,
  television: 370,
} as const;

/**
 * kg CO2e par m² et par an selon le mode de chauffage.
 * Dérivé de l'API Impact CO₂ (valeur pour 100 m², divisée par 100).
 */
export const HEATING_KG_PER_M2_YEAR = {
  gaz: 17.84,
  fioul: 34.97,
  electrique: 2.14,
  pompe_a_chaleur: 1.21,
  reseau_de_chaleur: 11.08,
  poele_granules: 5.92,
  poele_buches: 8.51,
  chaudiere_granules: 3.96,
  chaudiere_buches: 5.7,
} as const;

/** Baisse de consommation de chauffage par degré en moins (ADEME). */
export const HEATING_SAVING_PER_DEGREE = 0.07;

/** Semaines de chauffe retenues pour répartir un gain annuel. */
export const HEATING_WEEKS_PER_YEAR = 30;

/**
 * Part commune à tous les Français (services publics), ordre de grandeur donné
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
