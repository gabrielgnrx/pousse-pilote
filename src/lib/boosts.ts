/**
 * À plusieurs, ça rapporte plus : une action qui compte dans le défi d'équipe de la semaine vaut ×2,
 * dans un duel en cours ×1,5. Mêmes règles que log_action (0021_defis_a_plusieurs.sql) ; la base fait foi.
 */
import type { TeamKind } from "./team.ts";

export const MODES = {
  seul: { label: "Seul", mult: 1, bonus: "+20 si réussi" },
  duel: { label: "Duel", mult: 1.5, bonus: "+40, ou +30 chacun à deux" },
  equipe: { label: "Équipe", mult: 2, bonus: "+50 par contributeur" },
} as const;

export const BONUS = { seul: 20, duelSeul: 40, duelDeux: 30, equipe: 50, mise: 10 } as const;

export type Boost = { kind: "duel" | "equipe"; mult: number; label: string };

/** L'action fait-elle avancer ce défi d'équipe ? (comme team_kind_count) */
export function countsForTeam(kind: TeamKind, item: { templateId: string; category: string; requiresConfirm?: boolean }) {
  switch (kind) {
    case "actions":
      return true;
    case "repas":
      return item.templateId === "vege" || item.templateId === "vegetalien";
    case "nature":
      return item.category === "nature";
    case "preuve":
      // Compte quand l'action est publiée avec une photo, pas au moment de l'enregistrer.
      return false;
    default:
      return false;
  }
}

/** Le défi d'équipe qu'une action personnelle peut proposer au vote du lundi suivant. */
export function teamKindFor(templateId: string, category: string): TeamKind | null {
  if (templateId === "vege" || templateId === "vegetalien") return "repas";
  if (category === "nature") return "nature";
  return null;
}

export const fmtMult = (m: number) => `×${String(m).replace(".", ",")}`;

export function boostedPoints(points: number, boost: Boost | null | undefined) {
  return boost && points > 0 ? Math.round(points * boost.mult) : points;
}
