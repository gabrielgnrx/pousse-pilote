import { test } from "node:test";
import assert from "node:assert/strict";
import { ISLAND_TILES, bestTile, checkTile, lookOf, plantLocally, seedsOf, tileOk, type IslandData } from "./island.ts";

const base: IslandData = {
  name: "Inès",
  counts: { transport: 2, alimentation: 1 },
  exploits: { duel: true },
  rares: ["lotus"],
  plants: [],
};

test("île : 37 emplacements, même règle que island_tile_ok()", () => {
  assert.equal(ISLAND_TILES.length, 37);
  assert.ok(tileOk(3, 1));
  assert.ok(!tileOk(3, 2));
  assert.ok(!tileOk(0.5, 0));
});

test("île : graines = actions moins graines plantées, puis les rares obtenues", () => {
  const seeds = seedsOf({ ...base, plants: [{ id: "a", species: "transport", rare: false, x: 0, z: 0, fed: 2, planted_at: "", grown_at: "" }] });
  assert.deepEqual(seeds.map((s) => [s.key, s.available]), [["alimentation", 1], ["rosier", 1], ["lotus", 1]]);
});

test("île : une graine pousse sur une plante de la même espèce, jamais sur une autre", () => {
  const one = plantLocally(base, { key: "transport", rare: false }, 0, 0);
  assert.equal(checkTile(one.plants, { key: "transport", rare: false }, 0, 0), "grandit");
  assert.equal(checkTile(one.plants, { key: "alimentation", rare: false }, 0, 0), "occupe");
  assert.equal(checkTile(one.plants, { key: "lotus", rare: true }, 0, 0), "occupe");
  assert.equal(checkTile(one.plants, { key: "transport", rare: false }, 3, 3), "hors_ile");
  const two = plantLocally(one, { key: "transport", rare: false }, 0, 0);
  assert.equal(two.plants.length, 1);
  assert.equal(two.plants[0]!.fed, 2);
});

test("île : stades du jardin (1, 5, 15, 40) ; une rare est adulte", () => {
  assert.equal(lookOf({ species: "transport", rare: false, fed: 4 })!.stage, 1);
  assert.equal(lookOf({ species: "transport", rare: false, fed: 15 })!.stage, 3);
  assert.equal(lookOf({ species: "lotus", rare: true, fed: 1 })!.stage, 4);
  assert.equal(lookOf({ species: "inconnue", rare: false, fed: 1 }), null);
});

test("île : « planter pour moi » fait grandir la plus petite plante, sinon part du centre", () => {
  const p = (species: string, x: number, z: number, fed: number) => ({ id: `${x}${z}`, species, rare: false, x, z, fed, planted_at: "", grown_at: "" });
  assert.deepEqual(bestTile([], { key: "transport", rare: false }), { x: 0, z: 0 });
  assert.deepEqual(bestTile([p("transport", 0, 0, 6), p("transport", 1, 0, 2)], { key: "transport", rare: false }), { x: 1, z: 0 });
  assert.deepEqual(bestTile([p("transport", 0, 0, 40)], { key: "transport", rare: false }), { x: -1, z: 0 });
  assert.deepEqual(bestTile([p("transport", 0, 0, 2)], { key: "lotus", rare: true }), { x: -1, z: 0 });
});
