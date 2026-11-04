/**
 * L'île : le défi décide quoi, les pousses décident combien (0051_ile_serre.sql).
 *
 * On plante une espèce débloquée (au départ : bouleau, potager, fougère, olivier ; les autres par
 * les défis, les actions de leur famille, ou un cadeau) sur une case libre de sa zone, pour 10 pousses
 * (le premier exemplaire gagné ou reçu est offert). Puis chaque stade coûte des pousses : 30, 60 et 100.
 * Arracher rend les pousses dépensées. Les plantes rares d'exploits se posent une fois, adultes.
 * Le calcul officiel est dans island_plant() et island_grow() ; ce module sert l'affichage et suit les
 * mêmes règles.
 */
import { RARES, RARE_BY_KEY, SPECIES, stageFor, type GardenData, type Rare, type Shape, type Species } from "./garden.ts";
import { ITEM_BY_KEY, TIER_LABEL, type Tier } from "./catalog.ts";

export interface IslandPlant {
  id: string;
  species: string;
  rare: boolean;
  x: number;
  z: number;
  fed: number;
  /** Stade, de 1 (planté) à 4 (adulte). Absent : calculé depuis les graines (avant la 0051). */
  stage?: number;
  /** Pousses dépensées pour elle (rendues si on l'arrache). */
  spent?: number;
  /** Exemplaire offert (gagné en défi, reçu en cadeau, ou plante de départ). */
  free?: boolean;
  planted_at: string;
  grown_at: string;
}

/** Une récompense reçue (défi, équipe, cadeau), pour la fêter à l'ouverture de l'île. */
export interface Reward {
  id: string;
  item: string;
  source: "defi" | "equipe" | "cadeau";
  at: string;
  /** Qui l'a offerte (cadeau). */
  from: string | null;
}

export interface IslandData extends GardenData {
  plants: IslandPlant[];
  /** Plantes du catalogue possédées (récompenses, cadeaux, migrateurs). */
  inventory?: Record<string, number>;
  /** Espèces que je peux planter. */
  unlocked?: string[];
  /** Exemplaires offerts encore à planter, par espèce. */
  free?: Record<string, number>;
  /** Pousses à dépenser (seulement pour moi). */
  pousses?: number | null;
  /** Récompenses des 30 derniers jours (seulement pour moi). */
  recent?: Reward[] | null;
}

/** Planter coûte 10 pousses ; puis passer du stade 1 au 2 : 30, du 2 au 3 : 60, du 3 au 4 : 100. */
export const PLANT_COST = 10;
export const GROW_COST: Readonly<Record<number, number>> = { 1: 30, 2: 60, 3: 100 };
export const ISLAND_STAGE_NAMES = ["", "Planté", "Pousse", "Jeune plant", "Adulte"] as const;

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

/**
 * Les zones de l'île, une par famille d'actions. Une case appartient à la zone vers laquelle elle pointe
 * depuis le centre, vue de trois quarts (même calcul que island_tile_zone(), 0049_ile_zones.sql).
 * La case centrale accueille toutes les espèces.
 */
export type Zone = "foret" | "potager" | "plage" | "ruisseau";
/** `target` : stades à cumuler dans la zone pour la restaurer (quatre plantes adultes). */
export const ZONES: ReadonlyArray<{ key: Zone; name: string; grownBy: string; species: string; target: number }> = [
  { key: "foret", name: "Forêt", grownBy: "tes trajets", species: "transport", target: 16 },
  { key: "potager", name: "Potager", grownBy: "tes repas", species: "alimentation", target: 16 },
  { key: "plage", name: "Plage", grownBy: "tes achats évités", species: "consommation", target: 16 },
  { key: "ruisseau", name: "Ruisseau", grownBy: "ta maison", species: "logement", target: 16 },
];
export const ZONE_BY_KEY = Object.fromEntries(ZONES.map((z) => [z.key, z])) as Record<Zone, (typeof ZONES)[number]>;

/** Angle (degrés) d'une case vue de trois quarts : 0° à droite, −90° au fond, 90° devant. */
export function tileAngle(x: number, z: number): number {
  return (Math.atan2(((x + z) * 19) / 0.56, (x - z) * 34) * 180) / Math.PI;
}

/** Frontières des zones (degrés) : 9 cases chacune, toutes à plus de 8° d'une frontière. */
export const ZONE_BOUNDS = [-145, -54, 35, 125] as const;

export function zoneOfTile(x: number, z: number): Zone | null {
  if (x === 0 && z === 0) return null;
  const a = tileAngle(x, z);
  if (a >= ZONE_BOUNDS[0] && a < ZONE_BOUNDS[1]) return "foret";
  if (a >= ZONE_BOUNDS[1] && a < ZONE_BOUNDS[2]) return "ruisseau";
  if (a >= ZONE_BOUNDS[2] && a < ZONE_BOUNDS[3]) return "plage";
  return "potager";
}

/**
 * La zone d'une espèce (trajets → forêt…) ou d'une plante du catalogue (noisetier → forêt…) ;
 * null : elle pousse partout (fleurs, plantes rares, myosotis).
 */
export function zoneOfSpecies(species: string): Zone | null {
  if (species === "transport" || species === "nature") return "foret";
  if (species === "alimentation") return "potager";
  if (species === "consommation") return "plage";
  if (species === "logement") return "ruisseau";
  return ITEM_BY_KEY[species]?.zone ?? null;
}

/** La case peut-elle accueillir cette espèce ? La case centrale accueille tout. */
export function tileFits(species: string, x: number, z: number): boolean {
  const want = zoneOfSpecies(species);
  const zone = zoneOfTile(x, z);
  return want === null || zone === null || zone === want;
}

/** Ce qu'il faut pour dessiner une plante : forme, couleurs, stade (1 à 4). */
export interface PlantLook {
  key: string;
  name: string;
  shape: Shape;
  color: string;
  accent: string;
  stage: number;
  /** Pousses pour le stade suivant (null : adulte). */
  next: number | null;
  rare: boolean;
  /** Fleurs ou fruits semés sur le feuillage, taille du feuillage (plantes du catalogue). */
  dots?: string;
  big?: number;
}

const SPECIES_BY_KEY: Record<string, Species> = Object.fromEntries(SPECIES.map((s) => [s.key, s]));

/** Le stade d'une plante : enregistré, sinon calculé depuis ses graines (plantes d'avant la 0051). */
export function stageOf(p: Pick<IslandPlant, "rare" | "fed" | "stage">): number {
  if (p.stage) return p.stage;
  return p.rare ? 4 : Math.max(1, stageFor(p.fed).stage);
}

export function lookOf(p: Pick<IslandPlant, "species" | "rare" | "fed" | "stage">): PlantLook | null {
  const stage = stageOf(p);
  const next = GROW_COST[stage] ?? null;
  const item = ITEM_BY_KEY[p.species];
  if (item && item.kind !== "visiteur") {
    return { key: item.key, name: item.name, shape: item.shape, color: item.color, accent: item.accent, stage, next, rare: true, dots: item.dots, big: item.big };
  }
  const r: Rare | undefined = RARE_BY_KEY[p.species];
  if (r) return { key: r.key, name: r.name, shape: r.shape, color: r.color, accent: r.accent, stage: 4, next: null, rare: true };
  const s = SPECIES_BY_KEY[p.species];
  if (!s) return null;
  return { key: s.key, name: s.name, shape: s.shape, color: s.color, accent: s.accent, stage, next, rare: false };
}

export interface Seed {
  key: string;
  name: string;
  /** D'où vient l'espèce, pour la légende. */
  how: string;
  shape: Shape;
  color: string;
  accent: string;
  /** Plante rare d'exploit : posée une fois, adulte. */
  rare: boolean;
  /** Exemplaires offerts restants (gagnés en défi, reçus en cadeau). */
  free: number;
  /** Coût de la prochaine plantation : 0 si un exemplaire offert reste, sinon 10. */
  cost: number;
  /** Plante du catalogue : sa rareté. */
  tier?: Tier;
}

/** Les espèces que je peux planter : celles débloquées, puis les plantes rares d'exploits pas encore posées. */
export function seedsOf(data: IslandData): Seed[] {
  const free = data.free ?? {};
  const unlocked = (data.unlocked ?? []).flatMap((key) => {
    const n = Number(free[key] ?? 0);
    const item = ITEM_BY_KEY[key];
    if (item) {
      if (item.kind === "visiteur") return [];
      return [{ key, name: item.name, how: TIER_LABEL[item.tier], shape: item.shape, color: item.color, accent: item.accent, rare: false, free: n, cost: n > 0 ? 0 : PLANT_COST, tier: item.tier }];
    }
    const s = SPECIES_BY_KEY[key];
    return s ? [{ key, name: s.name, how: s.grownBy, shape: s.shape, color: s.color, accent: s.accent, rare: false, free: n, cost: n > 0 ? 0 : PLANT_COST }] : [];
  });
  const placedRares = new Set(data.plants.filter((p) => p.rare).map((p) => p.species));
  const rares = RARES.filter((r) => (r.exploit ? Boolean(data.exploits[r.exploit]) : data.rares.includes(r.key)))
    .filter((r) => !placedRares.has(r.key))
    .map((r) => ({ key: r.key, name: r.name, how: r.how, shape: r.shape, color: r.color, accent: r.accent, rare: true, free: 1, cost: 0 }));
  return [...unlocked, ...rares];
}

/** Les migrateurs arrivés sur l'île grâce à l'équipe (ils ne se plantent pas). */
export function guestsOf(data: Pick<IslandData, "inventory">): string[] {
  return Object.entries(data.inventory ?? {})
    .filter(([key, n]) => ITEM_BY_KEY[key]?.kind === "visiteur" && Number(n) > 0)
    .map(([key]) => key);
}

export type PlantCheck = "nouvelle" | "occupe" | "hors_ile" | "hors_zone";

/** Ce que donnerait une plantation en (x, z). */
export function checkTile(plants: IslandPlant[], seed: Pick<Seed, "key">, x: number, z: number): PlantCheck {
  if (!tileOk(x, z)) return "hors_ile";
  if (plants.some((p) => p.x === x && p.z === z)) return "occupe";
  return tileFits(seed.key, x, z) ? "nouvelle" : "hors_zone";
}

const spend = (data: IslandData, n: number): IslandData["pousses"] => (data.pousses == null ? data.pousses : Math.max(0, data.pousses - n));

/** Applique une plantation en local (affichage immédiat, avant la réponse du serveur). */
export function plantLocally(data: IslandData, seed: Pick<Seed, "key" | "rare" | "cost">, x: number, z: number): IslandData {
  if (checkTile(data.plants, seed, x, z) !== "nouvelle") return data;
  const now = new Date().toISOString();
  const free = seed.cost === 0;
  return {
    ...data,
    pousses: spend(data, seed.cost),
    free: free && !seed.rare ? { ...data.free, [seed.key]: Math.max(0, Number(data.free?.[seed.key] ?? 0) - 1) } : data.free,
    plants: [
      ...data.plants,
      { id: `local-${x}-${z}`, species: seed.key, rare: seed.rare || Boolean(ITEM_BY_KEY[seed.key]), x, z, fed: 1, stage: seed.rare ? 4 : 1, spent: seed.cost, free, planted_at: now, grown_at: now },
    ],
  };
}

/** Fait grandir une plante d'un stade en local (null : adulte, ou pas assez de pousses). */
export function growLocally(data: IslandData, at: { x: number; z: number }): IslandData | null {
  const plant = data.plants.find((p) => p.x === at.x && p.z === at.z);
  if (!plant) return null;
  const stage = stageOf(plant);
  const cost = GROW_COST[stage];
  if (!cost || (data.pousses ?? 0) < cost) return null;
  return {
    ...data,
    pousses: spend(data, cost),
    plants: data.plants.map((p) => (p === plant ? { ...p, stage: stage + 1, spent: (p.spent ?? 0) + cost, grown_at: new Date().toISOString() } : p)),
  };
}

export const ISLAND_ERRORS: Record<string, string> = {
  no_seed: "Cette espèce n'est pas encore débloquée.",
  locked: "Cette espèce n'est pas encore débloquée : regarde dans la Serre comment l'obtenir.",
  tile_taken: "Cet emplacement est pris : choisis une case libre.",
  off_island: "Cet emplacement est hors de l'île.",
  already_planted: "Cette plante rare est déjà sur ton île.",
  no_plant: "Cette plante n'est plus là : l'île a été mise à jour.",
  wrong_zone: "Cette plante pousse dans sa zone : choisis une case en surbrillance.",
  not_enough: "Pas assez de pousses : enregistre des actions pour en gagner.",
  adult: "Cette plante est déjà adulte.",
  already_gifted: "Tu as déjà offert un myosotis aujourd'hui. Reviens demain !",
  not_colleague: "Choisis un collègue de ton entreprise.",
};

/** Les cases libres où cette espèce peut aller. */
export function playableTiles(plants: IslandPlant[], seed: Pick<Seed, "key">): number {
  return ISLAND_TILES.filter((t) => checkTile(plants, seed, t.x, t.z) === "nouvelle").length;
}

/** Déplace une plante vers une case libre (affichage immédiat). */
export function moveLocally(data: IslandData, from: { x: number; z: number }, to: { x: number; z: number }): IslandData {
  const plant = data.plants.find((p) => p.x === from.x && p.z === from.z);
  if (!plant || !tileOk(to.x, to.z) || !tileFits(plant.species, to.x, to.z) || data.plants.some((p) => p.x === to.x && p.z === to.z)) return data;
  return { ...data, plants: data.plants.map((p) => (p.x === from.x && p.z === from.z ? { ...p, x: to.x, z: to.z } : p)) };
}

/** Arrache une plante : les pousses dépensées reviennent, l'exemplaire offert aussi. */
export function uprootLocally(data: IslandData, at: { x: number; z: number }): IslandData {
  const plant = data.plants.find((p) => p.x === at.x && p.z === at.z);
  if (!plant) return data;
  const item = ITEM_BY_KEY[plant.species];
  return {
    ...data,
    pousses: data.pousses == null ? data.pousses : data.pousses + (plant.spent ?? 0),
    free: plant.free && item ? { ...data.free, [plant.species]: Number(data.free?.[plant.species] ?? 0) + 1 } : data.free,
    plants: data.plants.filter((p) => p !== plant),
  };
}

/** « Planter pour moi » : la case libre de sa zone la plus proche du centre (la case centrale en dernier). */
export function bestTile(plants: IslandPlant[], seed: Pick<Seed, "key">): { x: number; z: number } | null {
  const centreLast = (t: { x: number; z: number }) => (zoneOfSpecies(seed.key) && zoneOfTile(t.x, t.z) === null ? 1 : 0);
  const free = ISLAND_TILES.filter((t) => checkTile(plants, seed, t.x, t.z) === "nouvelle").sort(
    (a, b) => centreLast(a) - centreLast(b) || a.x * a.x + a.z * a.z - (b.x * b.x + b.z * b.z) || a.x - b.x || a.z - b.z,
  )[0];
  return free ? { x: free.x, z: free.z } : null;
}
