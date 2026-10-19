/** Libellés du défi collectif et des duels (les types sont vérifiés par la base, 0011_jeu.sql). */

export const GOAL_KINDS: Record<string, { label: string; one: string; hint: string; href: string }> = {
  repas: { label: "repas végétariens", one: "repas végétarien", hint: "Valide un repas végé ou végétalien.", href: "/defis" },
  trajets: { label: "trajets sans voiture solo", one: "trajet", hint: "Vélo, métro, RER ou covoiturage.", href: "/defis" },
  scan: { label: "meilleurs choix au scanner", one: "meilleur choix", hint: "Scanne un produit et choisis mieux noté.", href: "/scanner" },
  quiz: { label: "bonnes réponses au quiz", one: "bonne réponse", hint: "Réponds au quiz du jour.", href: "/fil#quiz" },
  bravo: { label: "bravos entre collègues", one: "bravo", hint: "Encourage les publications du fil.", href: "/fil#publications" },
  preuve: { label: "défis validés avec preuve", one: "défi prouvé", hint: "Une photo ou un collègue témoin.", href: "/defis" },
};

export const DUEL_KINDS: Record<string, { label: string; unit: string; units: string }> = {
  repas: { label: "Repas végé", unit: "repas végé", units: "repas végé" },
  trajets: { label: "Trajets sans voiture", unit: "trajet sans voiture", units: "trajets sans voiture" },
  scan: { label: "Meilleurs choix au scanner", unit: "meilleur choix", units: "meilleurs choix" },
  defis: { label: "Défis avec preuve", unit: "défi avec preuve", units: "défis avec preuve" },
};

/** Type de duel naturel à partir d'une publication du fil. */
export function duelKindForTemplate(templateId: string): string {
  if (["velo", "transports", "covoiturage"].includes(templateId)) return "trajets";
  if (["vege", "vegetalien"].includes(templateId)) return "repas";
  return "defis";
}
