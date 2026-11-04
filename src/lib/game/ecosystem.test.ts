import { test } from "node:test";
import assert from "node:assert/strict";
import { ISLAND_TILES, ZONE_BOUNDS, bestTile, checkTile, tileAngle, zoneOfTile } from "./island.ts";
import { animalsOn, newcomers, zoneStates } from "./ecosystem.ts";

const p = (species: string, x: number, z: number, stage = 1, rare = false) => ({ id: `${species}${x}${z}`, species, rare, x, z, fed: 1, stage, planted_at: "", grown_at: "" });

test("zones : 9 cases chacune, la case centrale à part, toutes loin d'une frontière", () => {
  const count: Record<string, number> = {};
  for (const t of ISLAND_TILES) {
    const z = zoneOfTile(t.x, t.z) ?? "centre";
    count[z] = (count[z] ?? 0) + 1;
    if (t.x || t.z) for (const b of ZONE_BOUNDS) assert.ok(Math.abs(tileAngle(t.x, t.z) - b) > 8, `${t.x},${t.z} trop près de ${b}°`);
  }
  assert.deepEqual(count, { foret: 9, ruisseau: 9, plage: 9, potager: 9, centre: 1 });
});

test("zones : une graine se plante dans sa zone (ou au centre), les fleurs partout", () => {
  assert.equal(checkTile([], { key: "transport", rare: false }, -1, -1), "nouvelle");
  assert.equal(checkTile([], { key: "transport", rare: false }, 1, 1), "hors_zone");
  assert.equal(checkTile([], { key: "transport", rare: false }, 0, 0), "nouvelle");
  assert.equal(checkTile([], { key: "scan", rare: false }, 1, 1), "nouvelle");
  // « Planter pour moi » vise sa zone avant la case centrale.
  const t = bestTile([], { key: "alimentation", rare: false })!;
  assert.equal(zoneOfTile(t.x, t.z), "potager");
});

test("santé des zones : les stades des plantes de la zone, posées dans la zone", () => {
  const states = zoneStates([p("transport", -1, -1, 4), p("noisetier", -2, -1, 4, true), p("transport", 0, 0, 4), p("scan", -1, -2, 4)]);
  const foret = states.find((s) => s.key === "foret")!;
  assert.equal(foret.fed, 8, "bouleau et noisetier adultes ; ni la case centrale ni les fleurs");
  assert.equal(foret.health, 0.5);
});

test("animaux : abeilles, haie, hérisson, et départ si on arrache", () => {
  const flowers = [p("quiz", 1, 1, 2), p("scan", 2, 1, 2), p("bravo", 1, 2, 2)];
  assert.deepEqual(animalsOn(flowers).map((a) => a.animal.key), ["abeilles"]);
  const hedge = [p("transport", -1, -1, 2), p("transport", 0, -1, 2), p("nature", 1, -1, 2)];
  assert.ok(animalsOn(hedge).some((a) => a.animal.key === "oiseaux"));
  const garden = [p("alimentation", -1, 1, 1), p("consommation", 0, 1, 1)];
  assert.ok(animalsOn(garden).some((a) => a.animal.key === "herisson"));
  assert.deepEqual(newcomers(flowers.slice(0, 2), flowers).map((a) => a.key), ["abeilles"]);
  assert.deepEqual(newcomers(flowers, flowers.slice(0, 2)), []);
});

test("animaux : une zone restaurée fait revenir son habitant", () => {
  const foret = [p("transport", -1, -1, 4), p("transport", -2, -1, 4), p("noisetier", -1, -2, 4, true), p("erable", -2, -2, 4, true)];
  const keys = animalsOn(foret).map((a) => a.animal.key);
  assert.ok(keys.includes("chouette"));
  assert.ok(keys.includes("ecureuil"));
});
