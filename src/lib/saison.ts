/**
 * Fruits et légumes de saison (Impact CO₂, ADEME, relevé le 20/10/2026) :
 * kg de CO₂e par kg de produit, et mois où il est de saison en France (1 = janvier).
 * Hors saison, beaucoup viennent de serres chauffées ou de loin, et pèsent plus lourd.
 */
export interface Produce {
  name: string;
  kg: number;
  months: number[];
  kind: "fruit" | "legume";
}

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const L = (name: string, kg: number, months: number[]): Produce => ({ name, kg, months, kind: "legume" });
const F = (name: string, kg: number, months: number[]): Produce => ({ name, kg, months, kind: "fruit" });

export const PRODUCE: Produce[] = [
  L("Ail", 0.383, [7, 8, 9, 10, 11, 12]),
  L("Artichaut", 2.556, [5, 6, 7, 8, 9]),
  L("Asperge", 1.639, [4, 5, 6]),
  L("Aubergine", 0.472, [6, 7, 8, 9]),
  L("Betterave", 0.407, [1, 2, 3, 10, 11, 12]),
  L("Blette", 0.581, [6, 7, 8, 9, 10, 11]),
  L("Brocoli", 0.951, [9, 10, 11]),
  L("Carotte", 0.396, [1, 2, 3, 9, 10, 11, 12]),
  L("Céleri", 0.716, [1, 2, 3, 10, 11, 12]),
  L("Chou", 0.848, [1, 2, 3, 10, 11, 12]),
  L("Chou de Bruxelles", 0.562, [1, 2, 3, 10, 11, 12]),
  L("Chou-fleur", 0.721, [1, 2, 3, 9, 10, 11, 12]),
  L("Concombre", 0.512, [5, 6, 7, 8, 9, 10]),
  L("Courge", 0.638, [1, 9, 10, 11, 12]),
  L("Courgette", 0.499, [5, 6, 7, 8, 9, 10]),
  L("Échalote", 0.394, [10, 11, 12]),
  L("Endive", 0.861, [1, 2, 3, 4, 5, 10]),
  L("Épinard", 0.423, [1, 2, 3, 4, 5, 9, 10, 11, 12]),
  L("Fenouil", 1.018, [4, 6, 7, 8, 9, 10, 11]),
  L("Haricot vert", 0.446, [6, 7, 8, 9, 10]),
  L("Laitue", 0.868, [5, 6, 7, 8, 9]),
  L("Mâche", 0.868, [1, 2, 10, 11, 12]),
  L("Maïs", 0.569, [7, 8, 9]),
  L("Navet", 0.396, [1, 2, 3, 4, 5, 10, 11, 12]),
  L("Oignon", 0.42, [1, 2, 3, 4, 9, 10, 11, 12]),
  L("Panais", 0.494, [1, 2, 3, 10, 11, 12]),
  L("Petit pois", 0.702, [5, 6, 7]),
  L("Poireau", 0.611, [1, 2, 3, 4, 9, 10, 11, 12]),
  L("Poivron", 0.715, [6, 7, 8, 9]),
  L("Potiron", 0.638, [1, 9, 10, 11, 12]),
  L("Radis", 0.385, [3, 4, 5, 6]),
  L("Salsifis", 0.494, [1, 2, 3, 11, 12]),
  L("Tomate", 0.626, [6, 7, 8, 9]),
  L("Topinambour", 0.491, [1, 2, 11, 12]),
  F("Abricot", 1.452, [6, 7, 8]),
  F("Cassis", 1.904, [6, 7, 8]),
  F("Cerise", 1.745, [6, 7]),
  F("Châtaigne", 1.944, [10, 11]),
  F("Citron", 0.764, [1, 2]),
  F("Clémentine", 1.302, [1, 2, 11, 12]),
  F("Coing", 0.562, [10]),
  F("Figue", 0.612, [7, 8, 9, 10]),
  F("Fraise", 0.511, [5, 6, 7]),
  F("Framboise", 1.543, [6, 7, 8]),
  F("Grenade", 0.499, [1, 2, 11, 12]),
  F("Groseille", 1.895, [6, 7, 8]),
  F("Kaki", 0.95, [1, 10, 11, 12]),
  F("Kiwi", 1.002, [1, 2, 3, 11, 12]),
  F("Mandarine", 0.468, [1, 2, 11, 12]),
  F("Melon", 0.978, [6, 7, 8, 9]),
  F("Myrtille", 0.922, [7, 8, 9]),
  F("Noisette", 4.811, [9, 10, 11]),
  F("Noix", 4.114, [9, 10]),
  F("Orange", 0.678, [1, 2, 3]),
  F("Pamplemousse", 0.926, [2, 3, 4, 5, 6]),
  F("Pastèque", 0.681, [6, 7, 8, 9]),
  F("Pêche", 0.591, [6, 7, 8, 9]),
  F("Poire", 0.387, [1, 2, 3, 8, 9, 10, 11, 12]),
  F("Pomme", 0.408, [1, 2, 3, 4, 8, 9, 10, 11, 12]),
  F("Prune", 1.035, [7, 8, 9]),
  F("Raisin", 0.509, [9, 10]),
  F("Rhubarbe", 0.702, [4, 5, 6]),
];

/** Toute l'année : importés. La mangue montre l'écart entre l'avion et le bateau. */
export const IMPORTED: Produce[] = [
  F("Banane", 0.909, ALL),
  F("Ananas", 1.361, ALL),
  F("Avocat", 1.553, ALL),
  F("Mangue (bateau)", 0.728, ALL),
  F("Mangue (avion)", 11.656, ALL),
];

export const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function inSeason(month: number) {
  const list = PRODUCE.filter((p) => p.months.includes(month));
  return {
    legumes: list.filter((p) => p.kind === "legume").sort((a, b) => a.name.localeCompare(b.name, "fr")),
    fruits: list.filter((p) => p.kind === "fruit").sort((a, b) => a.name.localeCompare(b.name, "fr")),
    /** Ce qui arrive le mois prochain. */
    next: PRODUCE.filter((p) => !p.months.includes(month) && p.months.includes((month % 12) + 1)),
  };
}
