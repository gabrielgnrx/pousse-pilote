"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeFootprint, type BilanAnswers } from "@/lib/co2/footprint.ts";
import { habitsToRow } from "@/lib/session";
import { COMMUTE_KG_PER_KM, HEATING_KG_PER_M2_YEAR } from "@/lib/co2/factors.ts";

const CAR_TYPES = ["thermique", "electrique", "aucune"];

/** Relit les réponses envoyées par le navigateur : seules les valeurs connues passent. */
function parseAnswers(raw: unknown): BilanAnswers | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (k: string) => (typeof r[k] === "number" ? (r[k] as number) : Number.NaN);
  const commuteMode = String(r.commuteMode);
  const heating = String(r.heating);
  const carType = String(r.carType);
  if (!(commuteMode in COMMUTE_KG_PER_KM)) return null;
  if (!(heating in HEATING_KG_PER_M2_YEAR) && heating !== "inconnu") return null;
  if (!CAR_TYPES.includes(carType)) return null;
  const a: BilanAnswers = {
    commuteMode: commuteMode as BilanAnswers["commuteMode"],
    commuteKm: num("commuteKm"),
    commuteDaysPerWeek: num("commuteDaysPerWeek"),
    carType: carType as BilanAnswers["carType"],
    carOtherKmYear: num("carOtherKmYear"),
    shortFlightsYear: num("shortFlightsYear"),
    longFlightsYear: num("longFlightsYear"),
    beefMealsWeek: num("beefMealsWeek"),
    otherMeatMealsWeek: num("otherMeatMealsWeek"),
    heating: heating as BilanAnswers["heating"],
    surfaceM2: num("surfaceM2"),
    householdSize: num("householdSize"),
    newClothesYear: num("newClothesYear"),
    phoneEveryYears: num("phoneEveryYears"),
    newDevicesYear: num("newDevicesYear"),
    // Question ajoutée en octobre 2026 : absente des anciens bilans.
    bottledWaterLDay: typeof r.bottledWaterLDay === "number" ? r.bottledWaterLDay : 0,
  };
  return Object.values(a).every((v) => typeof v !== "number" || Number.isFinite(v)) ? a : null;
}

export async function saveBilan(answersJson: string): Promise<{ error?: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(answersJson);
  } catch {
    return { error: "Réponses illisibles." };
  }
  const answers = parseAnswers(parsed);
  if (!answers) return { error: "Certaines réponses sont manquantes." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  // Le calcul est fait ici, côté serveur, à partir des réponses brutes.
  const footprint = computeFootprint(answers);

  const { error: fpError } = await supabase.from("footprints").insert({
    user_id: user.id,
    answers,
    total_kg: footprint.totalKg,
    by_category: footprint.byCategory,
  });
  if (fpError) return { error: "Impossible d'enregistrer ton bilan. Réessaie." };

  const { error: hError } = await supabase
    .from("habits")
    .upsert(habitsToRow(user.id, footprint.habits), { onConflict: "user_id" });
  if (hError) return { error: "Impossible d'enregistrer tes habitudes. Réessaie." };

  redirect("/bilan?nouveau=1");
}
