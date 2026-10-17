/**
 * Lecture des fiches Open Food Facts (licence ODbL, à citer) : Green-Score et empreinte carbone
 * Agribalyse. Fonctions pures, testées dans off.test.ts.
 */

export type Grade = "a-plus" | "a" | "b" | "c" | "d" | "e" | "f";

export interface Product {
  code: string;
  name: string;
  brand: string | null;
  image: string | null;
  quantity: string | null;
  /** Poids ou volume net en grammes (ou ml), si connu. */
  grams: number | null;
  /** Green-Score (ex-Eco-Score) ; null si le produit n'est pas encore noté. */
  grade: Grade | null;
  /** « not-applicable » : catégorie que le Green-Score ne note pas (eaux, sodas, alcools…). */
  gradeStatus: "known" | "unknown" | "not-applicable";
  score: number | null;
  /** Empreinte carbone en kg CO₂e par kg de produit (Agribalyse), si connue. */
  co2PerKg: number | null;
  /** Aliment Agribalyse de référence, pour expliquer le chiffre. */
  agribalyseName: string | null;
  /** Catégories, de la plus générale à la plus précise. */
  categories: string[];
}

const GRADES: Grade[] = ["a-plus", "a", "b", "c", "d", "e", "f"];

export const GRADE_LABEL: Record<Grade, string> = {
  "a-plus": "A+",
  a: "A",
  b: "B",
  c: "C",
  d: "D",
  e: "E",
  f: "F",
};

/** Rang du Green-Score : plus c'est haut, mieux c'est (A+ = 7, F = 1, inconnu = 0). */
export function gradeRank(g: Grade | null): number {
  return g ? GRADES.length - GRADES.indexOf(g) : 0;
}

export function normalizeGrade(raw: unknown): Grade | null {
  if (typeof raw !== "string") return null;
  const g = raw.toLowerCase().replace("+", "-plus").replace("_", "-");
  return (GRADES as string[]).includes(g) ? (g as Grade) : null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) ? n : null;
};

/** Convertit une fiche brute de l'API (v2) en Product ; null si elle est inutilisable. */
export function parseProduct(raw: Record<string, unknown> | null | undefined): Product | null {
  if (!raw || typeof raw.code !== "string") return null;
  const envData = (raw.environmental_score_data ?? raw.ecoscore_data) as Record<string, unknown> | undefined;
  const agri = (envData?.agribalyse ?? {}) as Record<string, unknown>;
  const name =
    [raw.product_name_fr, raw.product_name, raw.generic_name_fr].find((v) => typeof v === "string" && v.trim()) ??
    "Produit sans nom";
  const co2 = num(agri.co2_total);
  const grams = num(raw.product_quantity);
  const categories = Array.isArray(raw.categories_hierarchy)
    ? (raw.categories_hierarchy as unknown[]).filter((c): c is string => typeof c === "string")
    : Array.isArray(raw.categories_tags)
      ? (raw.categories_tags as unknown[]).filter((c): c is string => typeof c === "string")
      : [];
  const image = [raw.image_front_small_url, raw.image_front_url, raw.image_small_url].find(
    (v) => typeof v === "string" && v.startsWith("https://"),
  ) as string | undefined;

  return {
    code: raw.code,
    name: String(name).trim(),
    brand: typeof raw.brands === "string" && raw.brands.trim() ? raw.brands.split(",")[0].trim() : null,
    image: image ?? null,
    quantity: typeof raw.quantity === "string" && raw.quantity.trim() ? raw.quantity.trim() : null,
    grams: grams && grams > 0 && grams < 100_000 ? grams : null,
    grade: normalizeGrade(raw.environmental_score_grade) ?? normalizeGrade(raw.ecoscore_grade),
    gradeStatus:
      (normalizeGrade(raw.environmental_score_grade) ?? normalizeGrade(raw.ecoscore_grade))
        ? "known"
        : [raw.environmental_score_grade, raw.ecoscore_grade].includes("not-applicable")
          ? "not-applicable"
          : "unknown",
    score: num(raw.environmental_score_score) ?? num(raw.ecoscore_score),
    co2PerKg: co2 !== null && co2 >= 0 && co2 < 1000 ? co2 : null,
    agribalyseName: typeof agri.name_fr === "string" ? agri.name_fr : null,
    categories,
  };
}

/** Empreinte du paquet entier, si le poids est connu. */
export function packageCo2(p: Product): number | null {
  return p.co2PerKg !== null && p.grams !== null ? (p.co2PerKg * p.grams) / 1000 : null;
}

/**
 * Une alternative est meilleure si son Green-Score est meilleur, ou à score égal si elle émet au moins
 * 10 % de CO₂ en moins. Si le produit scanné n'est pas noté, seules les alternatives A+, A ou B comptent.
 */
export function isBetter(candidate: Product, original: Product): boolean {
  if (candidate.code === original.code || original.gradeStatus === "not-applicable") return false;
  const rc = gradeRank(candidate.grade);
  const ro = gradeRank(original.grade);
  if (ro === 0) return rc >= gradeRank("b");
  if (rc > ro) return true;
  if (rc === ro && candidate.co2PerKg !== null && original.co2PerKg !== null) {
    return candidate.co2PerKg < original.co2PerKg * 0.9;
  }
  return false;
}

/** Les meilleures alternatives : mieux notées, puis moins émettrices, une seule par marque. */
export function pickAlternatives(original: Product, candidates: Product[], limit = 3): Product[] {
  const seen = new Set<string>();
  return candidates
    .filter((c) => isBetter(c, original))
    .sort(
      (a, b) =>
        gradeRank(b.grade) - gradeRank(a.grade) ||
        (a.co2PerKg ?? Number.POSITIVE_INFINITY) - (b.co2PerKg ?? Number.POSITIVE_INFINITY) ||
        (b.score ?? 0) - (a.score ?? 0),
    )
    .filter((c) => {
      const key = (c.brand ?? c.name).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

/**
 * Catégories à essayer pour chercher des alternatives : la plus précise d'abord. Seules les catégories
 * de la taxonomie (en:mot-mot) servent : les étiquettes libres (« fr:Nutella ») ne trouvent rien d'utile.
 */
// Catégories de rangement ou de conservation : trop larges pour comparer des produits.
const NOT_A_SHELF = new Set([
  "en:fresh-foods",
  "en:refrigerated-foods",
  "en:frozen-foods",
  "en:fermented-foods",
  "en:canned-foods",
  "en:dried-products",
  "en:plant-based-foods",
  "en:plant-based-foods-and-beverages",
  "en:foods-of-animal-origin",
  "en:groceries",
  "en:snacks",
  "en:beverages",
]);

export function searchCategories(p: Product, max = 2): string[] {
  return p.categories
    .filter((c) => /^en:[a-z0-9-]+$/.test(c) && !NOT_A_SHELF.has(c))
    .reverse()
    .slice(0, max);
}

/** Codes-barres acceptés : EAN-8, UPC-A, EAN-13, GTIN-14. */
export function isBarcode(code: string): boolean {
  return /^\d{8}$|^\d{12,14}$/.test(code);
}
