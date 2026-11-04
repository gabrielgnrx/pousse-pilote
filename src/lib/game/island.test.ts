import { test } from "node:test";
import assert from "node:assert/strict";
import { ISLAND_TILES, bestTile, checkTile, growLocally, lookOf, moveLocally, plantLocally, playableTiles, seedsOf, tileOk, uprootLocally, type IslandData } from "./island.ts";

const base: IslandData = {
  name: "Inès",
  counts: { transport: 2, alimentation: 1 },
  exploits: { duel: true },
  rares: ["lotus"],
  plants: [],
  unlocked: ["transport", "alimentation", "consommation", "logement", "noisetier", "merisier"],
  free: { merisier: 1 },
  pousses: 100,
};

test("île : 37 emplacements, même règle que island_tile_ok()", () => {
  assert.equal(ISLAND_TILES.length, 37);
  assert.ok(tileOk(3, 1));
  assert.ok(!tileOk(3, 2));
  assert.ok(!tileOk(0.5, 0));
});

test("île : on plante les espèces débloquées (10 pousses, ou offert), puis les rares obtenues", () => {
  const seeds = seedsOf(base);
  assert.deepEqual(seeds.map((s) => [s.key, s.cost]), [
    ["transport", 10], ["alimentation", 10], ["consommation", 10], ["logement", 10], ["noisetier", 10], ["merisier", 0], ["rosier", 0], ["lotus", 0],
  ]);
});

test("île : une case prise reste prise ; planter coûte 10 pousses, l'offert rien", () => {
  const one = plantLocally(base, { key: "transport", rare: false, cost: 10 }, 0, 0);
  assert.equal(one.pousses, 90);
  assert.equal(checkTile(one.plants, { key: "transport" }, 0, 0), "occupe");
  assert.equal(checkTile(one.plants, { key: "transport" }, 3, 3), "hors_ile");
  assert.equal(plantLocally(one, { key: "transport", rare: false, cost: 10 }, 0, 0), one);
  const gift = plantLocally(one, { key: "merisier", rare: false, cost: 0 }, -1, -1);
  assert.equal(gift.pousses, 90);
  assert.equal(gift.free?.merisier, 0);
  assert.equal(seedsOf(gift).find((s) => s.key === "merisier")?.cost, 10, "le suivant coûte 10");
});

test("île : grandir coûte 30, 60 puis 100 pousses ; adulte, plus rien", () => {
  let d: IslandData | null = { ...base, pousses: 200, plants: [{ id: "a", species: "transport", rare: false, x: 0, z: 0, fed: 1, stage: 1, spent: 10, planted_at: "", grown_at: "" }] };
  for (const [stage, left] of [[2, 170], [3, 110], [4, 10]] as const) {
    d = growLocally(d!, { x: 0, z: 0 });
    assert.equal(d?.plants[0]!.stage, stage);
    assert.equal(d?.pousses, left);
  }
  assert.equal(growLocally(d!, { x: 0, z: 0 }), null, "adulte");
  assert.equal(growLocally({ ...base, pousses: 20, plants: [{ id: "b", species: "transport", rare: false, x: 0, z: 0, fed: 1, stage: 1, planted_at: "", grown_at: "" }] }, { x: 0, z: 0 }), null, "pas assez");
  assert.equal(d?.plants[0]!.spent, 200);
});

test("île : stades d'avant (graines 1, 5, 15, 40) ; une rare est adulte", () => {
  assert.equal(lookOf({ species: "transport", rare: false, fed: 4 })!.stage, 1);
  assert.equal(lookOf({ species: "transport", rare: false, fed: 15 })!.stage, 3);
  assert.equal(lookOf({ species: "transport", rare: false, fed: 1, stage: 2 })!.next, 60);
  assert.equal(lookOf({ species: "lotus", rare: true, fed: 1 })!.stage, 4);
  assert.equal(lookOf({ species: "inconnue", rare: false, fed: 1 }), null);
});

test("île : « planter pour moi » vise une case libre de sa zone, au plus près du centre", () => {
  const p = (species: string, x: number, z: number) => ({ id: `${x}${z}`, species, rare: false, x, z, fed: 1, stage: 1, planted_at: "", grown_at: "" });
  assert.deepEqual(bestTile([], { key: "transport" }), { x: -1, z: 0 });
  assert.deepEqual(bestTile([], { key: "lotus" }), { x: 0, z: 0 });
  assert.deepEqual(bestTile([p("transport", -1, 0)], { key: "transport" }), { x: -1, z: -1 });
});

test("île : déplacer vers une case libre, arracher rend les pousses et l'offert", () => {
  const one = plantLocally(base, { key: "transport", rare: false, cost: 10 }, 0, 0);
  const grown = growLocally(one, { x: 0, z: 0 })!;
  assert.equal(grown.pousses, 60);
  const moved = moveLocally(grown, { x: 0, z: 0 }, { x: -1, z: -1 });
  assert.deepEqual([moved.plants[0]!.x, moved.plants[0]!.z, moved.plants[0]!.stage], [-1, -1, 2]);
  assert.equal(moveLocally(moved, { x: -1, z: -1 }, { x: 3, z: 3 }), moved, "hors de l'île : rien ne bouge");
  assert.equal(moveLocally(moved, { x: -1, z: -1 }, { x: 1, z: 1 }), moved, "un bouleau ne va pas sur la plage");
  const gone = uprootLocally(moved, { x: -1, z: -1 });
  assert.equal(gone.plants.length, 0);
  assert.equal(gone.pousses, 100);
  const gift = uprootLocally(plantLocally(base, { key: "merisier", rare: false, cost: 0 }, -1, -1), { x: -1, z: -1 });
  assert.equal(gift.free?.merisier, 1);
});

test("île : cases jouables, et île pleine", () => {
  assert.equal(playableTiles([], { key: "transport" }), 10, "les 9 cases de la forêt et la case centrale");
  assert.equal(playableTiles([], { key: "scan" }), 37);
  const full = ISLAND_TILES.map((t, i) => ({ id: String(i), species: "alimentation", rare: false, x: t.x, z: t.z, fed: 1, planted_at: "", grown_at: "" }));
  assert.equal(playableTiles(full, { key: "transport" }), 0);
});
