/**
 * Scanner par photo : la liste fermée des catégories que l'IA peut reconnaître, chacune reliée à une
 * catégorie Open Food Facts. L'impact affiché est une estimation PAR CATÉGORIE : la médiane des
 * empreintes Agribalyse (kg CO₂e/kg) des produits de cette catégorie vendus en France, lues dans
 * Open Food Facts (ODbL). Aucune valeur n'est saisie ou inventée ici.
 */
import type { Grade, Product } from "./product.ts";
import { gradeRank } from "./product.ts";

export interface FoodCategory {
  tag: string;
  label: string;
}

export const FOOD_CATEGORIES: readonly FoodCategory[] = [
  { tag: "en:yogurts", label: "Yaourts" },
  { tag: "en:cheeses", label: "Fromages" },
  { tag: "en:milks", label: "Laits" },
  { tag: "en:butters", label: "Beurres" },
  { tag: "en:eggs", label: "Œufs" },
  { tag: "en:hams", label: "Jambons" },
  { tag: "en:sausages", label: "Saucisses" },
  { tag: "en:beef", label: "Bœuf" },
  { tag: "en:poultries", label: "Volailles" },
  { tag: "en:fishes", label: "Poissons" },
  { tag: "en:breads", label: "Pains" },
  { tag: "en:breakfast-cereals", label: "Céréales du petit-déjeuner" },
  { tag: "en:biscuits", label: "Biscuits" },
  { tag: "en:chocolates", label: "Chocolats" },
  { tag: "en:pastas", label: "Pâtes" },
  { tag: "en:rices", label: "Riz" },
  { tag: "en:pizzas", label: "Pizzas" },
  { tag: "en:meals", label: "Plats préparés" },
  { tag: "en:soups", label: "Soupes" },
  { tag: "en:canned-vegetables", label: "Légumes en conserve" },
  { tag: "en:fruit-juices", label: "Jus de fruits" },
  { tag: "en:sodas", label: "Sodas" },
  { tag: "en:waters", label: "Eaux" },
  { tag: "en:coffees", label: "Cafés" },
  { tag: "en:teas", label: "Thés" },
  { tag: "en:jams", label: "Confitures" },
  { tag: "en:ice-creams", label: "Glaces" },
  { tag: "en:plant-based-milk-alternatives", label: "Boissons végétales" },
  { tag: "en:crisps", label: "Chips" },
  { tag: "en:spreads", label: "Pâtes à tartiner" },
];

export const CATEGORY_BY_TAG: Readonly<Record<string, FoodCategory>> = Object.fromEntries(FOOD_CATEGORIES.map((c) => [c.tag, c]));

export interface CategoryEstimate {
  /** Médiane des kg CO₂e/kg (Agribalyse) des produits de la catégorie ; null si trop peu de données. */
  co2PerKg: number | null;
  /** Green-Score le plus fréquent dans la catégorie (indicatif). */
  typicalGrade: Grade | null;
  /** Nombre de produits sur lesquels repose l'estimation. */
  sample: number;
  /** 2 ou 3 produits de la catégorie mieux notés que la note typique, une marque chacun. */
  alternatives: Product[];
}

/** Au moins 5 produits avec une empreinte connue, sinon pas d'estimation (on ne devine pas). */
export const MIN_SAMPLE = 5;

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function estimateCategory(products: Product[]): CategoryEstimate {
  const withCo2 = products.map((p) => p.co2PerKg).filter((v): v is number => v !== null && v >= 0);
  const co2 = withCo2.length >= MIN_SAMPLE ? median(withCo2) : null;
  const counts = new Map<Grade, number>();
  for (const p of products) if (p.grade) counts.set(p.grade, (counts.get(p.grade) ?? 0) + 1);
  const typicalGrade = [...counts.entries()].sort((a, b) => b[1] - a[1] || gradeRank(b[0]) - gradeRank(a[0]))[0]?.[0] ?? null;
  const brands = new Set<string>();
  const alternatives = products
    .filter((p) => p.grade && gradeRank(p.grade) > gradeRank(typicalGrade))
    .sort((a, b) => gradeRank(b.grade) - gradeRank(a.grade) || (a.co2PerKg ?? Infinity) - (b.co2PerKg ?? Infinity))
    .filter((p) => {
      const key = (p.brand ?? p.code).toLowerCase();
      if (brands.has(key)) return false;
      brands.add(key);
      return true;
    })
    .slice(0, 3);
  return { co2PerKg: co2 === null ? null : Math.round(co2 * 100) / 100, typicalGrade, sample: withCo2.length, alternatives };
}
