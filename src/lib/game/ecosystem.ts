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
  | "ver_de_terre"
  // Plantes de la Graineterie et des défis (0050_ile_graineterie.sql).
  | "geai"
  | "mesanges"
  | "gravelot"
  | "libellules"
  | "pic_vert"
  | "loir"
  | "huppe"
  | "heron"
  | "rouge_gorge"
  | "chardonneret"
  // Migrateurs, accueillis en équipe.
  | "cigogne"
  | "grue"
  | "hirondelles"
  | "oies";

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
  /** Migrateur : il arrive en équipe, pas par les plantes. */
  team?: boolean;
}

/** Où dessiner un animal : en coordonnées de cases (décimales possibles). */
export type Anchor = { x: number; z: number };

interface Ctx {
  plants: IslandPlant[];
  health: Record<Zone, number>;
}

const FLOWERS = ["scan", "bravo", "quiz", "rosier", "orchidee", "edelweiss", "lotus", "nenuphar", "muguet", "capucine", "lys_sable", "salicaire", "chardon", "iris", "myosotis"];
const near = (a: Anchor, b: Anchor, d: number) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z)) <= d;
const centroid = (ps: Anchor[]): Anchor => ({ x: ps.reduce((n, p) => n + p.x, 0) / ps.length, z: ps.reduce((n, p) => n + p.z, 0) / ps.length });
const ofSpecies = (c: Ctx, ...keys: string[]) => c.plants.filter((p) => keys.includes(p.species));
const isTree = (p: IslandPlant) => {
  const l = lookOf(p);
  return !!l && l.shape === "arbre" && l.stage >= 2;
};

/** Une plante (la première trouvée) avec au moins n plantes d'une autre espèce à 2 cases ou moins. */
const withNeighbours = (c: Ctx, key: string, other: string, n: number): Anchor | null =>
  ofSpecies(c, key).find((p) => ofSpecies(c, other).filter((o) => near(p, o, 2)).length >= n) ?? null;
const first = (c: Ctx, key: string): Anchor | null => ofSpecies(c, key)[0] ?? null;

const RULES: Record<Exclude<AnimalKey, "cigogne" | "grue" | "hirondelles" | "oies">, (c: Ctx) => Anchor | null> = {
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
  geai: (c) => withNeighbours(c, "merisier_fleurs", "noisetier", 2),
  mesanges: (c) => withNeighbours(c, "figuier_fruits", "groseillier", 2),
  gravelot: (c) => withNeighbours(c, "tamaris_fleurs", "oyat", 2),
  libellules: (c) => withNeighbours(c, "saule_chatons", "roseau", 2),
  pic_vert: (c) => first(c, "hetre"),
  loir: (c) => first(c, "chataignier"),
  huppe: (c) => first(c, "chene_liege"),
  heron: (c) => first(c, "platane"),
  rouge_gorge: (c) => {
    const m = ofSpecies(c, "myosotis");
    return m.length >= 3 ? centroid(m) : null;
  },
  chardonneret: (c) => withNeighbours(c, "chardon", "chardon", 2),
};

/** Où se posent les migrateurs accueillis par l'équipe. */
const GUEST_SPOTS: Record<"cigogne" | "grue" | "hirondelles" | "oies", Anchor> = {
  cigogne: { x: 0.3, z: 0.4 },
  grue: { x: 1.4, z: 1.1 },
  hirondelles: { x: -0.4, z: -0.9 },
  oies: { x: -1.6, z: 0.9 },
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
  {
    key: "geai",
    name: "Geai des chênes",
    title: "Un geai des chênes est arrivé",
    hint: "Un merisier en fleurs, avec deux noisetiers tout près",
    how: "Un merisier en fleurs et deux noisetiers voisins",
    why: "Le geai cache des glands et des noisettes pour l'hiver : ceux qu'il oublie deviennent des arbres, il replante ainsi des forêts.",
  },
  {
    key: "mesanges",
    name: "Mésanges",
    title: "Les mésanges sont arrivées",
    hint: "Un figuier en fruits, avec deux groseilliers tout près",
    how: "Un figuier en fruits et deux groseilliers voisins",
    why: "Les mésanges mangent chenilles et pucerons : elles protègent les arbres fruitiers sans pesticide.",
  },
  {
    key: "gravelot",
    name: "Gravelot",
    title: "Un gravelot niche sur la plage",
    hint: "Un tamaris en fleurs, avec deux touffes d'oyat tout près",
    how: "Un tamaris en fleurs et deux touffes d'oyat voisines",
    why: "Le gravelot pond à même le sable : il a besoin de plages calmes, où les oyats tiennent la dune.",
  },
  {
    key: "libellules",
    name: "Libellules",
    title: "Les libellules sont revenues",
    hint: "Un saule en chatons, avec deux roseaux tout près",
    how: "Un saule en chatons et deux roseaux voisins",
    why: "Les larves de libellules vivent des mois sous l'eau : leur retour signale une eau propre.",
  },
  {
    key: "pic_vert",
    name: "Pic vert",
    title: "Un pic vert s'est installé",
    hint: "Un hêtre remarquable (défi de 3 mois sur tes trajets)",
    how: "Un hêtre remarquable dans la forêt",
    why: "Le pic vert creuse son nid dans les vieux arbres ; ses anciennes loges abritent ensuite d'autres oiseaux.",
  },
  {
    key: "loir",
    name: "Loir",
    title: "Un loir s'est installé",
    hint: "Un châtaignier remarquable (défi de 3 mois sur tes repas)",
    how: "Un châtaignier remarquable dans le potager",
    why: "Le loir fait des réserves de châtaignes et de fruits secs avant de dormir tout l'hiver.",
  },
  {
    key: "huppe",
    name: "Huppe fasciée",
    title: "Une huppe fasciée est arrivée",
    hint: "Un chêne-liège remarquable (défi de 3 mois sur tes achats)",
    how: "Un chêne-liège remarquable sur la plage",
    why: "La huppe chasse les insectes au sol, dans les paysages ouverts et ensoleillés.",
  },
  {
    key: "heron",
    name: "Héron cendré",
    title: "Un héron cendré s'est posé",
    hint: "Un platane remarquable (défi de 3 mois sur ta maison)",
    how: "Un platane remarquable au bord du ruisseau",
    why: "Le héron niche en colonie dans les grands arbres, au bord de l'eau où il pêche.",
  },
  {
    key: "rouge_gorge",
    name: "Rouge-gorge",
    title: "Un rouge-gorge te suit",
    hint: "Trois myosotis offerts par tes collègues",
    how: "Trois myosotis sur l'île",
    why: "Le rouge-gorge suit volontiers les jardiniers pour picorer la terre qu'ils viennent de retourner.",
  },
  {
    key: "chardonneret",
    name: "Chardonneret",
    title: "Un chardonneret est arrivé",
    hint: "Deux chardons bleus côte à côte",
    how: "Deux chardons bleus voisins",
    why: "Le chardonneret se nourrit des graines de chardon : laisser des plantes monter en graines le nourrit l'hiver.",
  },
  {
    key: "cigogne",
    name: "Cigogne blanche",
    title: "La cigogne s'est posée chez vous",
    hint: "Migrateur : faites-la voyager en équipe",
    how: "Accueillie par ton équipe",
    why: "La cigogne blanche avait presque disparu d'Alsace dans les années 1970 ; protégée, elle niche de nouveau dans toute la France.",
    team: true,
  },
  {
    key: "grue",
    name: "Grue cendrée",
    title: "Les grues se sont posées chez vous",
    hint: "Migrateur : faites-la voyager en équipe",
    how: "Accueillie par ton équipe",
    why: "Des dizaines de milliers de grues cendrées traversent la France chaque automne, en grands V bruyants.",
    team: true,
  },
  {
    key: "hirondelles",
    name: "Hirondelles",
    title: "Les hirondelles se sont posées chez vous",
    hint: "Migrateur : faites-les voyager en équipe",
    how: "Accueillies par ton équipe",
    why: "Les hirondelles ont beaucoup reculé, faute d'insectes et d'endroits où bâtir leur nid.",
    team: true,
  },
  {
    key: "oies",
    name: "Oies cendrées",
    title: "Les oies se sont posées chez vous",
    hint: "Migrateur : faites-les voyager en équipe",
    how: "Accueillies par ton équipe",
    why: "En vol, les oies se relaient en tête de la formation : chacune profite de l'aspiration des autres.",
    team: true,
  },
];

export const ANIMAL_BY_KEY = Object.fromEntries(ANIMALS.map((a) => [a.key, a])) as Record<AnimalKey, Animal>;

/**
 * Les animaux présents sur l'île, avec l'endroit où les dessiner. `guests` : les migrateurs que
 * l'équipe a accueillis (guestsOf), qui ne dépendent pas des plantes.
 */
export function animalsOn(plants: IslandPlant[], guests: readonly string[] = []): { animal: Animal; at: Anchor }[] {
  const health = Object.fromEntries(zoneStates(plants).map((z) => [z.key, z.health])) as Record<Zone, number>;
  const ctx = { plants, health };
  return ANIMALS.flatMap((animal) => {
    const at = animal.key in RULES ? RULES[animal.key as keyof typeof RULES](ctx) : guests.includes(animal.key) ? GUEST_SPOTS[animal.key as keyof typeof GUEST_SPOTS] : null;
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

/** Les recettes d'habitat des plantes du catalogue : de quoi faire revenir chaque animal. */
export const HABITATS: ReadonlyArray<{ animal: AnimalKey; zone: Zone | null; needs: ReadonlyArray<readonly [string, number]> }> = [
  { animal: "geai", zone: "foret", needs: [["merisier_fleurs", 1], ["noisetier", 2]] },
  { animal: "pic_vert", zone: "foret", needs: [["hetre", 1]] },
  { animal: "mesanges", zone: "potager", needs: [["figuier_fruits", 1], ["groseillier", 2]] },
  { animal: "loir", zone: "potager", needs: [["chataignier", 1]] },
  { animal: "gravelot", zone: "plage", needs: [["tamaris_fleurs", 1], ["oyat", 2]] },
  { animal: "chardonneret", zone: "plage", needs: [["chardon", 2]] },
  { animal: "huppe", zone: "plage", needs: [["chene_liege", 1]] },
  { animal: "libellules", zone: "ruisseau", needs: [["saule_chatons", 1], ["roseau", 2]] },
  { animal: "heron", zone: "ruisseau", needs: [["platane", 1]] },
  { animal: "rouge_gorge", zone: null, needs: [["myosotis", 3]] },
];

/**
 * Où en est chaque recette : pour chaque plante, combien sont sur l'île ou dans le bac (`have`),
 * sur combien. `here` : l'animal est déjà là.
 */
export function habitatProgress(plants: IslandPlant[], inventory: Record<string, number> = {}, guests: readonly string[] = []) {
  const present = new Set(animalsOn(plants, guests).map((a) => a.animal.key));
  return HABITATS.map((h) => ({
    animal: ANIMAL_BY_KEY[h.animal],
    zone: h.zone,
    here: present.has(h.animal),
    needs: h.needs.map(([item, need]) => ({
      item,
      need,
      have: plants.filter((p) => p.rare && p.species === item).length + Number(inventory[item] ?? 0),
    })),
  }));
}
