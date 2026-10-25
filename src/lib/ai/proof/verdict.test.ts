import { test } from "node:test";
import assert from "node:assert/strict";
import { decide } from "./verdict.ts";

test("justificatif conforme avec une confiance nette : accepté", () => {
  assert.deepEqual(decide({ verdict: "accepted", reason: "conforme", confidence: 0.92 }), { verdict: "accepted", reason: "conforme" });
});

test("doute : une autre photo est demandée, jamais d'acceptation à l'aveugle", () => {
  assert.equal(decide({ verdict: "accepted", reason: "conforme", confidence: 0.6 }).verdict, "needs_review");
  assert.equal(decide({ verdict: "accepted", reason: "illisible", confidence: 0.99 }).verdict, "needs_review");
  assert.equal(decide({ verdict: "needs_review", reason: "date_absente", confidence: 0.9 }).verdict, "needs_review");
});

test("rejet seulement si le document ne correspond clairement pas", () => {
  assert.deepEqual(decide({ verdict: "rejected", reason: "pas_un_justificatif", confidence: 0.95 }), { verdict: "rejected", reason: "pas_un_justificatif" });
  assert.equal(decide({ verdict: "rejected", reason: "pas_un_justificatif", confidence: 0.7 }).verdict, "needs_review");
  assert.equal(decide({ verdict: "rejected", reason: "illisible", confidence: 0.99 }).verdict, "needs_review");
  assert.equal(decide({ verdict: "rejected", reason: "date_trop_ancienne", confidence: 0.9 }).verdict, "rejected");
});

test("un verdict incohérent avec sa raison n'est jamais « accepté »", () => {
  const d = decide({ verdict: "needs_review", reason: "conforme", confidence: 1 });
  assert.deepEqual(d, { verdict: "needs_review", reason: "illisible" });
});
