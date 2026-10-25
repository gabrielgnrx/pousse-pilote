/**
 * Du jugement de l'IA au verdict enregistré : une règle déterministe et prudente.
 * L'IA évalue seulement la plausibilité ; on n'accepte qu'avec une confiance nette, on ne rejette
 * qu'avec une confiance très nette, et tout le reste demande une autre photo (jamais de supposition).
 */

export const PROOF_REASONS = [
  "conforme",
  "pas_un_justificatif",
  "type_different",
  "illisible",
  "date_absente",
  "date_trop_ancienne",
] as const;
export type ProofReason = (typeof PROOF_REASONS)[number];
export type Verdict = "accepted" | "needs_review" | "rejected";

export interface ProofJudgement {
  verdict: Verdict;
  reason: ProofReason;
  confidence: number;
}

export const ACCEPT_CONFIDENCE = 0.8;
export const REJECT_CONFIDENCE = 0.85;

/** Les justificatifs attendus, par action (même liste que requires_receipt en base). */
export const PROOF_KINDS: Record<string, string> = {
  train: "un billet de train ou une confirmation de réservation de train",
  vacances_train: "une réservation ou un billet de train pour un voyage (vacances)",
  reparation: "une facture ou un ticket de réparation d'un appareil électronique (smartphone, ordinateur, tablette, console)",
  appli_occasion: "un reçu ou une confirmation de commande d'achat d'occasion sur une application (Vinted, Leboncoin, Back Market…)",
  appli_antigaspi: "un reçu ou une confirmation de commande d'un panier anti-gaspillage (Too Good To Go, Phenix…)",
};

/** Délai accepté entre la date du justificatif et l'enregistrement de l'action. */
export const MAX_AGE_DAYS: Record<string, number> = { train: 7, vacances_train: 60, reparation: 30, appli_occasion: 14, appli_antigaspi: 7 };

export function decide(j: ProofJudgement): { verdict: Verdict; reason: ProofReason } {
  if (j.verdict === "accepted" && j.reason === "conforme" && j.confidence >= ACCEPT_CONFIDENCE) {
    return { verdict: "accepted", reason: "conforme" };
  }
  const clearlyWrong = j.reason === "pas_un_justificatif" || j.reason === "type_different" || j.reason === "date_trop_ancienne";
  if (j.verdict === "rejected" && clearlyWrong && j.confidence >= REJECT_CONFIDENCE) {
    return { verdict: "rejected", reason: j.reason };
  }
  // Doute, photo illisible, date introuvable, ou incohérence entre verdict et raison : autre photo.
  return { verdict: "needs_review", reason: j.reason === "conforme" ? "illisible" : j.reason };
}

/** Le message montré à la personne : bienveillant, sans reprendre ce qui figure sur le justificatif. */
export const VERDICT_MESSAGE: Record<Verdict, string> = {
  accepted: "Justificatif vérifié : c'est tout bon. La photo a été effacée.",
  needs_review: "On n'a pas pu lire ton justificatif. Envoie une autre photo, bien nette : tes pousses t'attendent.",
  rejected: "Ce document ne correspond pas à l'action : elle n'a pas été comptée. La photo a été effacée.",
};
