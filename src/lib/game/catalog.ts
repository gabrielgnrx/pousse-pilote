/**
 * Le catalogue de l'île (même catalogue que la table island_catalog, 0050 et 0051_ile_serre.sql).
 *
 * Une espèce se débloque, puis on la plante et la fait grandir avec ses pousses. Les plantes communes
 * et signature d'une zone se débloquent avec les actions de sa famille ; celles des défis en
 * réussissant un défi (le premier exemplaire est offert) ; le myosotis en le recevant d'un collègue.
 * Les migrateurs arrivent en équipe et ne se plantent pas.
 */
import type { Shape } from "./garden.ts";
import type { Zone } from "./island.ts";

export type ItemKind = "boutique" | "signature" | "defi" | "cadeau" | "visiteur";
export type Tier = "commune" | "signature" | "rare" | "speciale" | "fleurie" | "remarquable" | "amitie" | "visiteur";

export interface Item {
  key: string;
  name: string;
  zone: Zone | null;
  kind: ItemKind;
  tier: Tier;
  /**
   * Plante commune ou signature : actions de la famille de la zone qui la débloquent. Calé sur la
   * démo (4 semaines) : les communes dans le premier mois, la signature pour les plus réguliers.
   */
  unlock?: number;
  shape: Shape;
  color: string;
  accent: string;
  /** Fleurs ou fruits semés sur le feuillage. */
  dots?: string;
  /** Taille du feuillage (arbres remarquables). */
  big?: number;
}

export const ITEMS: readonly Item[] = [
  // Communes : débloquées par les premières actions de la famille.
  { key: "noisetier", name: "Noisetier", zone: "foret", kind: "boutique", tier: "commune", unlock: 2, shape: "arbre", color: "#7fb069", accent: "#8a5a2b", dots: "#a8743a" },
  { key: "houx", name: "Houx", zone: "foret", kind: "boutique", tier: "commune", unlock: 4, shape: "touffe", color: "#2f6b3a", accent: "#c8322a" },
  { key: "groseillier", name: "Groseillier", zone: "potager", kind: "boutique", tier: "commune", unlock: 3, shape: "touffe", color: "#5f9a4a", accent: "#c8322a" },
  { key: "courge", name: "Courge", zone: "potager", kind: "boutique", tier: "commune", unlock: 8, shape: "potager", color: "#6f9a3e", accent: "#e8a33a" },
  { key: "oyat", name: "Oyat", zone: "plage", kind: "boutique", tier: "commune", unlock: 1, shape: "touffe", color: "#b8c27a", accent: "#b8c27a" },
  { key: "chardon", name: "Chardon bleu", zone: "plage", kind: "boutique", tier: "commune", unlock: 2, shape: "fleur", color: "#7f96c8", accent: "#4a5e8a" },
  { key: "roseau", name: "Roseau", zone: "ruisseau", kind: "boutique", tier: "commune", unlock: 1, shape: "touffe", color: "#7a9a4a", accent: "#8a6a3a" },
  { key: "iris", name: "Iris d'eau", zone: "ruisseau", kind: "boutique", tier: "commune", unlock: 2, shape: "fleur", color: "#f2c94c", accent: "#5f8f4e" },
  // Signature : débloquées par les plus réguliers de la famille.
  { key: "erable", name: "Érable", zone: "foret", kind: "signature", tier: "signature", unlock: 8, shape: "arbre", color: "#c8642f", accent: "#6b4a2b" },
  { key: "pommier", name: "Pommier", zone: "potager", kind: "signature", tier: "signature", unlock: 15, shape: "arbre", color: "#6f9a4a", accent: "#7a5236", dots: "#d9432f" },
  { key: "pin_parasol", name: "Pin parasol", zone: "plage", kind: "signature", tier: "signature", unlock: 3, shape: "arbre", color: "#4f7a45", accent: "#8a5a3a" },
  { key: "aulne", name: "Aulne", zone: "ruisseau", kind: "signature", tier: "signature", unlock: 3, shape: "arbre", color: "#5f8a4a", accent: "#5a4a3a" },
  // Défis : le thème choisit la zone, la durée la rareté.
  { key: "muguet", name: "Muguet", zone: "foret", kind: "defi", tier: "rare", shape: "fleur", color: "#f4f1e8", accent: "#5f8f4e" },
  { key: "merisier", name: "Merisier", zone: "foret", kind: "defi", tier: "speciale", shape: "arbre", color: "#6f9a4a", accent: "#7a4a3a" },
  { key: "merisier_fleurs", name: "Merisier en fleurs", zone: "foret", kind: "defi", tier: "fleurie", shape: "arbre", color: "#7fa85a", accent: "#7a4a3a", dots: "#f6b7c8" },
  { key: "hetre", name: "Hêtre remarquable", zone: "foret", kind: "defi", tier: "remarquable", shape: "arbre", color: "#3f7a3a", accent: "#7a6a5a", big: 1.25 },
  { key: "capucine", name: "Capucine", zone: "potager", kind: "defi", tier: "rare", shape: "fleur", color: "#e8833a", accent: "#f2c230" },
  { key: "figuier", name: "Figuier", zone: "potager", kind: "defi", tier: "speciale", shape: "arbre", color: "#6a8f3e", accent: "#8a6a4a" },
  { key: "figuier_fruits", name: "Figuier en fruits", zone: "potager", kind: "defi", tier: "fleurie", shape: "arbre", color: "#5f8a3a", accent: "#8a6a4a", dots: "#7a3a8a" },
  { key: "chataignier", name: "Châtaignier remarquable", zone: "potager", kind: "defi", tier: "remarquable", shape: "arbre", color: "#5a8a3a", accent: "#6b4a2b", dots: "#c8a43a", big: 1.25 },
  { key: "lys_sable", name: "Lys des sables", zone: "plage", kind: "defi", tier: "rare", shape: "fleur", color: "#f7f3ea", accent: "#e3c34a" },
  { key: "tamaris", name: "Tamaris", zone: "plage", kind: "defi", tier: "speciale", shape: "arbre", color: "#9ab88a", accent: "#8a6a5a" },
  { key: "tamaris_fleurs", name: "Tamaris en fleurs", zone: "plage", kind: "defi", tier: "fleurie", shape: "arbre", color: "#9ab88a", accent: "#8a6a5a", dots: "#f0a3b8" },
  { key: "chene_liege", name: "Chêne-liège remarquable", zone: "plage", kind: "defi", tier: "remarquable", shape: "arbre", color: "#5f7f45", accent: "#b8743a", big: 1.25 },
  { key: "salicaire", name: "Salicaire", zone: "ruisseau", kind: "defi", tier: "rare", shape: "fleur", color: "#c45a9a", accent: "#6a8f4e" },
  { key: "saule_marsault", name: "Saule marsault", zone: "ruisseau", kind: "defi", tier: "speciale", shape: "arbre", color: "#8fb06e", accent: "#7a6a4a" },
  { key: "saule_chatons", name: "Saule en chatons", zone: "ruisseau", kind: "defi", tier: "fleurie", shape: "arbre", color: "#8fb06e", accent: "#7a6a4a", dots: "#f2e06b" },
  { key: "platane", name: "Platane remarquable", zone: "ruisseau", kind: "defi", tier: "remarquable", shape: "arbre", color: "#7aa05a", accent: "#c8b48a", big: 1.25 },
  // Équipe.
  { key: "myosotis", name: "Myosotis", zone: null, kind: "cadeau", tier: "amitie", shape: "fleur", color: "#7fa8e0", accent: "#f2d06b" },
  { key: "cigogne", name: "Cigogne", zone: null, kind: "visiteur", tier: "visiteur", shape: "fleur", color: "#f4f1e8", accent: "#d9432f" },
  { key: "grue", name: "Grue cendrée", zone: null, kind: "visiteur", tier: "visiteur", shape: "fleur", color: "#9aa6a0", accent: "#d9432f" },
  { key: "hirondelles", name: "Hirondelles", zone: null, kind: "visiteur", tier: "visiteur", shape: "fleur", color: "#2a3a5e", accent: "#c8643a" },
  { key: "oies", name: "Oies cendrées", zone: null, kind: "visiteur", tier: "visiteur", shape: "fleur", color: "#8a8a7a", accent: "#e8a33a" },
];

export const ITEM_BY_KEY: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.key, i]));

export const TIER_LABEL: Record<Tier, string> = {
  commune: "Commune",
  signature: "Signature",
  rare: "Graine rare",
  speciale: "Plante spéciale",
  fleurie: "Variante",
  remarquable: "Arbre remarquable",
  amitie: "Cadeau",
  visiteur: "Migrateur",
};

/** Les graines de la famille d'une zone gagnées par des actions (même calcul que island_zone_seeds). */
export function zoneSeeds(counts: Record<string, number>, zone: Zone): number {
  const n = (k: string) => Number(counts[k] ?? 0);
  if (zone === "foret") return n("transport") + n("nature");
  if (zone === "potager") return n("alimentation");
  if (zone === "plage") return n("consommation");
  return n("logement");
}

/** La zone d'un thème de défi (catégorie du modèle). */
export function categoryZone(category: string): Zone {
  if (category === "alimentation") return "potager";
  if (category === "consommation") return "plage";
  if (category === "logement") return "ruisseau";
  return "foret";
}

const BY_ZONE: Record<Zone, { rare: string; speciale: string; fleurie: string; remarquable: string }> = {
  foret: { rare: "muguet", speciale: "merisier", fleurie: "merisier_fleurs", remarquable: "hetre" },
  potager: { rare: "capucine", speciale: "figuier", fleurie: "figuier_fruits", remarquable: "chataignier" },
  plage: { rare: "lys_sable", speciale: "tamaris", fleurie: "tamaris_fleurs", remarquable: "chene_liege" },
  ruisseau: { rare: "salicaire", speciale: "saule_marsault", fleurie: "saule_chatons", remarquable: "platane" },
};

/** Un défi est costaud s'il est expert ou demande au moins 4 fois par semaine. */
export function isDemanding(days: number, target: number, level?: string): boolean {
  return level === "expert" || target * 7 >= 4 * Math.max(days, 1);
}

/**
 * Ce que rapporte un défi réussi (même règle que island_challenge_reward) : le thème choisit la zone,
 * la durée la rareté (7 jours, 30 jours, 90 jours), la difficulté la variante.
 */
export function challengeReward(category: string, days: number, target: number, level?: string): string[] {
  const z = BY_ZONE[categoryZone(category)];
  const costaud = isDemanding(days, target, level);
  if (days <= 13) return costaud ? [z.rare, z.rare] : [z.rare];
  if (days <= 59) return [costaud ? z.fleurie : z.speciale];
  return costaud ? [z.remarquable, z.fleurie] : [z.remarquable];
}

/** « 2 × Muguet », « Merisier en fleurs + Hêtre remarquable »… */
export function rewardLabel(items: string[]): string {
  const counts = new Map<string, number>();
  for (const k of items) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts]
    .map(([k, n]) => `${n > 1 ? `${n} × ` : ""}${ITEM_BY_KEY[k]?.name ?? k}`)
    .join(" + ");
}

/** Les plantes d'une zone débloquées par les actions de sa famille (communes, puis signature). */
export function shopOf(zone: Zone): Item[] {
  return ITEMS.filter((i) => i.zone === zone && (i.kind === "boutique" || i.kind === "signature"));
}

/** Les plantes d'une zone qu'on ne gagne qu'en défi, de la plus courante à la plus rare. */
export function challengeItemsOf(zone: Zone): Item[] {
  const order: Tier[] = ["rare", "speciale", "fleurie", "remarquable"];
  return ITEMS.filter((i) => i.zone === zone && i.kind === "defi").sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier));
}

/** Le migrateur de la semaine (même rotation que island_migration) : semaine du lundi donné. */
export const MIGRATORS = ["cigogne", "grue", "hirondelles", "oies"] as const;
