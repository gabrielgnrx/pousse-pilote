/**
 * Contenus de l'onglet « S'informer » : fiches gestes, recettes végé, mini-jeu « Lequel pèse le plus ? ».
 * Tous les chiffres viennent de factors.ts (ADEME, Impact CO₂, Agribalyse) : rien n'est saisi à la main.
 */
import { CLOTHING_KG, DEVICE_KG, DRINK_KG_PER_L, HEATING_SAVING_PER_DEGREE, MEAL_KG, TRANSPORT_KG_PER_KM } from "./co2/factors.ts";

const fr = (n: number, digits = 2) => n.toLocaleString("fr-FR", { maximumFractionDigits: digits });
const OTHER_MEAT = (MEAL_KG.porc + MEAL_KG.poulet + MEAL_KG.saumon) / 3;
const TRANSIT = (TRANSPORT_KG_PER_KM.metro + TRANSPORT_KG_PER_KM.rer) / 2;

export interface Fiche {
  why: string;
  how: string[];
  trap?: string;
}

/** Une fiche par geste : pourquoi il compte, comment s'y prendre, le piège à éviter. */
export const FICHES: Record<string, Fiche> = {
  velo: {
    why: `Une voiture thermique émet ${fr(TRANSPORT_KG_PER_KM.voiture_thermique, 3)} kg de CO₂ par km et par personne. Un trajet à vélo n'émet rien à l'usage : tout le trajet en voiture est évité.`,
    how: [
      "Teste le trajet une première fois sans contrainte d'horaire, un week-end par exemple.",
      "Si ton employeur propose le forfait mobilités durables, il peut financer une partie de tes trajets à vélo : demande aux RH.",
      "Garde une tenue de rechange au bureau si le trajet est long.",
    ],
    trap: "Un vélo électrique émet un peu (fabrication de la batterie, recharge), mais reste très loin de la voiture.",
  },
  transports: {
    why: `Par km, le métro et le RER émettent environ ${Math.round(TRANSPORT_KG_PER_KM.voiture_thermique / TRANSIT)} fois moins qu'une voiture thermique (${fr(TRANSIT, 4)} contre ${fr(TRANSPORT_KG_PER_KM.voiture_thermique, 4)} kg).`,
    how: [
      "Combine si besoin : voiture jusqu'à la gare, puis métro ou RER.",
      "Ton employeur prend en charge au moins la moitié de ton abonnement de transport.",
      "Profite du trajet pour lire, écouter un podcast ou souffler.",
    ],
  },
  covoiturage: {
    why: "À deux dans la même voiture, les émissions du trajet sont partagées : chacun divise les siennes par deux.",
    how: [
      "Cherche un collègue qui habite sur ton trajet : le fil de Pousse est un bon endroit pour demander.",
      "Commence par un ou deux jours fixes par semaine.",
      "Les plateformes de covoiturage domicile-travail mettent en relation les salariés d'une même zone.",
    ],
  },
  train: {
    why: `Sur un même trajet, le TGV émet environ ${Math.round(TRANSPORT_KG_PER_KM.avion_court / TRANSPORT_KG_PER_KM.tgv / 10) * 10} fois moins que l'avion (${fr(TRANSPORT_KG_PER_KM.tgv, 4)} contre ${fr(TRANSPORT_KG_PER_KM.avion_court, 4)} kg par km).`,
    how: [
      "Compare le temps porte à porte : sans l'enregistrement et les trajets vers l'aéroport, l'écart se réduit beaucoup.",
      "Réserve tôt pour les meilleurs prix.",
      "Le train de nuit permet de partir loin sans perdre une journée.",
    ],
  },
  vacances_train: {
    why: `Un aller-retour long-courrier (12 000 km) pèse à lui seul environ ${fr((12000 * TRANSPORT_KG_PER_KM.avion_moyen_long) / 1000, 1)} tonnes de CO₂ par passager : c'est le geste le plus lourd du catalogue.`,
    how: [
      "Beaucoup de belles destinations sont accessibles en train depuis la France.",
      "Le train de nuit permet de partir loin sans perdre une journée.",
      "Garde l'avion pour les voyages qui comptent vraiment, et reste plus longtemps sur place.",
    ],
  },
  vege: {
    why: `Un repas avec du bœuf émet environ ${Math.round(MEAL_KG.boeuf / MEAL_KG.vegetarien)} fois plus qu'un repas végétarien (${fr(MEAL_KG.boeuf)} contre ${fr(MEAL_KG.vegetarien)} kg, Agribalyse). L'élevage des ruminants rejette du méthane, un gaz très réchauffant.`,
    how: [
      "Garde tes plats habituels (bolognaise, chili, curry) et remplace la viande par des lentilles ou des pois chiches.",
      "Les légumineuses en conserve sont prêtes en 5 minutes.",
      "Commence par un ou deux repas par semaine, le midi au bureau par exemple.",
    ],
    trap: "Beaucoup de fromage réduit une partie du gain : varie les sources de protéines.",
  },
  moins_boeuf: {
    why: `Le bœuf est la viande la plus émettrice : un repas au porc, au poulet ou au poisson émet environ ${Math.round(MEAL_KG.boeuf / OTHER_MEAT)} fois moins (${fr(OTHER_MEAT)} contre ${fr(MEAL_KG.boeuf)} kg).`,
    how: [
      "Le poulet ou le porc remplacent le bœuf dans la plupart des recettes.",
      "Garde le bœuf pour les occasions.",
      "Quand tu es prêt, essaie aussi un repas végé : c'est encore mieux.",
    ],
  },
  vegetalien: {
    why: `Sans œufs ni produits laitiers, un repas émet encore environ un tiers de moins qu'un repas végétarien (${fr(MEAL_KG.vegetalien)} contre ${fr(MEAL_KG.vegetarien)} kg).`,
    how: [
      "Les plats à base de légumineuses, de céréales et de légumes sont naturellement végétaliens.",
      "Remplace la crème par du lait de coco ou de la crème végétale.",
      "Un repas par semaine suffit pour commencer.",
    ],
  },
  occasion: {
    why: `L'essentiel de l'empreinte d'un vêtement vient de sa fabrication : un jean neuf pèse environ ${fr(CLOTHING_KG.jean, 0)} kg de CO₂, un pull en laine ${fr(CLOTHING_KG.pull_laine, 0)} kg (ADEME). D'occasion, cette fabrication est évitée.`,
    how: [
      "Les applis et les friperies de seconde main ont un très grand choix.",
      "Vends ou donne ce que tu ne portes plus.",
      "Avant d'acheter, demande-toi si tu le porteras souvent.",
    ],
  },
  reparation: {
    why: `La fabrication fait l'essentiel de l'empreinte d'un appareil : garder son smartphone plus longtemps évite environ ${fr(DEVICE_KG.smartphone, 0)} kg de CO₂, un ordinateur portable ${fr(DEVICE_KG.ordinateur_portable, 0)} kg (ADEME).`,
    how: [
      "Écran cassé ou batterie fatiguée : la réparation coûte souvent bien moins cher qu'un appareil neuf.",
      "Le bonus réparation réduit la facture chez les réparateurs labellisés.",
      "Une coque et un verre trempé prolongent la vie du téléphone.",
    ],
  },
  chauffage: {
    why: `Chaque degré en moins réduit la consommation de chauffage d'environ ${Math.round(HEATING_SAVING_PER_DEGREE * 100)} % (ADEME).`,
    how: [
      "19 °C dans les pièces à vivre, un peu moins dans les chambres.",
      "Baisse le chauffage quand tu t'absentes, même une journée.",
      "Un pull en plus compense largement la différence.",
    ],
  },
  teletravail: {
    why: "Un jour de télétravail évite l'aller-retour domicile-travail : deux fois ton trajet. L'ADEME rappelle des effets rebond (chauffage du logement en journée, trajets en plus) qui réduisent le gain, surtout pour les trajets courts. Pousse compte l'aller-retour évité, sans les déduire.",
    how: [
      "Regroupe tes réunions sur les jours où tu es au bureau.",
      "Chauffe seulement la pièce où tu travailles, à 19 °C.",
      "Évite de reprendre la voiture pour d'autres trajets ce jour-là.",
    ],
  },
  eau_robinet: {
    why: `Un litre d'eau en bouteille émet ${fr(DRINK_KG_PER_L.eau_bouteille)} kg de CO₂ (fabrication de la bouteille, transport), l'eau du robinet presque rien (Agribalyse, via l'ADEME). En France, l'eau du robinet est l'un des aliments les plus contrôlés.`,
    how: [
      "Une carafe au réfrigérateur fait disparaître le goût de chlore.",
      "Une gourde dans le sac pour la journée.",
      "Au bureau, demande une fontaine ou des carafes plutôt que des bouteilles.",
    ],
  },
  antigaspi: {
    why: "Près d'un tiers de la nourriture produite dans le monde est perdue ou gaspillée (FAO) : toutes les émissions de sa production, pour rien. Il n'existe pas de chiffre fiable par repas, donc Pousse compte 0 kg, mais des pousses.",
    how: [
      "Emporte tes restes pour le déjeuner du lendemain.",
      "Les applis de paniers d'invendus proposent des repas à petit prix près du bureau.",
      "Prévois tes menus avant les courses pour acheter juste ce qu'il faut.",
    ],
  },
  compost: {
    why: "Les déchets alimentaires pèsent lourd dans nos poubelles. Compostés, ils redeviennent de la terre au lieu d'être incinérés ou enfouis. Depuis 2024, les collectivités doivent proposer une solution de tri des biodéchets.",
    how: [
      "Demande à ta mairie : bac de collecte, composteur de quartier ou composteur individuel.",
      "Épluchures, restes de repas, marc de café : presque tout y va.",
      "Un petit seau fermé dans la cuisine suffit pour commencer.",
    ],
  },
  ramassage: {
    why: "Les déchets abandonnés finissent dans les sols, les rivières puis la mer, et blessent la faune. Les ramasser ne réduit pas ton CO₂, mais protège directement la nature autour de toi.",
    how: [
      "Des gants et un sac suffisent, le temps d'une balade.",
      "C'est encore mieux en équipe : une sortie de ramassage fait une belle photo pour le fil.",
      "Signale les dépôts sauvages à ta mairie.",
    ],
  },
  sciences: {
    why: "Les programmes de sciences participatives du Muséum national d'Histoire naturelle (Vigie-Nature) s'appuient sur des milliers de bénévoles pour suivre l'état des oiseaux, des papillons ou des insectes pollinisateurs.",
    how: [
      "Choisis un protocole sur vigienature.fr : quelques minutes à une heure.",
      "Pas besoin d'être expert : les protocoles sont faits pour les débutants.",
      "Note tes observations au même endroit, régulièrement.",
    ],
  },
  plantation: {
    why: "Haies, arbres et coins de nature offrent abri et nourriture aux oiseaux et aux insectes. Un geste pour la biodiversité plus que pour le CO₂.",
    how: [
      "Préfère des espèces locales, adaptées à ta région.",
      "Un nichoir ou un hôtel à insectes s'installe même sur un balcon.",
      "Laisse un coin du jardin sans tondre.",
    ],
  },
  escaliers: {
    why: "En CO₂, ce geste pèse très peu : un ascenseur consomme peu, et l'électricité française est peu carbonée. Il entretient surtout une habitude d'attention au quotidien.",
    how: ["Commence par les étages du bas.", "Fais-le à plusieurs : c'est plus motivant."],
  },
  gourde: {
    why: "Un gobelet jetable pèse peu en CO₂, mais des centaines par an finissent en déchets. Une gourde ou une tasse s'amortit vite.",
    how: ["Laisse une tasse au bureau.", "Garde une gourde dans ton sac."],
  },
  ecran: {
    why: "Un ordinateur éteint la nuit consomme un peu moins d'électricité : un petit geste, surtout utile pour l'habitude.",
    how: ["Éteins plutôt que de mettre en veille en partant.", "Coupe aussi l'écran et la multiprise."],
  },
};

export interface Recette {
  id: string;
  name: string;
  minutes: number;
  /** Ce qui remplace la viande. */
  protein: string;
  ingredients: string[];
  steps: string[];
}

/** Recettes végé simples et pas chères. La vidéo renvoie vers une recherche YouTube. */
export const RECETTES: Recette[] = [
  {
    id: "dahl",
    name: "Dahl de lentilles corail",
    minutes: 25,
    protein: "Lentilles corail",
    ingredients: ["200 g de lentilles corail", "1 oignon", "1 boîte de lait de coco", "1 boîte de tomates concassées", "Curry, gingembre, ail"],
    steps: ["Fais revenir l'oignon et les épices.", "Ajoute les lentilles rincées, les tomates, le lait de coco et un verre d'eau.", "Laisse mijoter 20 minutes, sers avec du riz."],
  },
  {
    id: "chili",
    name: "Chili sin carne",
    minutes: 35,
    protein: "Haricots rouges",
    ingredients: ["2 boîtes de haricots rouges", "1 boîte de maïs", "1 oignon, 1 poivron", "1 boîte de tomates concassées", "Cumin, paprika"],
    steps: ["Fais revenir l'oignon et le poivron avec les épices.", "Ajoute les tomates, les haricots et le maïs égouttés.", "Laisse mijoter 25 minutes."],
  },
  {
    id: "curry",
    name: "Curry de pois chiches",
    minutes: 30,
    protein: "Pois chiches",
    ingredients: ["2 boîtes de pois chiches", "1 boîte de lait de coco", "2 poignées d'épinards", "1 oignon", "Pâte de curry"],
    steps: ["Fais revenir l'oignon avec la pâte de curry.", "Ajoute les pois chiches et le lait de coco, laisse mijoter 15 minutes.", "Ajoute les épinards à la fin."],
  },
  {
    id: "bolo",
    name: "Bolognaise de lentilles",
    minutes: 35,
    protein: "Lentilles vertes",
    ingredients: ["200 g de lentilles vertes", "1 oignon, 1 carotte", "1 boîte de tomates concassées", "Pâtes", "Herbes de Provence"],
    steps: ["Cuis les lentilles 20 minutes.", "Fais revenir l'oignon et la carotte râpée, ajoute les tomates et les lentilles.", "Laisse mijoter 10 minutes, sers sur les pâtes."],
  },
  {
    id: "shakshuka",
    name: "Shakshuka",
    minutes: 25,
    protein: "Œufs",
    ingredients: ["4 œufs", "1 boîte de tomates concassées", "1 poivron, 1 oignon", "Cumin, paprika", "Pain"],
    steps: ["Fais revenir l'oignon et le poivron avec les épices.", "Ajoute les tomates, laisse réduire 10 minutes.", "Casse les œufs dans la sauce, couvre et cuis 6 à 8 minutes."],
  },
  {
    id: "tacos",
    name: "Tacos aux haricots noirs",
    minutes: 20,
    protein: "Haricots noirs",
    ingredients: ["1 boîte de haricots noirs", "Tortillas", "1 avocat", "Tomates, oignon rouge", "Citron vert, cumin"],
    steps: ["Écrase grossièrement les haricots chauds avec le cumin.", "Prépare une salsa tomate, oignon, citron.", "Garnis les tortillas avec haricots, avocat et salsa."],
  },
];

export const videoSearch = (name: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`recette ${name}`)}`;

/** Numéro de semaine simple, pour faire tourner les contenus chaque lundi. */
export function weekNumber(isoDate: string): number {
  return Math.floor(new Date(`${isoDate}T12:00:00Z`).getTime() / (7 * 86_400_000));
}

export function recettesOfWeek(isoDate: string, n = 3): Recette[] {
  const start = weekNumber(isoDate) % RECETTES.length;
  return Array.from({ length: n }, (_, i) => RECETTES[(start + i) % RECETTES.length]);
}

export interface Duo {
  a: { label: string; kg: number };
  b: { label: string; kg: number };
}

/** « Lequel pèse le plus ? » : des duels d'ordres de grandeur, tous calculés depuis les facteurs ADEME. */
export const DUOS: Duo[] = [
  { a: { label: "Un jean neuf", kg: CLOTHING_KG.jean }, b: { label: "100 km seul en voiture", kg: 100 * TRANSPORT_KG_PER_KM.voiture_thermique } },
  { a: { label: "Un repas au bœuf", kg: MEAL_KG.boeuf }, b: { label: "5 repas végétariens", kg: 5 * MEAL_KG.vegetarien } },
  { a: { label: "Un smartphone neuf", kg: DEVICE_KG.smartphone }, b: { label: "500 km seul en voiture", kg: 500 * TRANSPORT_KG_PER_KM.voiture_thermique } },
  { a: { label: "Un manteau neuf", kg: CLOTHING_KG.manteau }, b: { label: "20 repas au bœuf", kg: 20 * MEAL_KG.boeuf } },
  { a: { label: "800 km en TGV", kg: 800 * TRANSPORT_KG_PER_KM.tgv }, b: { label: "10 km seul en voiture", kg: 10 * TRANSPORT_KG_PER_KM.voiture_thermique } },
  { a: { label: "Un t-shirt neuf", kg: CLOTHING_KG.tshirt }, b: { label: "Un repas au bœuf", kg: MEAL_KG.boeuf } },
  { a: { label: "Un pull en laine neuf", kg: CLOTHING_KG.pull_laine }, b: { label: "40 repas au poulet", kg: 40 * MEAL_KG.poulet } },
  { a: { label: "Un ordinateur portable neuf", kg: DEVICE_KG.ordinateur_portable }, b: { label: "Un vol de 700 km", kg: 700 * TRANSPORT_KG_PER_KM.avion_court } },
];
