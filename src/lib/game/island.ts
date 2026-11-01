/**
 * L'île : chaque action comptée par le jardin donne une graine de son espèce. Une graine se plante sur un
 * emplacement libre (nouvelle plante) ou sur une plante de la même espèce (elle grandit). Les plantes
 * rares obtenues se posent une fois, adultes. Le calcul officiel est dans island_plant() (0047_ile.sql) ;
 * ce module sert l'affichage et doit suivre les mêmes règles.
 */
import { RARES, RARE_BY_KEY, SPECIES, stageFor, type GardenData, type Rare, type Shape, type Species } from "./garden.ts";

export interface IslandPlant {
  id: string;
  species: string;
  rare: boolean;
  x: number;
  z: number;
  fed: number;
  planted_at: string;
  grown_at: string;
}

export interface IslandData extends GardenData {
  plants: IslandPlant[];
}

/** L'île est un disque d'emplacements : x² + z² ≤ 10 (37 emplacements). */
export const ISLAND_RADIUS2 = 10;

export function tileOk(x: number, z: number): boolean {
  return Number.isInteger(x) && Number.isInteger(z) && x * x + z * z <= ISLAND_RADIUS2;
}

export const ISLAND_TILES: ReadonlyArray<{ x: number; z: number }> = (() => {
  const tiles: { x: number; z: number }[] = [];
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) if (tileOk(x, z)) tiles.push({ x, z });
  return tiles;
})();

/** Ce qu'il faut pour dessiner une plante : forme, couleurs, stade (0 à 4). */
export interface PlantLook {
  key: string;
  name: string;
  shape: Shape;
  color: string;
  accent: string;
  stage: number;
  /** Graines nécessaires pour le stade suivant (null : adulte). */
  next: number | null;
  rare: boolean;
}

const SPECIES_BY_KEY: Record<string, Species> = Object.fromEntries(SPECIES.map((s) => [s.key, s]));

export function lookOf(p: Pick<IslandPlant, "species" | "rare" | "fed">): PlantLook | null {
  if (p.rare) {
    const r: Rare | undefined = RARE_BY_KEY[p.species];
    if (!r) return null;
    return { key: r.key, name: r.name, shape: r.shape, color: r.color, accent: r.accent, stage: 4, next: null, rare: true };
  }
  const s = SPECIES_BY_KEY[p.species];
  if (!s) return null;
  const { stage, next } = stageFor(p.fed);
  return { key: s.key, name: s.name, shape: s.shape, color: s.color, accent: s.accent, stage, next, rare: false };
}

export interface Seed {
  key: string;
  name: string;
  /** Ce qui la fait gagner, pour la légende. */
  how: string;
  shape: Shape;
  color: string;
  accent: string;
  rare: boolean;
  available: number;
}

/** Les graines à planter : par espèce, celles gagnées moins celles déjà plantées ; puis les rares à poser. */
export function seedsOf(data: IslandData): Seed[] {
  const spent: Record<string, number> = {};
  for (const p of data.plants) if (!p.rare) spent[p.species] = (spent[p.species] ?? 0) + p.fed;
  const placedRares = new Set(data.plants.filter((p) => p.rare).map((p) => p.species));

  const common = SPECIES.map((s) => ({
    key: s.key,
    name: s.name,
    how: s.grownBy,
    shape: s.shape,
    color: s.color,
    accent: s.accent,
    rare: false,
    available: Math.max(0, Number(data.counts[s.key] ?? 0) - (spent[s.key] ?? 0)),
  }));
  const rares = RARES.filter((r) => (r.exploit ? Boolean(data.exploits[r.exploit]) : data.rares.includes(r.key)))
    .filter((r) => !placedRares.has(r.key))
    .map((r) => ({ key: r.key, name: r.name, how: r.how, shape: r.shape, color: r.color, accent: r.accent, rare: true, available: 1 }));
  return [...common.filter((s) => s.available > 0), ...rares];
}

export type PlantCheck = "nouvelle" | "grandit" | "occupe" | "hors_ile";

/** Ce que donnerait une graine posée en (x, z). */
export function checkTile(plants: IslandPlant[], seed: Pick<Seed, "key" | "rare">, x: number, z: number): PlantCheck {
  if (!tileOk(x, z)) return "hors_ile";
  const here = plants.find((p) => p.x === x && p.z === z);
  if (!here) return "nouvelle";
  return !seed.rare && !here.rare && here.species === seed.key ? "grandit" : "occupe";
}

/** Applique une plantation en local (affichage immédiat, avant la réponse du serveur). */
export function plantLocally(data: IslandData, seed: Pick<Seed, "key" | "rare">, x: number, z: number): IslandData {
  const check = checkTile(data.plants, seed, x, z);
  if (check === "grandit") {
    return { ...data, plants: data.plants.map((p) => (p.x === x && p.z === z ? { ...p, fed: p.fed + 1, grown_at: new Date().toISOString() } : p)) };
  }
  if (check !== "nouvelle") return data;
  const now = new Date().toISOString();
  return {
    ...data,
    plants: [...data.plants, { id: `local-${x}-${z}`, species: seed.key, rare: seed.rare, x, z, fed: 1, planted_at: now, grown_at: now }],
  };
}

export const ISLAND_ERRORS: Record<string, string> = {
  no_seed: "Plus de graine de cette espèce : enregistre une action pour en gagner.",
  tile_taken: "Cet emplacement est pris. Choisis une case libre, ou une plante de la même espèce.",
  off_island: "Cet emplacement est hors de l'île.",
  already_planted: "Cette plante rare est déjà sur ton île.",
};

/**
 * « Planter pour moi » : faire grandir la plus petite plante de la même espèce qui n'est pas encore
 * adulte, sinon le premier emplacement libre en partant du centre.
 */
export function bestTile(plants: IslandPlant[], seed: Pick<Seed, "key" | "rare">): { x: number; z: number } | null {
  if (!seed.rare) {
    const growing = plants
      .filter((p) => !p.rare && p.species === seed.key && p.fed < 40)
      .sort((a, b) => a.fed - b.fed)[0];
    if (growing) return { x: growing.x, z: growing.z };
  }
  const free = ISLAND_TILES.filter((t) => checkTile(plants, seed, t.x, t.z) === "nouvelle").sort(
    (a, b) => a.x * a.x + a.z * a.z - (b.x * b.x + b.z * b.z) || a.x - b.x || a.z - b.z,
  )[0];
  return free ? { x: free.x, z: free.z } : null;
}
