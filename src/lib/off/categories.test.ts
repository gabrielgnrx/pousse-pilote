import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateCategory, median, FOOD_CATEGORIES, MIN_SAMPLE } from "./categories.ts";
import type { Grade, Product } from "./product.ts";

const p = (code: string, grade: Grade | null, co2: number | null, brand = code): Product => ({
  code, name: code, brand, image: null, quantity: null, grams: null, grade, gradeStatus: grade ? "known" : "unknown",
  score: null, co2PerKg: co2, agribalyseName: null, categories: [],
});

test("médiane : nombre pair ou impair, liste vide", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), null);
});

test("estimation par catégorie : médiane Agribalyse, note typique, alternatives mieux notées", () => {
  const products = [p("1", "c", 2), p("2", "c", 3), p("3", "c", 4), p("4", "b", 1.5), p("5", "a", 1), p("6", "a", 1.2, "5"), p("7", "d", 6)];
  const e = estimateCategory(products);
  assert.equal(e.co2PerKg, 2);
  assert.equal(e.typicalGrade, "c");
  assert.equal(e.sample, 7);
  assert.deepEqual(e.alternatives.map((x) => x.code), ["5", "4"]);
});

test("pas assez de données : pas d'estimation chiffrée (on ne devine pas)", () => {
  const e = estimateCategory([p("1", "b", 2), p("2", "c", 3)]);
  assert.equal(e.co2PerKg, null);
  assert.ok(e.sample < MIN_SAMPLE);
});

test("catégories : une liste fermée, sans doublon", () => {
  const tags = FOOD_CATEGORIES.map((c) => c.tag);
  assert.equal(new Set(tags).size, tags.length);
  assert.ok(tags.every((t) => t.startsWith("en:")));
});
