/** Défis d'équipe votés le lundi (types vérifiés par la base, 0013_qg_equipe.sql). */

export type TeamKind = "repas" | "actions" | "preuve" | "quiz" | "scan" | "bravo";

export const TEAM_KINDS: Record<TeamKind, { option: (n: number) => string; unit: string; hint: string; href: string }> = {
  repas: { option: (n) => `${n} repas végé chacun`, unit: "repas végé", hint: "Enregistre-les avec le bouton +.", href: "/agir" },
  actions: { option: (n) => `${n} actions chacun avec le bouton +`, unit: "actions enregistrées", hint: "N'importe quelle action compte.", href: "/agir" },
  preuve: { option: (n) => `${n} action publiée avec photo chacun`, unit: "actions publiées avec photo", hint: "Enregistre une action, puis ajoute une photo.", href: "/agir" },
  quiz: { option: (n) => `${n} bonnes réponses au quiz chacun`, unit: "bonnes réponses au quiz", hint: "Un quiz par jour dans S'informer.", href: "/informer#quiz" },
  scan: { option: (n) => `${n} meilleur choix au scanner chacun`, unit: "meilleurs choix au scanner", hint: "Scanne un produit et prends mieux noté.", href: "/scanner" },
  bravo: { option: (n) => `${n} bravos dans le fil chacun`, unit: "bravos dans le fil", hint: "Encourage les publications de tes collègues.", href: "/fil" },
};

export interface TeamWeek {
  week_start: string;
  phase: "upcoming" | "open" | "closed";
  /** Heure de Paris, sans fuseau : « 2026-10-19T09:00:00 ». */
  opens_at: string;
  closes_at: string;
  members: number;
  voters: number;
  my_vote: TeamKind | null;
  options: { kind: TeamKind; per_member: number; votes: number }[];
  chosen: TeamKind | null;
  target: number | null;
  progress: number | null;
  mine: number | null;
  gained: number;
}
