import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyProof } from "./verify.ts";
import type { MessagesClient } from "../types.ts";

function fakeAdmin(row: Record<string, unknown> | null) {
  const calls: { fn: string; args?: Record<string, unknown> }[] = [];
  const removed: string[][] = [];
  const admin = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }),
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "record_proof_verdict") {
        const v = args?.p_verdict;
        return { data: { photo_to_delete: v === "needs_review" ? null : row?.receipt_path }, error: null };
      }
      return { data: null, error: null };
    },
    storage: {
      from: () => ({
        download: async () => ({ data: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), error: null }),
        remove: async (p: string[]) => {
          removed.push(p);
        },
      }),
    },
  };
  return { admin, calls, removed };
}

const row = { id: "v1", company_id: "c1", template_id: "train", day: "2026-10-22", receipt_path: "u1/recu.jpg", proof_status: "pending" };
const client = (json: unknown): MessagesClient => ({
  messages: { create: async () => ({ content: [{ type: "text", text: JSON.stringify(json) }], stop_reason: "end_turn", usage: { input_tokens: 1500, output_tokens: 30 } }) },
});

test("justificatif conforme : accepté, photo effacée, appel journalisé côté serveur", async () => {
  const f = fakeAdmin(row);
  const r = await verifyProof(f.admin, "v1", { client: client({ verdict: "accepted", reason: "conforme", confidence: 0.93 }) }, "proofs");
  assert.equal(r, "accepted");
  assert.deepEqual(f.removed, [["u1/recu.jpg"]]);
  assert.ok(f.calls.some((c) => c.fn === "ai_log_service" && c.args?.p_task === "proof-check"));
  const verdict = f.calls.find((c) => c.fn === "record_proof_verdict");
  assert.equal(verdict?.args?.p_reason, "conforme");
});

test("confiance moyenne : autre photo demandée, rien n'est effacé", async () => {
  const f = fakeAdmin(row);
  const r = await verifyProof(f.admin, "v1", { client: client({ verdict: "accepted", reason: "conforme", confidence: 0.55 }) }, "proofs");
  assert.equal(r, "needs_review");
  assert.deepEqual(f.removed, []);
});

test("IA indisponible : la vérification reste en attente", async () => {
  const f = fakeAdmin(row);
  assert.equal(await verifyProof(f.admin, "v1", { client: null }, "proofs"), "unavailable");
  assert.ok(!f.calls.some((c) => c.fn === "record_proof_verdict"));
});

test("rien à vérifier : déjà jugé ou sans photo", async () => {
  assert.equal(await verifyProof(fakeAdmin({ ...row, proof_status: "accepted" }).admin, "v1", { client: null }, "proofs"), "skipped");
  assert.equal(await verifyProof(fakeAdmin(null).admin, "v1", { client: null }, "proofs"), "skipped");
});

test("une réponse qui recopie des données du billet est rejetée par le schéma", async () => {
  const f = fakeAdmin(row);
  const r = await verifyProof(
    f.admin,
    "v1",
    { client: client({ verdict: "accepted", reason: "nom: Jean Dupont", confidence: 0.99 }) },
    "proofs",
  );
  assert.equal(r, "unavailable");
});
