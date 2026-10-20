"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";

const ERRORS: Record<string, string> = {
  no_team: "Tu n'as pas encore d'équipe.",
  invalid_message: "Message vide ou trop long (500 caractères au plus).",
  too_many_messages: "Tu as envoyé beaucoup de messages : réessaie dans un moment.",
  vote_closed: "Le vote est fermé : il a lieu le lundi de 9 h à 14 h.",
  invalid_choice: "Ce défi ne fait pas partie du vote.",
  cannot_report: "Ce message ne peut pas être signalé.",
};
const message = (code?: string) => ERRORS[code ?? ""] ?? "Une erreur est survenue. Réessaie dans un instant.";

export async function sendTeamMessage(body: string): Promise<{ error?: string }> {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("post_team_message", { p_body: body });
  if (error) return { error: message(error.message) };
  revalidatePath("/equipes");
  return {};
}

export async function voteTeamWeek(choice: string): Promise<{ error?: string }> {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("vote_team_week", { p_choice: choice });
  if (error) return { error: message(error.message) };
  revalidatePath("/equipes");
  return {};
}

export async function reportTeamMessage(id: string): Promise<{ error?: string }> {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("report_team_message", { p_message: id });
  if (error) return { error: message(error.message) };
  revalidatePath("/equipes");
  return {};
}
