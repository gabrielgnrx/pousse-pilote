/** Défis d'équipe votés le lundi (types vérifiés par la base, 0013_qg_equipe.sql). */

export type TeamKind = "repas" | "actions" | "preuve" | "quiz" | "scan" | "bravo" | "nature";

export const TEAM_KINDS: Record<TeamKind, { option: (n: number) => string; unit: string; hint: string; href: string }> = {
  repas: { option: (n) => `${n} repas végé chacun`, unit: "repas végé", hint: "Enregistre-les avec le bouton +.", href: "/agir" },
  actions: { option: (n) => `${n} actions chacun avec le bouton +`, unit: "actions enregistrées", hint: "N'importe quelle action compte.", href: "/agir" },
  preuve: { option: (n) => `${n} action publiée avec photo chacun`, unit: "actions publiées avec photo", hint: "Enregistre une action, puis ajoute une photo.", href: "/agir" },
  quiz: { option: (n) => `${n} quiz réussis chacun (7/10 ou plus)`, unit: "quiz réussis (7/10 ou plus)", hint: "10 questions par jour, dans S'informer.", href: "/quiz" },
  scan: { option: (n) => `${n} meilleur choix au scanner chacun`, unit: "meilleurs choix au scanner", hint: "Scanne un produit et prends mieux noté.", href: "/scanner" },
  bravo: { option: (n) => `${n} bravos dans le fil chacun`, unit: "bravos dans le fil", hint: "Encourage les publications de tes collègues.", href: "/fil" },
  nature: { option: (n) => `${n} action nature chacun (compost, ramassage…)`, unit: "actions nature", hint: "Compost, ramassage de déchets, comptage, plantation : bouton +, thème Nature.", href: "/agir" },
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
