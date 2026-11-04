"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";
import { ISLAND_ERRORS } from "@/lib/game/island.ts";

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

export type GiftState = { ok?: string; error?: string };

/** Offrir un myosotis à un collègue (un par jour, island_gift) : l'espèce est débloquée, le premier offert. */
export async function giftMyosotis(_prev: GiftState, form: FormData): Promise<GiftState> {
  const to = String(form.get("to") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(to)) return { error: "Choisis un collègue." };
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("island_gift", { p_to: to });
  if (error) {
    const key = Object.keys(ISLAND_ERRORS).find((k) => error.message?.includes(k));
    return { error: (key && ISLAND_ERRORS[key]) || "Le cadeau n'a pas pu partir. Réessaie." };
  }
  revalidatePath("/equipes");
  return { ok: "Myosotis envoyé ! Il apparaîtra sur son île." };
}
