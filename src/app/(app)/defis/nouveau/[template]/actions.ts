"use server";
import { redirect } from "next/navigation";
import { requireHabits } from "@/lib/session";
import { TEMPLATE_BY_ID, unitImpact } from "@/lib/co2/challenges.ts";
import { addDays, todayParis } from "@/lib/dates";

const DURATIONS = [7, 30, 90];

export async function createChallenge(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const { supabase, user, profile, habits } = await requireHabits();
  const t = TEMPLATE_BY_ID[String(form.get("template"))];
  if (!t) return { error: "Défi inconnu." };
  const variant = String(form.get("variant") ?? "");
  if (!t.variants.some((v) => v.key === variant)) return { error: "Choisis une option." };
  if (!unitImpact(t.id, variant, habits).eligible) {
    return { error: "Ce choix ne remplace aucune de tes habitudes déclarées." };
  }
  const target = Number(form.get("target"));
  const days = Number(form.get("days"));
  if (!Number.isInteger(target) || target < 1 || target > 100) return { error: "Objectif invalide." };
  if (!DURATIONS.includes(days)) return { error: "Durée invalide." };

  // Défi relevé depuis la publication d'un collègue : vérifié ici, et de nouveau par la base.
  const via = String(form.get("via") ?? "");
  let inspiredBy: string | null = null;
  if (/^[0-9a-f-]{36}$/i.test(via)) {
    const { data: src } = await supabase
      .from("validations")
      .select("id, user_id")
      .eq("id", via)
      .eq("visibility", "company")
      .eq("status", "valid")
      .maybeSingle();
    if (src && src.user_id !== user.id) inspiredBy = src.id;
  }

  const opponent = String(form.get("opponent") ?? "");
  const withDuel = /^[0-9a-f-]{36}$/i.test(opponent);
  if (withDuel && (days !== 7 || target > 10)) return { error: "Un duel dure 1 semaine, avec 10 au plus." };

  const start = todayParis();
  const { data: created, error } = await supabase.from("user_challenges").insert({
    user_id: user.id,
    company_id: profile.company_id,
    template_id: t.id,
    variant,
    target,
    starts_on: start,
    ends_on: addDays(start, days - 1),
    inspired_by: inspiredBy,
  }).select("id").single();
  if (error || !created) return { error: "Impossible de créer le défi. Réessaie." };

  if (withDuel) {
    const { error: duelError } = await supabase.rpc("challenge_duel_action", { p_challenge: created.id, p_opponent: opponent });
    if (duelError) {
      // Pas de défi à moitié lancé : on l'annule et on explique pourquoi.
      await supabase.from("user_challenges").update({ status: "abandoned" }).eq("id", created.id);
      const m = duelError.message;
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
  redirect("/fil?defi=1");
}
