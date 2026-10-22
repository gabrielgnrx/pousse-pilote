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
