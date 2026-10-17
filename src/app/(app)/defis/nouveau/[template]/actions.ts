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

  const start = todayParis();
  const { error } = await supabase.from("user_challenges").insert({
    user_id: user.id,
    company_id: profile.company_id,
    template_id: t.id,
    variant,
    target,
    starts_on: start,
    ends_on: addDays(start, days - 1),
    inspired_by: inspiredBy,
  });
  if (error) return { error: "Impossible de créer le défi. Réessaie." };

  redirect("/defis?cree=1");
}
