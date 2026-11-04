import { test } from "node:test";
import assert from "node:assert/strict";
import { islandAfterAction, nextGoal, goalsOf, unlockHow } from "./goals.ts";
import { co2Bonus } from "../co2/bonus.ts";
import type { IslandData } from "./island.ts";

const p = (species: string, x: number, z: number, stage = 1) => ({ id: `${species}${x}${z}`, species, rare: false, x, z, fed: 1, stage, planted_at: "", grown_at: "" });
const BASE = ["transport", "alimentation", "consommation", "logement"];
const island = (over: Partial<IslandData>): IslandData =>
  ({ name: "Test", counts: {}, exploits: {}, rares: [], plants: [], unlocked: BASE, free: {}, pousses: 0, inventory: {}, ...over }) as IslandData;

test("objectif : une île neuve vise le hérisson, avec les deux plantes de départ à poser", () => {
  const g = nextGoal(island({}))!;
  assert.equal(g.animal.key, "herisson");
  assert.equal(g.done, 0);
  assert.deepEqual(g.next, { kind: "planter", species: "alimentation", label: "Planter : Potager" });
});

test("objectif : les deux plantes posées mais loin l'une de l'autre, il reste à les rapprocher", () => {
  const g = nextGoal(island({ plants: [p("alimentation", -1, 1), p("consommation", 2, 2)] }))!;
  assert.equal(g.animal.key, "herisson");
  assert.equal(g.done, 2);
  assert.equal(g.next.kind, "ile");
});

test("objectif : un animal déjà revenu laisse la place au suivant", () => {
  const plants = [p("alimentation", -1, 1), p("consommation", -1, 2)];
  const goals = goalsOf(island({ plants }));
  assert.ok(!goals.some((g) => g.animal.key === "herisson"));
});

test("objectif : une espèce verrouillée s'annonce avec ce qui la débloque", () => {
  const g = goalsOf(island({})).find((x) => x.animal.key === "chardonneret")!;
  assert.match(g.steps[0].label, /Débloquer : Chardon bleu \(2 actions pour tes achats évités \(0\/2\)\)/);
  assert.equal(unlockHow("bravo", {}).action.kind, "lien");
});

test("objectif de la Serre : seulement ceux de la zone demandée", () => {
  for (const g of goalsOf(island({}), "ruisseau")) assert.equal(g.zone, "ruisseau");
  assert.equal(nextGoal(island({}), "foret")?.zone, "foret");
});

test("après une action : la prochaine espèce de la famille et le déblocage du jour", () => {
  const n = islandAfterAction(island({ counts: { transport: 2 }, pousses: 40, plants: [p("transport", -1, -1)] }), "transport");
  assert.deepEqual(n.unlocked, ["Noisetier"]);
  assert.deepEqual(n.next, { name: "Houx", have: 2, need: 4 });
  assert.deepEqual(n.grow, { name: "Bouleau", cost: 30 });
  assert.equal(islandAfterAction(island({}), "bureau").zone, null);
});

test("bonus gros leviers : +5 au-delà de 1 kg, +10 au-delà de 3 kg", () => {
  assert.equal(co2Bonus(0), 0);
  assert.equal(co2Bonus(0.99), 0);
  assert.equal(co2Bonus(1), 5);
  assert.equal(co2Bonus(2.1), 5);
  assert.equal(co2Bonus(3), 10);
  assert.equal(co2Bonus(120), 10);
});
