/** Libellés du défi collectif et des duels (les types sont vérifiés par la base, 0011_jeu.sql). */

export const GOAL_KINDS: Record<string, { label: string; one: string; hint: string; href: string }> = {
  repas: { label: "repas végétariens", one: "repas végétarien", hint: "Enregistre un repas végé avec le bouton +.", href: "/agir" },
  trajets: { label: "trajets sans voiture solo", one: "trajet", hint: "Vélo, métro, RER ou covoiturage, avec le bouton +.", href: "/agir" },
  scan: { label: "meilleurs choix au scanner", one: "meilleur choix", hint: "Scanne un produit et choisis mieux noté.", href: "/scanner" },
  quiz: { label: "quiz réussis (7/10 ou plus)", one: "quiz réussi", hint: "Fais 7/10 ou plus au quiz du jour.", href: "/informer#quiz" },
  bravo: { label: "bravos entre collègues", one: "bravo", hint: "Encourage les publications du fil.", href: "/fil#publications" },
  preuve: { label: "actions publiées avec photo", one: "action publiée avec photo", hint: "Enregistre une action puis ajoute une photo.", href: "/agir" },
};

export const DUEL_KINDS: Record<string, { label: string; unit: string; units: string }> = {
  repas: { label: "Repas végé", unit: "repas végé", units: "repas végé" },
  trajets: { label: "Trajets sans voiture", unit: "trajet sans voiture", units: "trajets sans voiture" },
  scan: { label: "Meilleurs choix au scanner", unit: "meilleur choix", units: "meilleurs choix" },
  defis: { label: "Défis avec preuve", unit: "défi avec preuve", units: "défis avec preuve" },
};

/** Ce qu'on compte dans un duel, au pluriel (« repas végé », « Venu au bureau à vélo »). */
export function duelUnits(d: { kind: string; template_id?: string | null; variant?: string | null }, titleOf?: (t: string, v: string) => string): string {
  if (d.kind === "action" && d.template_id && titleOf) return titleOf(d.template_id, d.variant ?? "base").toLowerCase();
  return DUEL_KINDS[d.kind]?.units ?? "actions";
}

/** Les enjeux d'un duel, en une phrase. */
export const DUEL_STAKES =
  "Refuser ou laisser passer 3 jours : −10 pousses. Ne pas atteindre l'objectif en 7 jours : −20. Réussir : +25 chacun, ou +40 si tu es seul à réussir.";

/** Type de duel naturel à partir d'une publication du fil. */
export function duelKindForTemplate(templateId: string): string {
  if (["velo", "transports", "covoiturage"].includes(templateId)) return "trajets";
  if (["vege", "vegetalien"].includes(templateId)) return "repas";
  return "defis";
}
