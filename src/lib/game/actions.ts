"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";
import type { Quiz } from "./data.ts";

export async function answerQuiz(question: number, choice: number): Promise<Quiz | { error: string }> {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.rpc("answer_quiz", { p_question: question, p_choice: choice });
  if (error) {
    return {
      error: error.message.includes("already_answered")
        ? "Tu as déjà répondu à cette question."
        : error.message.includes("not_today")
          ? "Cette question n'est plus celle du jour : recharge la page."
          : "Réponse non enregistrée, réessaie.",
    };
  }
  revalidatePath("/quiz");
  revalidatePath("/defis");
  return data as Quiz;
}

export async function openSeed(): Promise<{ plant: string | null; points: number } | { error: string }> {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.rpc("open_seed");
  if (error) return { error: "Pas de graine à ouvrir pour l'instant." };
  return data as { plant: string | null; points: number };
}

const DUEL_ERRORS: Record<string, string> = {
  invalid_opponent: "Choisis un collègue de ton entreprise.",
  invalid_duel: "Ce duel n'est pas valide.",
  too_many_duels: "3 duels à la fois au maximum : termine-en un d'abord.",
  duel_exists: "Vous avez déjà un duel en cours tous les deux.",
  same_team: "Un duel se joue contre quelqu'un d'une autre équipe.",
  opponent_busy: "Cette personne a déjà 2 invitations en attente : choisis quelqu'un d'autre.",
};

export async function challengeDuel(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("challenge_duel", {
    p_opponent: String(form.get("opponent") ?? ""),
    p_kind: String(form.get("kind") ?? ""),
    p_target: Number(form.get("target") ?? 3),
  });
  if (error) {
    const key = Object.keys(DUEL_ERRORS).find((k) => error.message.includes(k));
    return { error: key ? DUEL_ERRORS[key] : "Le duel n'a pas pu être lancé." };
  }
  revalidatePath("/duels");
  redirect("/duels?lance=1");
}

export async function answerDuel(form: FormData) {
  const { supabase } = await requireProfile();
  const accept = form.get("accept") === "1";
  const { error } = await supabase.rpc("answer_duel", { p_duel: String(form.get("duel") ?? ""), p_accept: accept });
  revalidatePath("/duels");
  revalidatePath("/fil");
  redirect(error ? "/duels?erreur=1" : accept ? "/duels?accepte=1" : "/duels");
}
