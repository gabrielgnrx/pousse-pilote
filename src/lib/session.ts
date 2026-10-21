import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Habits } from "@/lib/co2/footprint.ts";
import type { HeatingMode, CommuteMode } from "@/lib/co2/factors.ts";

export interface Profile {
  id: string;
  company_id: string;
  team_id: string | null;
  display_name: string;
  consent_team_stats: boolean;
  consent_feedback: boolean;
  /** Mes actions et défis apparaissent dans le fil (après un choix daté, feed_choice_at). */
  share_feed: boolean;
  feed_choice_at: string | null;
  created_at: string;
}

export interface HabitsRow {
  user_id: string;
  commute_mode: CommuteMode;
  commute_km: number;
  commute_days: number;
  beef_meals_week: number;
  other_meat_meals_week: number;
  short_flights_year: number;
  long_flights_year: number;
  new_clothes_year: number;
  buys_new_phone: boolean;
  new_devices_year: number;
  heating: HeatingMode;
  heating_kg_year: number;
  bottled_water_l_day?: number | null;
}

export function habitsFromRow(r: HabitsRow): Habits {
  return {
    commuteMode: r.commute_mode,
    commuteKm: Number(r.commute_km),
    commuteDaysPerWeek: r.commute_days,
    beefMealsWeek: r.beef_meals_week,
    otherMeatMealsWeek: r.other_meat_meals_week,
    shortFlightsYear: r.short_flights_year,
    longFlightsYear: r.long_flights_year,
    newClothesYear: r.new_clothes_year,
    buysNewPhone: r.buys_new_phone,
    newDevicesYear: r.new_devices_year ?? 0,
    heating: r.heating,
    heatingKgYear: Number(r.heating_kg_year),
    bottledWaterLDay: Number(r.bottled_water_l_day ?? 0),
  };
}

export function habitsToRow(userId: string, h: Habits): HabitsRow & { updated_at: string } {
  return {
    user_id: userId,
    commute_mode: h.commuteMode,
    commute_km: h.commuteKm,
    commute_days: h.commuteDaysPerWeek,
    beef_meals_week: h.beefMealsWeek,
    other_meat_meals_week: h.otherMeatMealsWeek,
    short_flights_year: h.shortFlightsYear,
    long_flights_year: h.longFlightsYear,
    new_clothes_year: h.newClothesYear,
    buys_new_phone: h.buysNewPhone,
    new_devices_year: h.newDevicesYear,
    heating: h.heating,
    heating_kg_year: h.heatingKgYear,
    bottled_water_l_day: h.bottledWaterLDay,
    updated_at: new Date().toISOString(),
  };
}

/** Utilisateur connecté et membre d'une entreprise ; sinon redirige vers l'étape manquante. */
export async function requireProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();
  if (!profile) redirect("/bienvenue");

  return { supabase, user, profile };
}

/** Comme requireProfile, et exige un bilan (donc des habitudes). */
export async function requireHabits() {
  const ctx = await requireProfile();
  const { data } = await ctx.supabase
    .from("habits")
    .select("*")
    .eq("user_id", ctx.user.id)
    .maybeSingle<HabitsRow>();
  if (!data) redirect("/questionnaire");
  return { ...ctx, habits: habitsFromRow(data) };
}

/** Messages d'erreur lisibles pour les erreurs levées par les fonctions SQL. */
export function sqlErrorMessage(message: string | undefined): string {
  switch (message) {
    case "unknown_code":
      return "Ce code d'entreprise n'existe pas.";
    case "wrong_email_domain":
      return "Utilise ton adresse e-mail professionnelle.";
    case "unknown_team":
      return "Cette équipe n'existe pas.";
    case "cap_reached":
      return "Plafond du jour atteint pour ce type de défi : reviens demain.";
    case "not_eligible":
      return "Ce défi ne remplace aucune de tes habitudes déclarées.";
    case "challenge_closed":
      return "Ce défi est terminé.";
    case "invalid_witness":
      return "Choisis un ou une collègue de ton entreprise.";
    case "no_habits":
      return "Fais d'abord ton bilan.";
    case "nothing_to_confirm":
      return "Cette demande a déjà été traitée.";
    case "already_kept":
      return "C'est déjà noté pour cette semaine. Reviens lundi !";
    case "teletravail_conflict":
      return "Un jour de télétravail ne se cumule pas avec un trajet domicile-travail le même jour.";
    case "receipt_required":
      return "Joins ton justificatif (reçu, billet ou facture) pour valider cette action.";
    case "team_locked":
      return "Tu fais déjà partie d'une équipe. Pour en changer, demande à la personne qui pilote Pousse.";
    case "not_kept_habit":
      return "Cette habitude ne fait pas partie de ton bilan.";
    default:
      return "Une erreur est survenue. Réessaie dans un instant.";
  }
}
