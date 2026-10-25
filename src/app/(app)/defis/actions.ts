"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";

/** Annuler un défi en cours (il disparaît de Mon plan ; ce qui a été validé reste compté). */
export async function cancelChallenge(form: FormData) {
  const { supabase, user } = await requireProfile();
  const id = String(form.get("challenge") ?? "");
  await supabase
    .from("user_challenges")
    .update({ status: "abandoned" })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "active");
  revalidatePath("/defis");
  revalidatePath("/fil");
}

const LEVELS = ["facile", "possible", "difficile", "impossible"];

/** « C'est faisable pour moi ? » : la faisabilité déclarée change l'ordre de Mon plan. */
export async function setFeasibility(form: FormData) {
  const { supabase } = await requireProfile();
  const template = String(form.get("template") ?? "");
  const level = String(form.get("level") ?? "");
  if (!LEVELS.includes(level) || !/^[a-z_]+$/.test(template)) return;
  // La base efface aussi le plan de la semaine : il est recalculé avec la nouvelle faisabilité.
  await supabase.rpc("set_feasibility", { p_template: template, p_level: level });
  revalidatePath("/defis");
}
