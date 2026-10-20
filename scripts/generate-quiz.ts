/**
 * Génère la banque de questions du quiz quotidien (supabase/migrations/0015_quiz_banque.sql).
 *
 *   node scripts/generate-quiz.ts > supabase/migrations/0015_quiz_banque.sql
 *
 * Toutes les questions sont calculées à partir des facteurs ADEME de src/lib/co2/factors.ts :
 * aucun chiffre n'est saisi à la main, et la correction affiche le calcul. Les mauvaises
 * réponses sont volontairement proches de la bonne (même ordre de grandeur) pour que le quiz
 * reste un vrai défi. Le générateur est déterministe : relancé, il produit le même fichier.
 */
import {
  CLOTHING_KG,
  DEVICE_KG,
  HEATING_KG_PER_M2_YEAR,
  MEAL_KG,
  TRANSPORT_KG_PER_KM,
} from "../src/lib/co2/factors.ts";

// --- Hasard reproductible -------------------------------------------------------------------
let seed = 20261020;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const shuffle = <T>(xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// --- Mise en forme ---------------------------------------------------------------------------
const fr = (n: number, digits = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: digits });
/** Arrondi à 2 chiffres significatifs (3 au-delà de 1 000), lisible. */
const nice = (n: number) => {
  if (n >= 1000) return Math.round(n / 10) * 10;
  if (n >= 100) return Math.round(n / 5) * 5;
  if (n >= 10) return Math.round(n);
  if (n >= 1) return Math.round(n * 10) / 10;
  return Math.round(n * 100) / 100;
};
const kg = (n: number) => (n >= 1000 ? `${fr(n / 1000, 2)} t` : n >= 10 ? `${fr(n, 0)} kg` : n >= 1 ? `${fr(n, 1)} kg` : `${fr(n * 1000, 0)} g`);
const SRC = "Source : ADEME (Impact CO₂, Agribalyse).";

// --- Ce qu'on compare ------------------------------------------------------------------------
interface Thing {
  label: string;
  kg: number;
  /** Famille, pour varier les comparaisons. */
  family: "repas" | "vetement" | "appareil" | "trajet" | "chauffage";
}

const MEALS: [string, number][] = [
  ["un repas avec du bœuf", MEAL_KG.boeuf],
  ["un repas avec du veau", MEAL_KG.veau],
  ["un repas avec du porc", MEAL_KG.porc],
  ["un repas avec du poulet", MEAL_KG.poulet],
  ["un repas végétarien", MEAL_KG.vegetarien],
  ["un repas végétalien", MEAL_KG.vegetalien],
];
const MEALS_PLURAL: Record<string, string> = {
  "un repas avec du bœuf": "repas avec du bœuf",
  "un repas avec du veau": "repas avec du veau",
  "un repas avec du porc": "repas avec du porc",
  "un repas avec du poulet": "repas avec du poulet",
  "un repas végétarien": "repas végétariens",
  "un repas végétalien": "repas végétaliens",
};
const CLOTHES: [string, number][] = [
  ["un t-shirt neuf", CLOTHING_KG.tshirt],
  ["une chemise neuve", CLOTHING_KG.chemise],
  ["une paire de chaussures en cuir neuves", CLOTHING_KG.chaussures_cuir],
  ["un jean neuf", CLOTHING_KG.jean],
  ["un pull en laine neuf", CLOTHING_KG.pull_laine],
  ["un manteau neuf", CLOTHING_KG.manteau],
];
const DEVICES: [string, number][] = [
  ["un smartphone neuf", DEVICE_KG.smartphone],
  ["un ordinateur portable neuf", DEVICE_KG.ordinateur_portable],
  ["une télévision neuve", DEVICE_KG.television],
];
const MODES: [string, string, number][] = [
  ["seul en voiture thermique", "la voiture thermique (seul)", TRANSPORT_KG_PER_KM.voiture_thermique],
  ["seul en voiture électrique", "la voiture électrique (seul)", TRANSPORT_KG_PER_KM.voiture_electrique],
  ["en covoiturage à deux", "le covoiturage à deux", TRANSPORT_KG_PER_KM.covoiturage_2],
  ["en bus thermique", "le bus thermique", TRANSPORT_KG_PER_KM.bus_thermique],
  ["en métro", "le métro", TRANSPORT_KG_PER_KM.metro],
  ["en RER", "le RER", TRANSPORT_KG_PER_KM.rer],
  ["en tramway", "le tramway", TRANSPORT_KG_PER_KM.tram],
  ["en vélo électrique", "le vélo électrique", TRANSPORT_KG_PER_KM.velo_electrique],
  ["en TGV", "le TGV", TRANSPORT_KG_PER_KM.tgv],
  ["en avion (court-courrier)", "l'avion court-courrier", TRANSPORT_KG_PER_KM.avion_court],
  ["en avion (moyen ou long-courrier)", "l'avion moyen ou long-courrier", TRANSPORT_KG_PER_KM.avion_moyen_long],
];
const DISTANCES = [5, 10, 20, 50, 100, 200, 300, 500, 800, 1000, 2000];
/** Distances réalistes pour chaque mode (pas de métro sur 800 km, pas d'avion sur 10 km). */
const fits = (mode: string, d: number) => {
  if (/métro|RER|tramway/.test(mode)) return d <= 50;
  if (/vélo/.test(mode)) return d <= 20;
  if (/bus/.test(mode)) return d <= 100;
  if (/avion/.test(mode)) return d >= 300;
  if (/TGV/.test(mode)) return d >= 100;
  return d <= 1000;
};
const HEATING: [string, number][] = [
  ["au gaz", HEATING_KG_PER_M2_YEAR.gaz],
  ["au fioul", HEATING_KG_PER_M2_YEAR.fioul],
  ["à l'électricité", HEATING_KG_PER_M2_YEAR.electrique],
  ["par pompe à chaleur", HEATING_KG_PER_M2_YEAR.pompe_a_chaleur],
  ["par un réseau de chaleur", HEATING_KG_PER_M2_YEAR.reseau_de_chaleur],
  ["par un poêle à granulés", HEATING_KG_PER_M2_YEAR.poele_granules],
  ["par un poêle à bûches", HEATING_KG_PER_M2_YEAR.poele_buches],
];
const SURFACES = [30, 50, 70, 90, 120];

const things: Thing[] = [
  ...MEALS.flatMap(([l, v]) => [
    { label: l, kg: v, family: "repas" as const },
    ...[5, 10, 20, 50].map((n) => ({ label: `${n} ${MEALS_PLURAL[l]}`, kg: n * v, family: "repas" as const })),
  ]),
  ...CLOTHES.map(([l, v]) => ({ label: l, kg: v, family: "vetement" as const })),
  ...DEVICES.map(([l, v]) => ({ label: l, kg: v, family: "appareil" as const })),
  ...MODES.flatMap(([l, , v]) =>
    DISTANCES.filter((d) => v * d >= 0.5 && fits(l, d)).map((d) => ({ label: `${fr(d, 0)} km ${l}`, kg: v * d, family: "trajet" as const })),
  ),
  ...HEATING.flatMap(([l, v]) => SURFACES.map((s) => ({ label: `un an de chauffage ${l} pour ${s} m²`, kg: v * s, family: "chauffage" as const }))),
];

// --- Les questions ---------------------------------------------------------------------------
interface Q {
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
}
const out: Q[] = [];
const seen = new Set<string>();
/** Unicité sur l'énoncé et l'ensemble des choix (l'énoncé « Lequel… » revient souvent). */
const addUnique = (q: Q) => {
  if (new Set(q.choices).size !== q.choices.length) return;
  const key = q.question + "|" + [...q.choices].sort().join("|");
  if (seen.has(key)) return;
  seen.add(key);
  out.push(q);
};

/** 4 choix numériques proches : la bonne valeur et 3 voisines, triés par ordre croissant. */
function numericChoices(value: number, format: (n: number) => string) {
  const patterns = [
    [0.5, 0.7, 1.5],
    [0.6, 1.4, 2],
    [0.45, 1.6, 2.4],
    [0.4, 0.65, 1.45],
    [0.7, 1.35, 1.8],
  ];
  const factors = [1, ...pick(patterns)];
  const values = factors.map((f) => nice(value * f));
  const labels = values.map(format);
  const order = values.map((v, i) => ({ v, l: labels[i], right: i === 0 })).sort((a, b) => a.v - b.v);
  return { choices: order.map((o) => o.l), answer: order.findIndex((o) => o.right) };
}

// 1. « Lequel émet le plus ? » / « le moins ? » : 4 choses d'un même ordre de grandeur.
for (let tries = 0; tries < 200000 && out.length < 450; tries++) {
  const four = shuffle(things).slice(0, 4);
  if (new Set(four.map((t) => t.family)).size < 3) continue;
  const sorted = [...four].sort((a, b) => b.kg - a.kg);
  const most = rand() < 0.65;
  const [a, b] = most ? [sorted[0], sorted[1]] : [sorted[3], sorted[2]];
  const ratio = most ? a.kg / b.kg : b.kg / a.kg;
  // Assez proche pour hésiter, assez loin pour être juste malgré les arrondis.
  if (ratio < 1.12 || ratio > 1.9) continue;
  if (sorted[0].kg / sorted[3].kg > 6) continue;
  const choices = four.map((t) => t.label[0].toUpperCase() + t.label.slice(1));
  addUnique({
    question: most
      ? "Lequel de ces quatre émet le PLUS de CO₂ ?"
      : "Lequel de ces quatre émet le MOINS de CO₂ ?",
    choices,
    answer: four.indexOf(a),
    explanation: `${sorted.map((t) => `${t.label[0].toUpperCase() + t.label.slice(1)} : ${kg(t.kg)}`).join(" ; ")}. ${SRC}`,
  });
}

// 2. « Combien de km seul en voiture thermique émettent autant que… ? »
const CAR = TRANSPORT_KG_PER_KM.voiture_thermique;
for (const t of things) {
  if (t.family === "trajet" && t.label.includes("voiture thermique")) continue;
  const km = t.kg / CAR;
  if (km < 3 || km > 6000) continue;
  const c = numericChoices(km, (n) => `${fr(n, 1)} km`);
  addUnique({
    question: `Combien de km seul en voiture thermique émettent autant de CO₂ que ${t.label} ?`,
    ...c,
    explanation: `${t.label[0].toUpperCase() + t.label.slice(1)} : ${kg(t.kg)}. Une voiture thermique émet ${fr(CAR * 1000, 0)} g par km, soit environ ${fr(nice(km), 1)} km. ${SRC}`,
  });
}

// 3. « Combien de repas végétariens… ? »
const VEG = MEAL_KG.vegetarien;
for (const t of things) {
  if (t.family === "repas") continue;
  const n = t.kg / VEG;
  if (n < 3 || n > 3000) continue;
  const c = numericChoices(n, (x) => `${fr(x, 0)} repas`);
  addUnique({
    question: `${t.label[0].toUpperCase() + t.label.slice(1)} émet autant de CO₂ que combien de repas végétariens ?`,
    ...c,
    explanation: `${t.label[0].toUpperCase() + t.label.slice(1)} : ${kg(t.kg)}. Un repas végétarien : ${fr(VEG, 2)} kg, soit environ ${fr(nice(n), 0)} repas. ${SRC}`,
  });
}

// 4. « Par km, A émet combien de fois plus que B ? »
for (const [la, , va] of MODES) {
  for (const [, lb, vb] of MODES) {
    if (va <= vb * 1.5) continue;
    const r = va / vb;
    const c = numericChoices(r, (x) => `${fr(x, 1)} fois plus`);
    addUnique({
      question: `Par km et par personne, voyager ${la} émet combien de fois plus que ${lb} ?`,
      ...c,
      explanation: `${fr(va * 1000, 1)} g par km ${la}, contre ${fr(vb * 1000, 1)} g pour ${lb} : environ ${fr(nice(r), 1)} fois plus. ${SRC}`,
    });
  }
}

// 5. Chauffage : « combien par an ? »
for (const [l, v] of HEATING) {
  for (const s of SURFACES) {
    const total = v * s;
    const c = numericChoices(total, (x) => kg(x));
    addUnique({
      question: `Un logement de ${s} m² chauffé ${l} émet environ combien de CO₂ par an pour le chauffage ?`,
      ...c,
      explanation: `${fr(v, 2)} kg par m² et par an ${l}, soit ${kg(total)} pour ${s} m². ${SRC}`,
    });
  }
}

// 6. « Combien économise-t-on ? » : un trajet fait avec un mode plutôt qu'un autre.
for (const [la, , va] of MODES) {
  for (const [lb, , vb] of MODES) {
    if (va <= vb * 2) continue;
    for (const d of [10, 20, 50, 100, 300, 800]) {
      if (!fits(la, d) || !fits(lb, d)) continue;
      const saved = (va - vb) * d;
      if (saved < 0.3) continue;
      const c = numericChoices(saved, (x) => kg(x));
      addUnique({
        question: `Sur ${d} km, combien de CO₂ évite-t-on en voyageant ${lb} plutôt que ${la} ?`,
        ...c,
        explanation: `${la[0].toUpperCase() + la.slice(1)} : ${kg(va * d)} ; ${lb} : ${kg(vb * d)}. Écart : ${kg(saved)}. ${SRC}`,
      });
    }
  }
}

// Tri final reproductible, puis numérotation à partir de 1001.
const final = out.map((q, i) => ({ ...q, id: 1001 + i }));
const esc = (s: string) => s.replace(/'/g, "''");
const lines = final.map(
  (q) =>
    `(${q.id}, '${esc(q.question)}', array[${q.choices.map((c) => `'${esc(c)}'`).join(", ")}], ${q.answer}, '${esc(q.explanation)}')`,
);
console.log(`-- Pousse · banque de questions du quiz quotidien : ${final.length} questions.
-- Fichier généré par scripts/generate-quiz.ts à partir des facteurs ADEME de src/lib/co2/factors.ts.
-- Ne pas modifier à la main : relancer le script.

insert into public.quiz_questions (id, question, choices, answer, explanation) values
${lines.join(",\n")}
on conflict (id) do update set
  question = excluded.question, choices = excluded.choices, answer = excluded.answer, explanation = excluded.explanation;`);
