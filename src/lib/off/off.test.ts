import { test } from "node:test";
import assert from "node:assert/strict";
import { gradeRank, isBarcode, isBetter, normalizeGrade, packageCo2, parseProduct, pickAlternatives, searchCategories } from "./product.ts";

const raw = (over: Record<string, unknown>) => ({
  code: "3000000000001",
  product_name_fr: "Yaourt à la fraise",
  brands: "Marque A, Groupe",
  product_quantity: 500,
  quantity: "4 x 125 g",
  categories_hierarchy: ["en:dairies", "en:fermented-milk-products", "en:yogurts", "en:fruit-yogurts"],
  image_front_small_url: "https://images.openfoodfacts.org/x.jpg",
  ecoscore_grade: "c",
  ecoscore_score: 45,
  ecoscore_data: { agribalyse: { co2_total: 1.8, name_fr: "Yaourt aux fruits" } },
  ...over,
});

test("lecture d'une fiche : nom, marque, Green-Score, CO₂ Agribalyse", () => {
  const p = parseProduct(raw({}))!;
  assert.equal(p.name, "Yaourt à la fraise");
  assert.equal(p.brand, "Marque A");
  assert.equal(p.grade, "c");
  assert.equal(p.co2PerKg, 1.8);
  assert.equal(p.grams, 500);
  assert.equal(packageCo2(p), 0.9);
  assert.equal(p.agribalyseName, "Yaourt aux fruits");
});

test("le nouveau nom des champs (environmental_score) prime sur l'ancien", () => {
  const p = parseProduct(raw({ environmental_score_grade: "a-plus", environmental_score_data: { agribalyse: { co2_total: "0,9" } } }))!;
  assert.equal(p.grade, "a-plus");
  assert.equal(p.co2PerKg, 0.9);
});

test("notes inconnues ou non applicables ignorées", () => {
  assert.equal(normalizeGrade("unknown"), null);
  assert.equal(normalizeGrade("not-applicable"), null);
  assert.equal(normalizeGrade("A+"), "a-plus");
  assert.equal(parseProduct(raw({ ecoscore_grade: "unknown", ecoscore_data: {} }))!.grade, null);
  assert.ok(gradeRank("a-plus") > gradeRank("a") && gradeRank("a") > gradeRank("f") && gradeRank("f") > gradeRank(null));
});

test("alternatives : mieux notées, puis moins émettrices, une par marque", () => {
  const original = parseProduct(raw({}))!;
  const c = (code: string, grade: string, co2: number, brand: string) =>
    parseProduct(raw({ code, ecoscore_grade: grade, brands: brand, ecoscore_data: { agribalyse: { co2_total: co2 } } }))!;
  const candidates = [
    c("1", "d", 1.0, "D"), // moins bien noté
    c("2", "b", 1.5, "B"),
    c("3", "a", 1.7, "A1"),
    c("4", "a", 1.2, "A2"),
    c("5", "a", 1.1, "A2"), // même marque que 4 : une seule
    c("6", "c", 1.0, "C"), // même note, mais nettement moins de CO₂
    c("7", "c", 1.75, "C2"), // même note, CO₂ presque identique : non
  ];
  assert.deepEqual(pickAlternatives(original, candidates).map((p) => p.code), ["5", "3", "2"]);
  assert.ok(isBetter(candidates[5], original));
  assert.ok(!isBetter(candidates[6], original));
  assert.ok(!isBetter(original, original));
  // Produit scanné non noté : seules les alternatives A+, A ou B sont proposées.
  const unknown = parseProduct(raw({ ecoscore_grade: "unknown", ecoscore_data: { agribalyse: { warning: "missing_agribalyse_match" } } }))!;
  assert.equal(unknown.co2PerKg, null);
  assert.ok(isBetter(candidates[1], unknown));
  assert.ok(!isBetter(candidates[5], unknown));
  // Catégorie non notée par le Green-Score (soda, eau) : pas d'alternative proposée.
  const soda = parseProduct(raw({ ecoscore_grade: "not-applicable" }))!;
  assert.equal(soda.gradeStatus, "not-applicable");
  assert.ok(!isBetter(candidates[3], soda));
});

test("catégories de recherche et codes-barres", () => {
  assert.deepEqual(searchCategories(parseProduct(raw({}))!), ["en:fruit-yogurts", "en:yogurts"]);
  // Fiche réelle (Nutella) : étiquettes libres en fin de liste, ignorées.
  const nutella = parseProduct(raw({
    categories_hierarchy: ["en:breakfasts", "en:spreads", "en:sweet-spreads", "en:confectionary-based-spreads", "en:Pâtes à tartiner", "fr:Goûter", "fr:Nutella"],
  }))!;
  assert.deepEqual(searchCategories(nutella), ["en:confectionary-based-spreads", "en:sweet-spreads"]);
  // Fiche réelle (fromage blanc) : « refrigerated-foods » n'est pas un rayon.
  const fromageBlanc = parseProduct(raw({
    categories_hierarchy: ["en:dairies", "en:fermented-foods", "en:desserts", "en:fermented-milk-products", "en:cheeses", "en:dairy-desserts", "en:fermented-dairy-desserts", "en:fresh-foods", "en:refrigerated-foods", "en:plain-fermented-dairy-desserts"],
  }))!;
  assert.deepEqual(searchCategories(fromageBlanc), ["en:plain-fermented-dairy-desserts", "en:fermented-dairy-desserts"]);
  assert.ok(isBarcode("3017620422003"));
  assert.ok(isBarcode("12345678"));
  assert.ok(!isBarcode("12345"));
  assert.ok(!isBarcode("30176204220a3"));
});
