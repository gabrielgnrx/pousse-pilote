/**
 * L'écosystème de l'île : chaque zone se restaure avec les graines de sa famille d'actions, et des
 * animaux reviennent quand une condition est remplie (une association de plantes, ou une zone
 * restaurée). Tout se déduit des plantes posées : rien n'est stocké, un animal repart si on arrache
 * ce qui l'a attiré.
 */
import { ZONES, lookOf, zoneOfTile, type IslandPlant, type Zone } from "./island.ts";

export interface ZoneState {
  key: Zone;
  name: string;
  grownBy: string;
  /** Graines de la bonne famille plantées dans la zone. */
  fed: number;
  target: number;
  /** De 0 (abîmée) à 1 (restaurée). */
  health: number;
}

/** L'état des quatre zones : seules les plantes de la famille de la zone, posées dans la zone, comptent. */
export function zoneStates(plants: IslandPlant[]): ZoneState[] {
  return ZONES.map((z) => {
    const fed = plants
      .filter((p) => !p.rare && p.species === z.species && zoneOfTile(p.x, p.z) === z.key)
      .reduce((n, p) => n + p.fed, 0);
    return { key: z.key, name: z.name, grownBy: z.grownBy, fed, target: z.target, health: Math.min(1, fed / z.target) };
  });
}

export type AnimalKey =
  | "abeilles"
  | "oiseaux"
  | "grenouilles"
  | "herisson"
  | "papillons"
  | "ecureuil"
  | "martin_pecheur"
  | "tortue"
  | "coccinelles"
  | "lezard"
  | "chouette"
  | "ver_de_terre";

export interface Animal {
  key: AnimalKey;
  name: string;
  /** L'annonce de son retour. */
  title: string;
  /** L'indice montré tant qu'il n'est pas revenu. */
  hint: string;
  /** Ce qui l'a fait revenir, une fois là. */
  how: string;
  /** Ce que ça dit de la vraie nature. */
  why: string;
}

/** Où dessiner un animal : en coordonnées de cases (décimales possibles). */
export type Anchor = { x: number; z: number };

interface Ctx {
  plants: IslandPlant[];
  health: Record<Zone, number>;
}

const FLOWERS = ["scan", "bravo", "quiz", "rosier", "orchidee", "edelweiss", "lotus", "nenuphar"];
const near = (a: Anchor, b: Anchor, d: number) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z)) <= d;
const centroid = (ps: Anchor[]): Anchor => ({ x: ps.reduce((n, p) => n + p.x, 0) / ps.length, z: ps.reduce((n, p) => n + p.z, 0) / ps.length });
const ofSpecies = (c: Ctx, ...keys: string[]) => c.plants.filter((p) => keys.includes(p.species));
const isTree = (p: IslandPlant) => {
  const l = lookOf(p);
  return !!l && l.shape === "arbre" && l.stage >= 2;
};

const RULES: Record<AnimalKey, (c: Ctx) => Anchor | null> = {
  abeilles: (c) => {
    for (const l of ofSpecies(c, "quiz"))
      for (const t of ofSpecies(c, "scan"))
        for (const k of ofSpecies(c, "bravo")) if (near(l, t, 2) && near(l, k, 2) && near(t, k, 2)) return centroid([l, t, k]);
    return null;
  },
  oiseaux: (c) => {
    const trees = c.plants.filter(isTree);
    const at = (x: number, z: number) => trees.some((p) => p.x === x && p.z === z);
    for (const p of trees) {
      if (at(p.x + 1, p.z) && at(p.x + 2, p.z)) return { x: p.x + 1, z: p.z };
      if (at(p.x, p.z + 1) && at(p.x, p.z + 2)) return { x: p.x, z: p.z + 1 };
    }
    return null;
  },
  grenouilles: (c) => ofSpecies(c, "lotus", "nenuphar").find((p) => zoneOfTile(p.x, p.z) === "ruisseau") ?? null,
  herisson: (c) => {
    const ferns = ofSpecies(c, "consommation");
    return ofSpecies(c, "alimentation").find((p) => ferns.some((f) => near(p, f, 1))) ?? null;
  },
  papillons: (c) => {
    const flowers = ofSpecies(c, ...FLOWERS);
    return new Set(flowers.map((p) => p.species)).size >= 4 ? centroid(flowers) : null;
  },
  ecureuil: (c) =>
    c.plants.find((p) => isTree(p) && zoneOfTile(p.x, p.z) === "foret" && (lookOf(p)?.stage ?? 0) >= 3) ?? null,
  martin_pecheur: (c) => (c.health.ruisseau >= 1 ? { x: 2.1, z: -2.3 } : null),
  tortue: (c) => (c.health.plage >= 1 ? { x: 3.1, z: 2.4 } : null),
  coccinelles: (c) => {
    const flowers = ofSpecies(c, ...FLOWERS);
    return ofSpecies(c, "alimentation").find((p) => flowers.filter((f) => near(p, f, 1)).length >= 2) ?? null;
  },
  lezard: (c) => ofSpecies(c, "cap").find((p) => zoneOfTile(p.x, p.z) === "plage") ?? null,
  chouette: (c) => (c.health.foret >= 1 ? { x: -1.6, z: -1.6 } : null),
  ver_de_terre: (c) => (c.health.potager >= 1 ? { x: -0.8, z: 2.2 } : null),
};

export const ANIMALS: readonly Animal[] = [
  {
    key: "abeilles",
    name: "Abeilles",
    title: "Les abeilles sont revenues",
    hint: "Trois fleurs différentes, tout près l'une de l'autre",
    how: "Lavande, tournesol et coquelicot côte à côte",
    why: "Les abeilles ont besoin de fleurs variées, qui fleurissent à des moments différents, pour se nourrir toute la saison.",
  },
  {
    key: "oiseaux",
    name: "Oiseaux",
    title: "Les oiseaux sont revenus",
    hint: "Une haie : trois arbres alignés",
    how: "Trois arbres en ligne forment une haie",
    why: "Les haies offrent aux oiseaux un abri, des lieux de nid et de la nourriture ; elles ont beaucoup reculé dans les campagnes.",
  },
  {
    key: "grenouilles",
    name: "Grenouilles",
    title: "Les grenouilles sont revenues",
    hint: "Une plante d'eau au bord du ruisseau",
    how: "Un lotus ou un nénuphar dans la zone du ruisseau",
    why: "Les amphibiens ont besoin de points d'eau pour se reproduire : une simple mare peut en accueillir.",
  },
  {
    key: "herisson",
    name: "Hérisson",
    title: "Un hérisson s'est installé",
    hint: "Un abri de fougères à côté du potager",
    how: "Un potager et une fougère voisins",
    why: "Le hérisson mange limaces et insectes : c'est un allié du potager, s'il trouve un abri pour se cacher.",
  },
  {
    key: "papillons",
    name: "Papillons",
    title: "Les papillons sont revenus",
    hint: "Quatre espèces de fleurs sur l'île",
    how: "Quatre fleurs différentes sur l'île",
    why: "Plus il y a d'espèces de fleurs, plus les papillons trouvent où se nourrir et où pondre.",
  },
  {
    key: "ecureuil",
    name: "Écureuil",
    title: "Un écureuil s'est installé",
    hint: "Un grand arbre dans la forêt",
    how: "Un arbre devenu adulte dans la forêt",
    why: "Les grands arbres donnent aux écureuils graines, abri et place pour leur nid.",
  },
  {
    key: "martin_pecheur",
    name: "Martin-pêcheur",
    title: "Un martin-pêcheur est revenu",
    hint: "Le ruisseau doit couler à nouveau",
    how: "Le ruisseau restauré",
    why: "Il ne vit qu'au bord d'une eau claire et poissonneuse : sa présence signale une rivière en bonne santé.",
  },
  {
    key: "tortue",
    name: "Tortue",
    title: "Une tortue est revenue",
    hint: "Une plage sans déchet",
    how: "La plage restaurée",
    why: "Les déchets plastiques sur les plages et en mer sont un danger pour les tortues marines.",
  },
  {
    key: "coccinelles",
    name: "Coccinelles",
    title: "Les coccinelles sont arrivées",
    hint: "Un potager entouré de fleurs",
    how: "Deux fleurs à côté d'un potager",
    why: "Les coccinelles mangent les pucerons : des fleurs près du potager les attirent, sans pesticide.",
  },
  {
    key: "lezard",
    name: "Lézard",
    title: "Un lézard s'est installé",
    hint: "Un cactus au soleil, sur la plage",
    how: "Un cactus dans la zone de la plage",
    why: "Les lézards ont besoin d'endroits secs et ensoleillés pour se réchauffer.",
  },
  {
    key: "chouette",
    name: "Chouette",
    title: "Une chouette s'est installée",
    hint: "Une forêt entièrement restaurée",
    how: "La forêt restaurée",
    why: "Une forêt mature, avec de vieux arbres, offre aux chouettes des cavités pour nicher.",
  },
  {
    key: "ver_de_terre",
    name: "Vers de terre",
    title: "Les vers de terre sont revenus",
    hint: "Un potager entièrement restauré",
    how: "Le potager restauré",
    why: "Les vers de terre aèrent et enrichissent le sol : un potager vivant en est plein.",
  },
];

/** Les animaux présents sur l'île, avec l'endroit où les dessiner. */
export function animalsOn(plants: IslandPlant[]): { animal: Animal; at: Anchor }[] {
  const health = Object.fromEntries(zoneStates(plants).map((z) => [z.key, z.health])) as Record<Zone, number>;
  const ctx = { plants, health };
  return ANIMALS.flatMap((animal) => {
    const at = RULES[animal.key](ctx);
    return at ? [{ animal, at: { x: at.x, z: at.z } }] : [];
  });
}

/** Les animaux arrivés entre deux états de l'île (pour fêter un nouvel habitant). */
export function newcomers(before: IslandPlant[], after: IslandPlant[]): Animal[] {
  const had = new Set(animalsOn(before).map((a) => a.animal.key));
  return animalsOn(after)
    .map((a) => a.animal)
    .filter((a) => !had.has(a.key));
}
