import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ITEMS, ITEM_BY_KEY, challengeReward, rewardLabel, shopOf, zoneSeeds } from "./catalog.ts";
import { lookOf, plantLocally, seedsOf, guestsOf, tileFits, uprootLocally, type IslandData } from "./island.ts";
import { HABITATS, animalsOn, habitatProgress, newcomers } from "./ecosystem.ts";

test("catalogue : mêmes plantes, zones et seuils que la table island_catalog (0050, puis 0051)", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/0050_ile_graineterie.sql", import.meta.url), "utf8");
  const serre = readFileSync(new URL("../../../supabase/migrations/0051_ile_serre.sql", import.meta.url), "utf8");
  const unlocks = Object.fromEntries([...serre.matchAll(/when '([a-z_]+)' then (\d+)/g)].map((m) => [m[1], Number(m[2])]));
  const rows = [...sql.matchAll(/\('([a-z_]+)', (null|'[a-z]+'), '([a-z]+)', '([a-z]+)', (null|\d+), (null|\d+)\)/g)].map((m) => ({
    key: m[1],
    zone: m[2] === "null" ? null : m[2].slice(1, -1),
    kind: m[3],
    tier: m[4],
    unlock: unlocks[m[1]!] ?? (m[6] === "null" ? undefined : Number(m[6])),
  }));
  assert.equal(rows.length, ITEMS.length);
  for (const r of rows) {
    const i = ITEM_BY_KEY[r.key];
    assert.ok(i, r.key);
    assert.deepEqual([i.zone, i.kind, i.tier, i.unlock], [r.zone, r.kind, r.tier, r.unlock], r.key);
  }
});

test("défis : le thème choisit la zone, la durée la rareté, la difficulté la variante (comme island_challenge_reward)", () => {
  assert.deepEqual(challengeReward("transport", 7, 3), ["muguet"]);
  assert.deepEqual(challengeReward("transport", 7, 5), ["muguet", "muguet"]);
  assert.deepEqual(challengeReward("alimentation", 30, 10), ["figuier"]);
  assert.deepEqual(challengeReward("alimentation", 30, 18), ["figuier_fruits"]);
  assert.deepEqual(challengeReward("consommation", 90, 3, "expert"), ["chene_liege", "tamaris_fleurs"]);
  assert.deepEqual(challengeReward("logement", 90, 10), ["platane"]);
  assert.deepEqual(challengeReward("quotidien", 7, 1), ["muguet"]);
  assert.equal(rewardLabel(["muguet", "muguet"]), "2 × Muguet");
  assert.equal(rewardLabel(["hetre", "merisier_fleurs"]), "Hêtre remarquable + Merisier en fleurs");
});

test("les communes puis la signature de chaque zone se débloquent par les actions de sa famille", () => {
  for (const zone of ["foret", "potager", "plage", "ruisseau"] as const) {
    const shop = shopOf(zone);
    assert.equal(shop.filter((i) => i.kind === "boutique").length, 2, zone);
    const signature = shop.find((i) => i.kind === "signature")!;
    assert.ok(shop.every((i) => i === signature || (i.unlock ?? 0) < (signature.unlock ?? 0)), `${zone} : la signature en dernier`);
  }
  assert.equal(zoneSeeds({ transport: 4, nature: 3, alimentation: 9 }, "foret"), 7);
  assert.equal(zoneSeeds({ logement: 2 }, "ruisseau"), 2);
});

const base: IslandData = {
  name: "Inès", counts: {}, exploits: {}, rares: [], plants: [], inventory: { noisetier: 2, cigogne: 1 },
  unlocked: ["noisetier", "merisier"], free: { merisier: 1 }, pousses: 50,
};

test("île : les espèces débloquées se plantent, les migrateurs non", () => {
  const seeds = seedsOf(base);
  assert.deepEqual(seeds.map((s) => [s.key, s.cost, s.free]), [["noisetier", 10, 0], ["merisier", 0, 1]]);
  assert.deepEqual(guestsOf(base), ["cigogne"]);
  assert.ok(tileFits("noisetier", -1, -1));
  assert.ok(!tileFits("noisetier", 1, 1));
  assert.ok(tileFits("myosotis", 1, 1));
});

test("île : une plante du catalogue se plante en graine et grandit comme les autres", () => {
  const one = plantLocally(base, { key: "merisier", rare: false, cost: 0 }, -1, -1);
  assert.equal(lookOf(one.plants[0]!)?.name, "Merisier");
  assert.equal(lookOf(one.plants[0]!)?.stage, 1);
  assert.equal(lookOf(one.plants[0]!)?.next, 30);
  assert.equal(uprootLocally(one, { x: -1, z: -1 }).free?.merisier, 1);
});

test("écosystème : le geai vient pour un merisier en fleurs entouré de noisetiers", () => {
  const p = (species: string, x: number, z: number) => ({ id: `${x}${z}`, species, rare: true, x, z, fed: 1, stage: 4, planted_at: "", grown_at: "" });
  const before = [p("merisier_fleurs", -1, -1), p("noisetier", -2, -1)];
  const after = [...before, p("noisetier", -1, -2)];
  assert.ok(!animalsOn(before).some((a) => a.animal.key === "geai"));
  assert.deepEqual(newcomers(before, after).map((a) => a.key), ["geai"]);
  const geai = habitatProgress(before, ["noisetier"]).find((h) => h.animal.key === "geai");
  assert.deepEqual(geai?.needs.map((n) => [n.item, n.have, n.need, n.unlocked]), [["merisier_fleurs", 1, 1, false], ["noisetier", 1, 2, true]]);
});

test("écosystème : les migrateurs arrivent par l'équipe, sans plante", () => {
  assert.ok(animalsOn([], ["cigogne"]).some((a) => a.animal.key === "cigogne"));
  assert.ok(!animalsOn([]).some((a) => a.animal.key === "cigogne"));
  for (const h of HABITATS) for (const [item] of h.needs) assert.ok(ITEM_BY_KEY[item], item);
});
