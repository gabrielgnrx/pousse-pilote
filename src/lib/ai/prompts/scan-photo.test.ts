import { test } from "node:test";
import assert from "node:assert/strict";
import { pickCategory, scanPhotoSchema, scanPhotoTask } from "./scan-photo.ts";

test("scanner par photo : catégorie retenue seulement si l'IA est nettement sûre", () => {
  assert.deepEqual(pickCategory({ candidates: [{ category: "en:yogurts", confidence: 0.9 }] }), { sure: "en:yogurts", choices: ["en:yogurts"] });
  const unsure = pickCategory({ candidates: [{ category: "en:yogurts", confidence: 0.5 }, { category: "en:cheeses", confidence: 0.3 }] });
  assert.equal(unsure.sure, null);
  assert.deepEqual(unsure.choices, ["en:yogurts", "en:cheeses"]);
  assert.deepEqual(pickCategory({ candidates: [{ category: "inconnu", confidence: 0.95 }] }), { sure: null, choices: [] });
});

test("scanner par photo : la sortie est limitée à la liste fermée, sans chiffre", () => {
  assert.equal(scanPhotoSchema.safeParse({ candidates: [{ category: "en:caviar", confidence: 0.9 }] }).success, false);
  const r = scanPhotoSchema.safeParse({ candidates: [{ category: "en:yogurts", confidence: 0.9, co2: 2.1 }] });
  assert.ok(r.success && !("co2" in r.data.candidates[0]));
  assert.ok(scanPhotoSchema.safeParse(scanPhotoTask.mock!({ image: { mediaType: "image/jpeg", base64: "" } })).success);
});
