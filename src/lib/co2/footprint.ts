/**
 * Bilan carbone simplifié de Pousse.
 *
 * Il couvre les postes que les défis peuvent faire bouger (trajets, avion, repas,
 * chauffage, vêtements, smartphone, appareils électroniques) avec les facteurs ADEME de factors.ts, plus la
 * part commune des services publics. L'électricité spécifique, les loisirs et les
 * autres achats (hors vêtements et électronique) ne sont pas encore couverts : le résultat est donc une estimation
 * basse, affichée comme telle. Étape suivante prévue : brancher le modèle complet
 * Nos Gestes Climat (publicodes), voir README.
 */
import {
  COMMUTE_KG_PER_KM,
  CLOTHING_KG,
  DEVICE_KG,
  HEATING_KG_PER_M2_YEAR,
  MEAL_KG,
  SHARED_SERVICES_KG_YEAR,
  TRANSPORT_KG_PER_KM,
  WORK_WEEKS_PER_YEAR,
  type CommuteMode,
  type HeatingMode,
} from "./factors.ts";

export type CarType = "thermique" | "electrique" | "aucune";

export interface BilanAnswers {
  commuteMode: CommuteMode;
  /** Distance d'un trajet simple domicile-travail, en km. */
  commuteKm: number;
  commuteDaysPerWeek: number;
  carType: CarType;
  /** Kilomètres en voiture par an hors trajets domicile-travail. */
  carOtherKmYear: number;
  /** Allers-retours en avion de moins de 1 000 km par an. */
  shortFlightsYear: number;
  /** Allers-retours en avion de plus de 1 000 km par an. */
  longFlightsYear: number;
  beefMealsWeek: number;
  /** Repas avec porc, poulet ou poisson par semaine. */
  otherMeatMealsWeek: number;
  heating: HeatingMode;
  surfaceM2: number;
  householdSize: number;
  newClothesYear: number;
  /** Tous les combien d'années un smartphone neuf est acheté (0 = jamais neuf). */
  phoneEveryYears: number;
  /** Autres appareils électroniques neufs par an (ordinateur, tablette, console, télé). */
  newDevicesYear: number;
}

export interface Habits {
  commuteMode: CommuteMode;
  commuteKm: number;
  commuteDaysPerWeek: number;
  beefMealsWeek: number;
  otherMeatMealsWeek: number;
  shortFlightsYear: number;
  longFlightsYear: number;
  newClothesYear: number;
  buysNewPhone: boolean;
  newDevicesYear: number;
  heating: HeatingMode;
  /** Émissions annuelles du chauffage attribuées à la personne, en kg. */
  heatingKgYear: number;
}

export interface Footprint {
  totalKg: number;
  byCategory: {
    transport: number;
    alimentation: number;
    logement: number;
    consommation: number;
    services: number;
  };
  habits: Habits;
  /** Hypothèses prises par défaut, à afficher à l'utilisateur. */
  assumptions: string[];
}

/** Distances retenues pour un aller-retour en avion. */
export const SHORT_FLIGHT_KM_ROUND_TRIP = 1400;
export const LONG_FLIGHT_KM_ROUND_TRIP = 12000;
export const MEALS_PER_WEEK = 14;
export const WEEKS_PER_YEAR = 52;
/** Article de vêtement « moyen » : la chemise en coton, valeur intermédiaire ADEME. */
export const AVERAGE_CLOTHING_KG = CLOTHING_KG.chemise;
/** Appareil électronique « moyen » : l'ordinateur portable, valeur ADEME. */
export const AVERAGE_DEVICE_KG = DEVICE_KG.ordinateur_portable;
/** Repas avec porc, poulet ou poisson : moyenne des trois valeurs Agribalyse. */
export const OTHER_MEAT_MEAL_KG = (MEAL_KG.porc + MEAL_KG.poulet + MEAL_KG.saumon) / 3;

const clamp = (n: number, min: number, max: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;

const round = (n: number) => Math.round(n);

export function normalizeAnswers(a: BilanAnswers): BilanAnswers {
  const beef = clamp(a.beefMealsWeek, 0, MEALS_PER_WEEK);
  return {
    ...a,
    commuteKm: clamp(a.commuteKm, 0, 80),
    commuteDaysPerWeek: clamp(a.commuteDaysPerWeek, 0, 5),
    carOtherKmYear: clamp(a.carOtherKmYear, 0, 50000),
    shortFlightsYear: clamp(a.shortFlightsYear, 0, 20),
    longFlightsYear: clamp(a.longFlightsYear, 0, 10),
    beefMealsWeek: beef,
    otherMeatMealsWeek: clamp(a.otherMeatMealsWeek, 0, MEALS_PER_WEEK - beef),
    surfaceM2: clamp(a.surfaceM2, 9, 400),
    householdSize: clamp(a.householdSize, 1, 10),
    newClothesYear: clamp(a.newClothesYear, 0, 200),
    phoneEveryYears: clamp(a.phoneEveryYears, 0, 10),
    // Absent des bilans faits avant l'ajout de la question : compté comme 0.
    newDevicesYear: clamp(a.newDevicesYear, 0, 10),
  };
}

export function computeFootprint(raw: BilanAnswers): Footprint {
  const a = normalizeAnswers(raw);
  const assumptions: string[] = [];

  // Transports
  const commuteFactor = COMMUTE_KG_PER_KM[a.commuteMode];
  const commute =
    a.commuteKm * 2 * a.commuteDaysPerWeek * WORK_WEEKS_PER_YEAR * commuteFactor;
  const otherCarFactor =
    a.carType === "electrique"
      ? TRANSPORT_KG_PER_KM.voiture_electrique
      : TRANSPORT_KG_PER_KM.voiture_thermique;
  const otherCar = a.carType === "aucune" ? 0 : a.carOtherKmYear * otherCarFactor;
  const flights =
    a.shortFlightsYear * SHORT_FLIGHT_KM_ROUND_TRIP * TRANSPORT_KG_PER_KM.avion_court +
    a.longFlightsYear * LONG_FLIGHT_KM_ROUND_TRIP * TRANSPORT_KG_PER_KM.avion_moyen_long;
  if (a.shortFlightsYear + a.longFlightsYear > 0) {
    assumptions.push(
      "Avion : 1 400 km par aller-retour court, 12 000 km par aller-retour long.",
    );
  }
  const transport = commute + otherCar + flights;

  // Alimentation : 14 repas par semaine, le reste est végétarien.
  const vegMeals = MEALS_PER_WEEK - a.beefMealsWeek - a.otherMeatMealsWeek;
  const alimentation =
    WEEKS_PER_YEAR *
    (a.beefMealsWeek * MEAL_KG.boeuf +
      a.otherMeatMealsWeek * OTHER_MEAT_MEAL_KG +
      vegMeals * MEAL_KG.vegetarien);

  // Logement : chauffage seulement, partagé entre les membres du foyer.
  let heatingMode = a.heating;
  if (heatingMode === "inconnu") {
    heatingMode = "gaz";
    assumptions.push("Chauffage inconnu : estimé comme une chaudière à gaz.");
  }
  const heatingKgYear =
    (a.surfaceM2 * HEATING_KG_PER_M2_YEAR[heatingMode]) / a.householdSize;
  const logement = heatingKgYear;

  // Consommation
  const clothes = a.newClothesYear * AVERAGE_CLOTHING_KG;
  const phone = a.phoneEveryYears > 0 ? DEVICE_KG.smartphone / a.phoneEveryYears : 0;
  const devices = a.newDevicesYear * AVERAGE_DEVICE_KG;
  if (a.newDevicesYear > 0) {
    assumptions.push("Appareils électroniques : chacun compté comme un ordinateur portable neuf (193 kg).");
  }
  const consommation = clothes + phone + devices;

  const services = SHARED_SERVICES_KG_YEAR;

  const byCategory = {
    transport: round(transport),
    alimentation: round(alimentation),
    logement: round(logement),
    consommation: round(consommation),
    services: round(services),
  };
  const totalKg = Object.values(byCategory).reduce((s, v) => s + v, 0);

  return {
    totalKg,
    byCategory,
    assumptions,
    habits: {
      commuteMode: a.commuteMode,
      commuteKm: a.commuteKm,
      commuteDaysPerWeek: a.commuteDaysPerWeek,
      beefMealsWeek: a.beefMealsWeek,
      otherMeatMealsWeek: a.otherMeatMealsWeek,
      shortFlightsYear: a.shortFlightsYear,
      longFlightsYear: a.longFlightsYear,
      newClothesYear: a.newClothesYear,
      buysNewPhone: a.phoneEveryYears > 0,
      newDevicesYear: a.newDevicesYear,
      heating: heatingMode,
      heatingKgYear: round(heatingKgYear),
    },
  };
}
