"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";
import { PROOF_BUCKET } from "@/lib/constants";

export async function updatePreferences(form: FormData) {
  const { supabase, user } = await requireProfile();
  const name = String(form.get("display_name") ?? "").trim();
  await supabase
    .from("profiles")
    .update({
      ...(name && name.length <= 40 ? { display_name: name } : {}),
      consent_team_stats: form.get("consent_team_stats") === "on",
      consent_feedback: form.get("consent_feedback") === "on",
    })
    .eq("id", user.id);
  revalidatePath("/profil");
}

export async function signOut() {
  const { supabase } = await requireProfile();
  await supabase.auth.signOut();
  redirect("/");
}

export async function deleteAccount(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  if (String(form.get("confirm")).trim().toUpperCase() !== "SUPPRIMER") {
    return { error: "Écris SUPPRIMER pour confirmer." };
  }
  const { supabase, user } = await requireProfile();

  // Les photos d'abord : le stockage ne se vide pas par la base.
  const { data: files } = await supabase.storage.from(PROOF_BUCKET).list(user.id, { limit: 1000 });
  if (files?.length) {
    await supabase.storage.from(PROOF_BUCKET).remove(files.map((f) => `${user.id}/${f.name}`));
  }
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: "Suppression impossible pour l'instant. Écris-nous, on s'en occupe." };

  await supabase.auth.signOut();
  redirect("/?compte=supprime");
}
