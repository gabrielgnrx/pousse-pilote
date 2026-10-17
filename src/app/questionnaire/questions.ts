import type { BilanAnswers } from "@/lib/co2/footprint.ts";

type NumKey = {
  [K in keyof BilanAnswers]: BilanAnswers[K] extends number ? K : never;
}[keyof BilanAnswers];

export interface Choice<T> {
  value: T;
  label: string;
}

export type Field =
  | { kind: "choice"; key: keyof BilanAnswers; options: Choice<string | number>[] }
  | { kind: "range"; key: NumKey; min: number; max: number; step: number; unit: string };

export interface Step {
  category: string;
  question: string;
  why: string;
  fields: { label?: string; field: Field }[];
}

const counts = (values: number[], suffix = "") =>
  values.map((v) => ({ value: v, label: `${v}${suffix}` }));

export const DEFAULT_ANSWERS: BilanAnswers = {
  commuteMode: "voiture_seul",
  commuteKm: 10,
  commuteDaysPerWeek: 4,
  carType: "thermique",
  carOtherKmYear: 5000,
  shortFlightsYear: 0,
  longFlightsYear: 0,
  beefMealsWeek: 2,
  otherMeatMealsWeek: 4,
  heating: "gaz",
  surfaceM2: 50,
  householdSize: 2,
  newClothesYear: 10,
  phoneEveryYears: 3,
  newDevicesYear: 0,
};

export const STEPS: Step[] = [
  {
    category: "Transports",
    question: "Comment vas-tu au travail le plus souvent ?",
    why: "Sert à calculer ce que tes défis vélo, métro ou covoiturage remplacent vraiment.",
    fields: [
      {
        field: {
          kind: "choice",
          key: "commuteMode",
          options: [
            { value: "voiture_seul", label: "En voiture, seul" },
            { value: "voiture_electrique", label: "En voiture électrique, seul" },
            { value: "covoiturage", label: "En covoiturage" },
            { value: "transports_en_commun", label: "En transports en commun" },
            { value: "velo", label: "À vélo" },
            { value: "marche_teletravail", label: "À pied, ou en télétravail" },
          ],
        },
      },
    ],
  },
  {
    category: "Transports",
    question: "Ton trajet domicile-travail",
    why: "Un trajet simple (aller seulement). Les jours de télétravail ne comptent pas.",
    fields: [
      { label: "Distance d'un aller", field: { kind: "range", key: "commuteKm", min: 0, max: 60, step: 1, unit: "km" } },
      { label: "Jours sur place par semaine", field: { kind: "choice", key: "commuteDaysPerWeek", options: counts([0, 1, 2, 3, 4, 5]) } },
    ],
  },
  {
    category: "Transports",
    question: "As-tu une voiture ?",
    why: "Pour tes trajets hors travail : week-ends, courses, vacances.",
    fields: [
      {
        field: {
          kind: "choice",
          key: "carType",
          options: [
            { value: "thermique", label: "Oui, essence, diesel ou hybride" },
            { value: "electrique", label: "Oui, électrique" },
            { value: "aucune", label: "Non" },
          ],
        },
      },
    ],
  },
  {
    category: "Transports",
    question: "En dehors du travail, combien de km en voiture par an ?",
    why: "Un aller-retour Paris–Lyon fait environ 900 km.",
    fields: [
      {
        field: {
          kind: "choice",
          key: "carOtherKmYear",
          options: [0, 2000, 5000, 10000, 15000, 20000].map((v) => ({
            value: v,
            label: v === 0 ? "Aucun" : `${v.toLocaleString("fr-FR")} km`,
          })),
        },
      },
    ],
  },
  {
    category: "Transports",
    question: "Combien d'allers-retours en avion de moins de 1 000 km par an ?",
    why: "Paris–Marseille, Paris–Barcelone, Paris–Londres…",
    fields: [{ field: { kind: "choice", key: "shortFlightsYear", options: counts([0, 1, 2, 3, 4, 6]) } }],
  },
  {
    category: "Transports",
    question: "Et en long-courrier, plus de 1 000 km ?",
    why: "Un aller-retour Paris–New York émet plus d'une tonne de CO₂ par passager.",
    fields: [{ field: { kind: "choice", key: "longFlightsYear", options: counts([0, 1, 2, 3, 4]) } }],
  },
  {
    category: "Alimentation",
    question: "Combien de repas avec du bœuf ou du veau par semaine ?",
    why: "Un repas au bœuf émet environ 6 fois plus qu'un repas végétarien.",
    fields: [{ field: { kind: "choice", key: "beefMealsWeek", options: counts([0, 1, 2, 3, 4, 5, 7, 10]) } }],
  },
  {
    category: "Alimentation",
    question: "Et avec du porc, du poulet ou du poisson ?",
    why: "Sur 14 repas par semaine, les autres sont comptés comme végétariens.",
    fields: [{ field: { kind: "choice", key: "otherMeatMealsWeek", options: counts([0, 1, 2, 3, 4, 5, 7, 10]) } }],
  },
  {
    category: "Logement",
    question: "Comment est chauffé ton logement ?",
    why: "Le mode de chauffage change l'impact d'un degré en moins d'un facteur 15.",
    fields: [
      {
        field: {
          kind: "choice",
          key: "heating",
          options: [
            { value: "gaz", label: "Chaudière au gaz" },
            { value: "electrique", label: "Électrique (radiateurs)" },
            { value: "pompe_a_chaleur", label: "Pompe à chaleur" },
            { value: "fioul", label: "Fioul" },
            { value: "reseau_de_chaleur", label: "Chauffage collectif urbain" },
            { value: "poele_granules", label: "Poêle à granulés" },
            { value: "poele_buches", label: "Poêle à bûches" },
            { value: "inconnu", label: "Je ne sais pas" },
          ],
        },
      },
    ],
  },
  {
    category: "Logement",
    question: "Quelle est la surface de ton logement ?",
    why: "Le chauffage dépend surtout de la surface chauffée.",
    fields: [{ field: { kind: "range", key: "surfaceM2", min: 10, max: 200, step: 5, unit: "m²" } }],
  },
  {
    category: "Logement",
    question: "Combien êtes-vous à y vivre ?",
    why: "Le chauffage est partagé entre les habitants.",
    fields: [{ field: { kind: "choice", key: "householdSize", options: counts([1, 2, 3, 4, 5, 6]) } }],
  },
  {
    category: "Consommation",
    question: "Combien de vêtements neufs achètes-tu par an ?",
    why: "Fabriquer un jean neuf émet environ 25 kg de CO₂.",
    fields: [{ field: { kind: "choice", key: "newClothesYear", options: counts([0, 5, 10, 20, 40]) } }],
  },
  {
    category: "Consommation",
    question: "Tous les combien changes-tu de smartphone neuf ?",
    why: "99 % de l'empreinte d'un smartphone vient de sa fabrication.",
    fields: [
      {
        field: {
          kind: "choice",
          key: "phoneEveryYears",
          options: [
            { value: 1, label: "Tous les ans" },
            { value: 2, label: "Tous les 2 ans" },
            { value: 3, label: "Tous les 3 ans" },
            { value: 5, label: "5 ans ou plus" },
            { value: 0, label: "Jamais neuf (reconditionné, donné)" },
          ],
        },
      },
    ],
  },
  {
    category: "Consommation",
    question: "Combien d'autres appareils électroniques neufs achètes-tu par an ?",
    why: "Ordinateur, tablette, console, télé… Fabriquer un ordinateur portable émet environ 190 kg de CO₂.",
    fields: [
      {
        field: {
          kind: "choice",
          key: "newDevicesYear",
          options: [
            { value: 0, label: "Aucun" },
            { value: 1, label: "1 par an" },
            { value: 2, label: "2 par an" },
            { value: 3, label: "3 ou plus" },
          ],
        },
      },
    ],
  },
];
