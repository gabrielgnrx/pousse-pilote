import type { SupabaseClient } from "@supabase/supabase-js";
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
