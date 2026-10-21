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
      share_feed: form.get("share_feed") === "on",
      feed_choice_at: new Date().toISOString(),
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

// Rappels sur le téléphone ------------------------------------------------------------------

interface SubscriptionJSON {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

/** Enregistre l'abonnement push de cet appareil. */
export async function saveSubscription(sub: SubscriptionJSON): Promise<{ ok: boolean }> {
  const { supabase, user } = await requireProfile();
  const endpoint = String(sub?.endpoint ?? "");
  const p256dh = String(sub?.keys?.p256dh ?? "");
  const auth = String(sub?.keys?.auth ?? "");
  if (!endpoint.startsWith("https://") || endpoint.length > 1000 || !p256dh || !auth) return { ok: false };
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ endpoint, user_id: user.id, p256dh, auth }, { onConflict: "endpoint" });
  return { ok: !error };
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const { supabase, user } = await requireProfile();
  await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", String(endpoint));
}

/** Envoie tout de suite un rappel de test sur mes appareils. */
export async function sendTestReminder(): Promise<{ sent: number; error?: string }> {
  const { supabase, user } = await requireProfile();
  const { pushConfig, sendEmptyPush } = await import("@/lib/push");
  const push = pushConfig();
  if (!push) return { sent: 0, error: "Les rappels ne sont pas encore configurés sur le serveur." };
  const { data: subs } = await supabase.from("push_subscriptions").select("endpoint").eq("user_id", user.id);
  let sent = 0;
  for (const s of subs ?? []) {
    const r = await sendEmptyPush(s.endpoint, push);
    if (r === "sent") sent++;
    if (r === "gone") await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
  }
  return { sent, error: sent ? undefined : "Aucun appareil n'a reçu le rappel. Réactive-les sur ce téléphone." };
}
