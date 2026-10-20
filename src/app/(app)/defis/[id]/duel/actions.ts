"use server";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";

/** Un défi solo en cours devient un duel : même geste, 7 jours, contre quelqu'un d'une autre équipe. */
export async function toDuel(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireProfile();
  const challenge = String(form.get("challenge") ?? "");
  const opponent = String(form.get("opponent") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(opponent)) return { error: "Choisis un adversaire." };
  const { error } = await supabase.rpc("challenge_duel_action", { p_challenge: challenge, p_opponent: opponent });
  if (error) {
    const m = error.message;
    return {
      error: m.includes("same_team")
        ? "Choisis quelqu'un d'une autre équipe."
        : m.includes("opponent_busy")
          ? "Cette personne a déjà 2 invitations en attente : choisis quelqu'un d'autre."
          : m.includes("duel_exists")
            ? "Vous avez déjà un duel en cours tous les deux."
            : m.includes("too_many_duels")
              ? "3 duels à la fois au maximum : termine-en un d'abord."
              : "Le duel n'a pas pu être lancé.",
    };
  }
  redirect("/duels?lance=1");
}
