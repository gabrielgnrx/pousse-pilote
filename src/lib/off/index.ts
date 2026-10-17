import { parseProduct, pickAlternatives, searchCategories, type Product } from "./product.ts";

export * from "./product.ts";

const BASE = "https://world.openfoodfacts.org";
const FIELDS = [
  "code",
  "product_name",
  "product_name_fr",
  "generic_name_fr",
  "brands",
  "image_front_small_url",
  "image_front_url",
  "quantity",
  "product_quantity",
  "categories_tags",
  "categories_hierarchy",
  "ecoscore_grade",
  "ecoscore_score",
  "ecoscore_data",
  "environmental_score_grade",
  "environmental_score_score",
  "environmental_score_data",
].join(",");

// Open Food Facts demande d'identifier l'application (nom, version, contact).
const HEADERS = {
  "User-Agent": `Pousse/0.1 (${process.env.OFF_CONTACT ?? "pilote Pousse"})`,
  Accept: "application/json",
};
const DAY = 24 * 60 * 60;

/** Fiche d'un produit par son code-barres ; null s'il est inconnu ou si le service ne répond pas. */
export async function getProduct(code: string): Promise<Product | null> {
  try {
    const res = await fetch(`${BASE}/api/v2/product/${code}.json?fields=${FIELDS}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8000),
      next: { revalidate: DAY },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { status?: number; product?: Record<string, unknown> };
    return json.status === 1 ? parseProduct({ code, ...json.product }) : null;
  } catch {
    return null;
  }
}

export interface Alternatives {
  products: Product[];
  /** false si Open Food Facts n'a pas pu répondre (service saturé ou limite de requêtes). */
  available: boolean;
}

// Après un refus d'Open Food Facts, on ne réessaie pas pendant 5 minutes (respect de leurs limites).
let pausedUntil = 0;

/**
 * Jusqu'à 3 alternatives mieux notées, vendues en France : d'abord dans la catégorie la plus précise
 * (fromages blancs nature), puis dans la catégorie parente pour compléter (desserts lactés fermentés).
 * Deux recherches au plus, mises en cache une journée.
 */
export async function getAlternatives(p: Product): Promise<Alternatives> {
  const picked: Product[] = [];
  let answered = false;
  for (const category of searchCategories(p)) {
    if (Date.now() < pausedUntil) break;
    try {
      const url =
        `${BASE}/api/v2/search?categories_tags=${encodeURIComponent(category)}` +
        `&countries_tags=en:france&sort_by=ecoscore_score&page_size=40&fields=${FIELDS}`;
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000), next: { revalidate: DAY } });
      if (!res.ok) {
        if (res.status === 429 || res.status === 503) pausedUntil = Date.now() + 5 * 60_000;
        continue;
      }
      answered = true;
      const json = (await res.json()) as { products?: Record<string, unknown>[] };
      const candidates = (json.products ?? [])
        .map((raw) => parseProduct(raw))
        .filter((c): c is Product => c !== null && !picked.some((x) => x.code === c.code || (x.brand && x.brand === c.brand)));
      picked.push(...pickAlternatives(p, candidates, 3 - picked.length));
      if (picked.length >= 3) break;
    } catch {
      /* service indisponible : on garde ce qu'on a */
    }
  }
  return { products: picked, available: answered || picked.length > 0 };
}
