/**
 * Le jardin à collectionner : chaque type d'action fait pousser une espèce, en 4 stades,
 * et des plantes rares récompensent les exploits ou sortent des graines mystère.
 * Les compteurs viennent de la fonction SQL garden() (0011_jeu.sql).
 */

export type Shape = "arbre" | "fleur" | "touffe" | "cactus" | "potager";

export interface Species {
  key: string;
  name: string;
  /** Ce qui la fait pousser. */
  grownBy: string;
  shape: Shape;
  /** Feuillage (ou pétales) et accent. */
  color: string;
  accent: string;
}

export const SPECIES: Species[] = [
  { key: "transport", name: "Bouleau", grownBy: "trajets bas carbone", shape: "arbre", color: "#9fbf6b", accent: "#efe9dc" },
  { key: "alimentation", name: "Potager", grownBy: "repas sans viande ou sans bœuf", shape: "potager", color: "#6f9a3e", accent: "#e8833a" },
  { key: "consommation", name: "Fougère", grownBy: "achats évités (occasion, réparation)", shape: "touffe", color: "#5f8f4e", accent: "#5f8f4e" },
  { key: "logement", name: "Olivier", grownBy: "semaines de chauffage baissé", shape: "arbre", color: "#a3ad7a", accent: "#8a7a5c" },
  { key: "scan", name: "Tournesol", grownBy: "meilleurs choix au scanner", shape: "fleur", color: "#f2c230", accent: "#6b4a1e" },
  { key: "cap", name: "Cactus", grownBy: "habitudes gardées", shape: "cactus", color: "#7fa36a", accent: "#e98aa0" },
  { key: "bravo", name: "Coquelicot", grownBy: "bravos à tes collègues", shape: "fleur", color: "#d9432f", accent: "#2b2420" },
  { key: "quiz", name: "Lavande", grownBy: "quiz réussis (7/10 ou plus)", shape: "touffe", color: "#8f7ac0", accent: "#8f7ac0" },
];

/** Seuils des 4 stades : 1 action pour germer, puis 5, 15 et 40. */
export const STAGES = [1, 5, 15, 40] as const;
export const STAGE_NAMES = ["À planter", "Pousse", "Jeune plant", "Adulte", "En pleine forme"] as const;

export function stageFor(count: number): { stage: number; next: number | null } {
  let stage = 0;
  for (const s of STAGES) if (count >= s) stage++;
  return { stage, next: STAGES[stage] ?? null };
}

export interface Rare {
  key: string;
  name: string;
  /** Comment l'obtenir. */
  how: string;
  shape: Shape;
  color: string;
  accent: string;
  /** Exploit qui la débloque ; absent pour les plantes des graines mystère. */
  exploit?: ExploitKey;
}

export type ExploitKey = "serie30" | "expert" | "collectif" | "duel" | "inspire";

export const RARES: Rare[] = [
  { key: "chene", name: "Chêne", how: "30 jours actifs d'affilée", shape: "arbre", color: "#4f7a35", accent: "#6b4a2b", exploit: "serie30" },
  { key: "sequoia", name: "Séquoia", how: "Un défi expert réussi", shape: "arbre", color: "#3d6b4a", accent: "#9a4a2e", exploit: "expert" },
  { key: "baobab", name: "Baobab", how: "Un défi collectif atteint avec l'entreprise", shape: "arbre", color: "#8aa24f", accent: "#a88a6a", exploit: "collectif" },
  { key: "rosier", name: "Rosier", how: "Un duel réussi", shape: "fleur", color: "#d6527a", accent: "#4f7a35", exploit: "duel" },
  { key: "saule", name: "Saule", how: "Un collègue a relevé ton défi", shape: "arbre", color: "#a6c27a", accent: "#7a6a4a", exploit: "inspire" },
  { key: "orchidee", name: "Orchidée", how: "Graine mystère", shape: "fleur", color: "#c77dd6", accent: "#f2e06b" },
  { key: "bonsai", name: "Bonsaï", how: "Graine mystère", shape: "arbre", color: "#5d8a3c", accent: "#5a3e2b" },
  { key: "edelweiss", name: "Edelweiss", how: "Graine mystère", shape: "fleur", color: "#f4f1e8", accent: "#e3c34a" },
  { key: "lotus", name: "Lotus", how: "Graine mystère", shape: "fleur", color: "#f0a3b8", accent: "#f2d06b" },
  { key: "nenuphar", name: "Nénuphar", how: "Graine mystère", shape: "fleur", color: "#f7f3ea", accent: "#5f9e6e" },
];

export const RARE_BY_KEY: Record<string, Rare> = Object.fromEntries(RARES.map((r) => [r.key, r]));

export interface GardenData {
  name: string;
  counts: Record<string, number>;
  exploits: Partial<Record<ExploitKey, boolean>>;
  rares: string[];
}

/** Le jardin prêt à afficher : espèces avec leur stade, plantes rares obtenues ou à trouver. */
export function buildGarden(g: GardenData) {
  const plants = SPECIES.map((s) => {
    const count = Number(g.counts[s.key] ?? 0);
    return { ...s, count, ...stageFor(count) };
  });
  const rares = RARES.map((r) => ({
    ...r,
    owned: r.exploit ? Boolean(g.exploits[r.exploit]) : g.rares.includes(r.key),
  }));
  const grown = plants.filter((p) => p.stage > 0).length + rares.filter((r) => r.owned).length;
  return { plants, rares, grown, total: plants.length + rares.length };
}
