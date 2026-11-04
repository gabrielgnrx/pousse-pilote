/**
 * Le prochain objectif de l'île : l'animal le plus facile à faire revenir, avec ses étapes et ce qu'il
 * faut faire maintenant (débloquer une espèce, la planter, la placer). Les animaux sont rangés du plus
 * simple (deux plantes de départ côte à côte) au plus long (arbre remarquable, défi de 3 mois), pour
 * qu'il y ait toujours un but atteignable en un ou deux jours. Tout se déduit de l'île : rien n'est
 * stocké, comme pour les animaux eux-mêmes (ecosystem.ts).
 */
import { SPECIES } from "./garden.ts";
import { ITEM_BY_KEY, TIER_LABEL, challengeReward, zoneSeeds } from "./catalog.ts";
import { ANIMAL_BY_KEY, animalsOn, zoneStates, type Animal, type AnimalKey } from "./ecosystem.ts";
import { ZONE_BY_KEY, guestsOf, stageOf, lookOf, zoneOfTile, type IslandData, type IslandPlant, type Zone } from "./island.ts";

/** Ce que le bouton de l'objectif propose : choisir une graine sur l'île, ou aller la gagner. */
export type GoalAction =
  | { kind: "planter"; species: string; label: string }
  | { kind: "lien"; href: string; label: string }
  | { kind: "ile"; label: string };

export interface GoalStep {
  label: string;
  done: boolean;
  /** Ce qu'il faut faire pour cette étape. */
  action: GoalAction;
}

export interface Goal {
  animal: Animal;
  zone: Zone | null;
  steps: GoalStep[];
  done: number;
  total: number;
  /** L'action de la première étape à faire. */
  next: GoalAction;
}

/** Les fleurs qui comptent pour les coccinelles et les papillons (même liste que ecosystem.ts). */
const FLOWERS = ["scan", "bravo", "quiz", "muguet", "capucine", "lys_sable", "salicaire", "chardon", "iris", "myosotis", "rosier", "orchidee", "edelweiss", "lotus", "nenuphar"];
const BASE = ["transport", "alimentation", "consommation", "logement"];
const ACTIVITY: Record<string, { how: string; href: string; label: string }> = {
  nature: { how: "une action nature (compost, ramassage…)", href: "/agir", label: "Enregistrer une action nature" },
  scan: { how: "un meilleur choix au scanner", href: "/scanner", label: "Scanner un produit" },
  bravo: { how: "un bravo à un collègue dans le fil", href: "/fil", label: "Féliciter un collègue" },
  quiz: { how: "un quiz du jour réussi (7/10)", href: "/quiz", label: "Faire le quiz du jour" },
  cap: { how: "une bonne habitude enregistrée", href: "/agir", label: "Enregistrer une habitude" },
};
const DEFI_HOW: Partial<Record<string, string>> = {
  rare: "un défi d'une semaine",
  speciale: "un défi d'un mois",
  fleurie: "un défi d'un mois, 4 fois par semaine",
  remarquable: "un défi de 3 mois",
};

export function speciesName(key: string): string {
  return ITEM_BY_KEY[key]?.name ?? SPECIES.find((s) => s.key === key)?.name ?? key;
}

/** Comment débloquer une espèce, et où aller pour le faire. `counts` : les actions par famille. */
export function unlockHow(key: string, counts: Record<string, number>): { how: string; action: GoalAction } {
  if (BASE.includes(key)) return { how: "Espèce de départ", action: { kind: "planter", species: key, label: `Planter : ${speciesName(key)}` } };
  const activity = ACTIVITY[key];
  if (activity) return { how: activity.how, action: { kind: "lien", href: activity.href, label: activity.label } };
  const item = ITEM_BY_KEY[key];
  if (item?.zone && item.unlock) {
    const have = Math.min(zoneSeeds(counts, item.zone), item.unlock);
    const family = ZONE_BY_KEY[item.zone].grownBy;
    return { how: `${item.unlock} actions pour ${family} (${have}/${item.unlock})`, action: { kind: "lien", href: "/agir", label: "Enregistrer une action" } };
  }
  if (item?.kind === "defi") {
    const theme = item.zone ? ZONE_BY_KEY[item.zone].grownBy.replace(/^(tes|ta) /, "") : "";
    return { how: `${TIER_LABEL[item.tier]} : ${DEFI_HOW[item.tier] ?? "un défi"}, thème ${theme}`, action: { kind: "lien", href: "/defis?onglet=catalogue", label: "Lancer un défi" } };
  }
  if (key === "myosotis") return { how: "offert par un collègue", action: { kind: "lien", href: "/equipes", label: "Voir mon équipe" } };
  return { how: "graine mystère des quêtes du jour", action: { kind: "lien", href: "/defis", label: "Voir mes quêtes" } };
}

interface Ctx {
  plants: IslandPlant[];
  unlocked: Set<string>;
  counts: Record<string, number>;
}

/** Débloquer puis planter n exemplaires d'une espèce (une ou deux étapes). */
function needSteps(c: Ctx, key: string, n: number, where?: Zone | null): GoalStep[] {
  const name = speciesName(key);
  const have = c.plants.filter((p) => p.species === key && (!where || zoneOfTile(p.x, p.z) === where)).length;
  const steps: GoalStep[] = [];
  if (!c.unlocked.has(key) && have < n) {
    const u = unlockHow(key, c.counts);
    steps.push({ label: `Débloquer : ${name} (${u.how})`, done: false, action: u.action });
  }
  const zone = where ? ` dans la zone ${ZONE_BY_KEY[where].name}` : "";
  steps.push({
    label: n > 1 ? `Planter ${n} ${name}${zone} (${Math.min(have, n)}/${n})` : `Planter : ${name}${zone}`,
    done: have >= n,
    action: { kind: "planter", species: key, label: `Planter : ${name}` },
  });
  return steps;
}

/** N fleurs (d'espèces différentes si `distinct`) : on propose la première fleur débloquée, sinon comment en débloquer une. */
function flowerSteps(c: Ctx, n: number, distinct: boolean): GoalStep[] {
  const planted = c.plants.filter((p) => FLOWERS.includes(p.species));
  const have = distinct ? new Set(planted.map((p) => p.species)).size : planted.length;
  const plantedKinds = new Set(planted.map((p) => p.species));
  const canPlant = FLOWERS.filter((k) => c.unlocked.has(k) && (!distinct || !plantedKinds.has(k)));
  const toUnlock = ["bravo", "quiz", "scan"].find((k) => !c.unlocked.has(k));
  const action: GoalAction = canPlant.length
    ? { kind: "planter", species: canPlant[0], label: `Planter : ${speciesName(canPlant[0])}` }
    : toUnlock
      ? { kind: "lien", href: ACTIVITY[toUnlock].href, label: ACTIVITY[toUnlock].label }
      : { kind: "ile", label: "Voir mon île" };
  return [{ label: `${n} fleurs${distinct ? " différentes" : ""} sur l'île (${Math.min(have, n)}/${n})`, done: have >= n, action }];
}

const placeStep = (label: string, done: boolean): GoalStep => ({ label, done, action: { kind: "ile", label: "Toucher une plante, puis Déplacer" } });

/** Les animaux dans l'ordre où on les vise, du plus simple au plus long, avec leurs étapes. */
const PLANS: ReadonlyArray<{ key: AnimalKey; zone: Zone | null; steps: (c: Ctx, here: boolean) => GoalStep[] }> = [
  {
    key: "herisson",
    zone: "potager",
    steps: (c, here) => [...needSteps(c, "alimentation", 1), ...needSteps(c, "consommation", 1), placeStep("Le potager et la fougère côte à côte", here)],
  },
  {
    key: "coccinelles",
    zone: "potager",
    steps: (c, here) => [...needSteps(c, "alimentation", 1), ...flowerSteps(c, 2, false), placeStep("Deux fleurs juste à côté du potager", here)],
  },
  { key: "lezard", zone: "plage", steps: (c) => needSteps(c, "cap", 1, "plage") },
  { key: "chardonneret", zone: "plage", steps: (c, here) => [...needSteps(c, "chardon", 2), placeStep("Les deux chardons côte à côte", here)] },
  {
    key: "oiseaux",
    zone: null,
    steps: (c, here) => {
      const trees = c.plants.filter((p) => lookOf(p)?.shape === "arbre" && stageOf(p) >= 2).length;
      return [
        { label: `3 arbres au stade Germe ou plus (${Math.min(trees, 3)}/3)`, done: trees >= 3, action: { kind: "ile", label: "Faire grandir un arbre" } },
        placeStep("Les trois arbres alignés, en haie", here),
      ];
    },
  },
  {
    key: "abeilles",
    zone: null,
    steps: (c, here) => [...needSteps(c, "quiz", 1), ...needSteps(c, "scan", 1), ...needSteps(c, "bravo", 1), placeStep("Les trois fleurs tout près l'une de l'autre", here)],
  },
  { key: "papillons", zone: null, steps: (c) => flowerSteps(c, 4, true) },
  {
    key: "ecureuil",
    zone: "foret",
    steps: (c) => {
      const adult = c.plants.some((p) => lookOf(p)?.shape === "arbre" && stageOf(p) >= 3 && zoneOfTile(p.x, p.z) === "foret");
      return [{ label: "Un arbre au stade Jeune plant dans la forêt", done: adult, action: { kind: "ile", label: "Faire grandir un arbre" } }];
    },
  },
  { key: "rouge_gorge", zone: null, steps: (c) => needSteps(c, "myosotis", 3) },
  { key: "geai", zone: "foret", steps: (c, here) => [...needSteps(c, "noisetier", 2), ...needSteps(c, "merisier_fleurs", 1), placeStep("Les noisetiers tout près du merisier", here)] },
  { key: "mesanges", zone: "potager", steps: (c, here) => [...needSteps(c, "groseillier", 2), ...needSteps(c, "figuier_fruits", 1), placeStep("Les groseilliers tout près du figuier", here)] },
  { key: "gravelot", zone: "plage", steps: (c, here) => [...needSteps(c, "oyat", 2), ...needSteps(c, "tamaris_fleurs", 1), placeStep("Les oyats tout près du tamaris", here)] },
  { key: "libellules", zone: "ruisseau", steps: (c, here) => [...needSteps(c, "roseau", 2), ...needSteps(c, "saule_chatons", 1), placeStep("Les roseaux tout près du saule", here)] },
  ...(["foret", "potager", "plage", "ruisseau"] as const).map((zone) => ({
    key: ({ foret: "chouette", potager: "ver_de_terre", plage: "tortue", ruisseau: "martin_pecheur" } as const)[zone],
    zone,
    steps: (c: Ctx): GoalStep[] => {
      const s = zoneStates(c.plants).find((z) => z.key === zone)!;
      return [{ label: `Zone ${s.name} restaurée (${s.fed}/${s.target} stades)`, done: s.fed >= s.target, action: { kind: "ile", label: "Faire grandir les plantes de la zone" } }];
    },
  })),
  { key: "pic_vert", zone: "foret", steps: (c) => needSteps(c, "hetre", 1) },
  { key: "loir", zone: "potager", steps: (c) => needSteps(c, "chataignier", 1) },
  { key: "huppe", zone: "plage", steps: (c) => needSteps(c, "chene_liege", 1) },
  { key: "heron", zone: "ruisseau", steps: (c) => needSteps(c, "platane", 1) },
];

function build(plan: (typeof PLANS)[number], c: Ctx): Goal {
  const steps = plan.steps(c, false);
  const next = steps.find((s) => !s.done)?.action ?? { kind: "ile", label: "Voir mon île" };
  return { animal: ANIMAL_BY_KEY[plan.key], zone: plan.zone, steps, done: steps.filter((s) => s.done).length, total: steps.length, next };
}

/**
 * Les objectifs pas encore atteints, dans l'ordre. `zone` : seulement ceux de cette zone (la Serre).
 * Un objectif presque fini passe devant ceux qui n'ont pas commencé, à rang égal ou voisin.
 */
export function goalsOf(data: Pick<IslandData, "plants" | "unlocked" | "counts" | "inventory">, zone?: Zone | null): Goal[] {
  const present = new Set(animalsOn(data.plants, guestsOf(data)).map((a) => a.animal.key));
  const c: Ctx = { plants: data.plants, unlocked: new Set(data.unlocked ?? []), counts: data.counts ?? {} };
  return PLANS.filter((p) => !present.has(p.key) && (zone === undefined || p.zone === zone)).map((p) => build(p, c));
}

/** Le prochain objectif : le premier de la liste, sauf si le suivant est déjà plus avancé. */
export function nextGoal(data: Pick<IslandData, "plants" | "unlocked" | "counts" | "inventory">, zone?: Zone | null): Goal | null {
  const goals = goalsOf(data, zone);
  if (!goals.length) return null;
  const [first, second] = goals;
  const ratio = (g: Goal) => g.done / Math.max(1, g.total);
  return second && ratio(second) > ratio(first) ? second : first;
}

/** La famille d'actions d'un thème de défi (catégorie du modèle), pour l'île ; null : hors île. */
export function familyZone(category: string): Zone | null {
  if (category === "transport" || category === "nature") return "foret";
  if (category === "alimentation") return "potager";
  if (category === "consommation") return "plage";
  if (category === "logement") return "ruisseau";
  return null;
}

/** Ce qu'une action vient de changer sur l'île, pour la pop-up : déblocage, prochaine espèce, plante à faire grandir. */
export interface IslandNudge {
  pousses: number;
  zone: string | null;
  /** Espèces que cette action vient de débloquer. */
  unlocked: string[];
  /** La prochaine espèce de la famille, et où on en est. */
  next: { name: string; have: number; need: number } | null;
  /** Une plante qu'on peut faire grandir tout de suite avec ses pousses (la moins chère). */
  grow: { name: string; cost: number } | null;
  goal: { animal: string; done: number; total: number } | null;
}

export function islandAfterAction(data: IslandData, category: string, units = 1): IslandNudge {
  const zone = familyZone(category);
  const counts = data.counts ?? {};
  const have = zone ? zoneSeeds(counts, zone) : 0;
  const shop = zone
    ? Object.values(ITEM_BY_KEY)
        .filter((i) => i.zone === zone && (i.kind === "boutique" || i.kind === "signature") && i.unlock)
        .sort((a, b) => (a.unlock ?? 0) - (b.unlock ?? 0))
    : [];
  const unlocked = shop.filter((i) => (i.unlock ?? 0) <= have && (i.unlock ?? 0) > have - units).map((i) => i.name);
  const upcoming = shop.find((i) => (i.unlock ?? 0) > have);
  const pousses = data.pousses ?? 0;
  const growable = data.plants
    .map((p) => ({ p, look: lookOf(p) }))
    .filter((x): x is { p: IslandPlant; look: NonNullable<ReturnType<typeof lookOf>> } => !!x.look && x.look.next !== null && x.look.next <= pousses)
    .sort((a, b) => (a.look.next ?? 0) - (b.look.next ?? 0))[0];
  const goal = nextGoal(data);
  return {
    pousses,
    zone: zone ? ZONE_BY_KEY[zone].name : null,
    unlocked,
    next: upcoming ? { name: upcoming.name, have, need: upcoming.unlock ?? 0 } : null,
    grow: growable ? { name: growable.look.name, cost: growable.look.next ?? 0 } : null,
    goal: goal ? { animal: goal.animal.name, done: goal.done, total: goal.total } : null,
  };
}

/** Ce qu'un défi de ce thème débloque sur l'île, en une ligne : « Muguet en 1 semaine, Merisier en 1 mois ». */
export function challengePlantHint(category: string): string {
  const [week] = challengeReward(category, 7, 1);
  const [month] = challengeReward(category, 30, 1);
  return `Débloque ${speciesName(week)} (1 sem.) ou ${speciesName(month)} (1 mois)`;
}
