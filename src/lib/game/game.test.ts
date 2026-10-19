import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGarden, stageFor } from "./garden.ts";
import { DUEL_KINDS, duelKindForTemplate, GOAL_KINDS } from "./labels.ts";

test("stades du jardin : 1, 5, 15, 40 actions", () => {
  assert.deepEqual(stageFor(0), { stage: 0, next: 1 });
  assert.deepEqual(stageFor(1), { stage: 1, next: 5 });
  assert.deepEqual(stageFor(14), { stage: 2, next: 15 });
  assert.deepEqual(stageFor(40), { stage: 4, next: null });
});

test("jardin : espèces, exploits et plantes des graines", () => {
  const g = buildGarden({
    name: "Léa",
    counts: { transport: 6, scan: 1, quiz: 0 },
    exploits: { duel: true },
    rares: ["lotus"],
  });
  assert.equal(g.plants.find((p) => p.key === "transport")!.stage, 2);
  assert.equal(g.plants.find((p) => p.key === "quiz")!.stage, 0);
  assert.ok(g.rares.find((r) => r.key === "rosier")!.owned);
  assert.ok(g.rares.find((r) => r.key === "lotus")!.owned);
  assert.ok(!g.rares.find((r) => r.key === "chene")!.owned);
  assert.equal(g.grown, 4);
  assert.equal(g.total, 18);
});

test("libellés alignés avec la base (types de duel et de défi collectif)", () => {
  assert.deepEqual(Object.keys(DUEL_KINDS).sort(), ["defis", "repas", "scan", "trajets"]);
  assert.deepEqual(Object.keys(GOAL_KINDS).sort(), ["bravo", "preuve", "quiz", "repas", "scan", "trajets"]);
  assert.equal(duelKindForTemplate("velo"), "trajets");
  assert.equal(duelKindForTemplate("vegetalien"), "repas");
  assert.equal(duelKindForTemplate("chauffage"), "defis");
});
