"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile, sqlErrorMessage } from "@/lib/session";

/** « Je garde le cap » : confirme une habitude bas carbone pour la semaine (10 points). */
export async function keepHabit(form: FormData) {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("keep_habit", { p_habit: String(form.get("habit") ?? "") });
  revalidatePath("/defis");
  revalidatePath("/equipes");
  revalidatePath("/profil");
  if (error) redirect(`/defis?erreur=${encodeURIComponent(sqlErrorMessage(error.message))}`);
  redirect("/defis?garde=1");
}

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
