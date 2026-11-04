import type { SupabaseClient } from "@supabase/supabase-js";
import type { IslandData } from "./island.ts";
import type { GardenData } from "./garden.ts";

export type { Quiz } from "./quiz.ts";
import type { Quiz } from "./quiz.ts";

export async function getQuiz(supabase: SupabaseClient): Promise<Quiz | null> {
  const { data, error } = await supabase.rpc("today_quiz");
  return error || !data ? null : (data as Quiz);
}

export interface Duel {
  id: string;
  kind: string;
  target: number;
  status: "pending" | "active" | "declined" | "done" | "expired";
  winner: "both" | "challenger" | "opponent" | "none" | null;
  starts_on: string | null;
  ends_on: string | null;
  created_at: string;
  role: "challenger" | "opponent";
  other_id: string;
  other_name: string;
  other_team: string | null;
  mine: number;
  theirs: number;
  /** Duel sur une action précise (lancé avec un défi). */
  template_id: string | null;
  variant: string | null;
  challenge_id: string | null;
  /** Avec enjeu : refuser ou échouer coûte des pousses. */
  stakes: boolean;
  /** L'action remplace une habitude de mon bilan (sinon refuser est gratuit). */
  feasible: boolean;
}

/** Mes duels (la base clôt au passage ceux qui sont terminés et crédite les gagnants). */
export async function getDuels(supabase: SupabaseClient): Promise<Duel[]> {
  const { data, error } = await supabase.rpc("my_duels");
  return error || !data ? [] : (data as Duel[]);
}

/** J'ai gagné ? « both » compte comme une victoire partagée. */
export function duelOutcome(d: Duel): "gagne" | "partage" | "perdu" | "nul" | null {
  if (d.status !== "done" || !d.winner) return null;
  if (d.winner === "both") return "partage";
  if (d.winner === "none") return "nul";
  return d.winner === d.role ? "gagne" : "perdu";
}

export async function getGarden(supabase: SupabaseClient, userId: string): Promise<GardenData | null> {
  const { data, error } = await supabase.rpc("garden", { p_user: userId });
  return error || !data ? null : (data as GardenData);
}

/** L'île de quelqu'un de mon entreprise : son jardin et ses plantes posées (fonction island(), 0047_ile.sql). */
export async function getIsland(supabase: SupabaseClient, userId: string): Promise<IslandData | null> {
  const { data, error } = await supabase.rpc("island", { p_user: userId });
  return error || !data ? null : (data as IslandData);
}

/**
 * Mon île, après avoir récupéré ce qui m'est dû (island_claim, 0051_ile_serre.sql) : plantes de départ,
 * récompenses des défis, consolations, migrateurs de l'équipe. Rejouer ne donne rien deux fois.
 */
export async function getMyIsland(supabase: SupabaseClient, userId: string): Promise<IslandData | null> {
  await supabase.rpc("island_claim");
  return getIsland(supabase, userId);
}

export interface Migration {
  bird: string;
  week: string;
  /** Le défi de la semaine voté au QG (null : vote pas encore clos). */
  kind: string | null;
  members: number;
  needed: number;
  hosts: { id: string; name: string }[];
  done: boolean;
}

export interface TeamGarden {
  migration: Migration | null;
  /** Défis de la semaine réussis par l'équipe : un arbre chacun dans le bosquet. */
  grove: number;
  gifted_today: boolean;
  colleagues: { id: string; name: string; team: boolean }[];
}

export async function getTeamGarden(supabase: SupabaseClient): Promise<TeamGarden | null> {
  const { data, error } = await supabase.rpc("team_garden");
  return error || !data ? null : (data as TeamGarden);
}
