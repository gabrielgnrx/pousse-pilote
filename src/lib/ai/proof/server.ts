import "server-only";
import { adminDb } from "@/lib/supabase/admin";
import { PROOF_BUCKET } from "@/lib/constants";
import { aiMockEnabled, getAiClient } from "../client.ts";
import { verifyProof, type VerifyOutcome } from "./verify.ts";

/** Vérifie un justificatif tout de suite (appelée après la réponse à la personne, avec after()). */
export async function checkProofNow(validationId: string): Promise<VerifyOutcome> {
  const admin = adminDb();
  if (!admin) return "unavailable";
  return verifyProof(admin as never, validationId, { client: getAiClient(), mock: aiMockEnabled() }, PROOF_BUCKET);
}
