"use server";
import { redirect } from "next/navigation";
import { requireProfile, sqlErrorMessage } from "@/lib/session";
import { PROOF_BUCKET } from "@/lib/constants";

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function validateDay(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await requireProfile();
  const challengeId = String(form.get("challenge") ?? "");
  const units = Number(form.get("units"));
  const witness = String(form.get("witness") ?? "") || null;
  const caption = String(form.get("caption") ?? "").slice(0, 280);
  const visibility = form.get("visibility") === "private" ? "private" : "company";
  const photo = form.get("photo");

  let photoPath: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    const ext = IMAGE_TYPES[photo.type];
    if (!ext) return { error: "Photo au format JPEG, PNG ou WebP." };
    if (photo.size > 5 * 1024 * 1024) return { error: "Photo trop lourde (5 Mo maximum)." };
    photoPath = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(PROOF_BUCKET).upload(photoPath, photo, {
      contentType: photo.type,
      upsert: false,
    });
    if (error) return { error: "Envoi de la photo impossible. Réessaie." };
  }

  // Le CO₂, les plafonds et la visibilité sont décidés par la base, pas ici.
  const { data, error } = await supabase.rpc("validate_challenge_day", {
    p_challenge: challengeId,
    p_units: units,
    p_photo_path: photoPath,
    p_witness: witness,
    p_caption: caption,
    p_visibility: visibility,
  });
  if (error) {
    if (photoPath) await supabase.storage.from(PROOF_BUCKET).remove([photoPath]);
    return { error: sqlErrorMessage(error.message) };
  }

  const published = (data as { visibility?: string } | null)?.visibility === "company";
  redirect(published ? "/fil?publie=1" : "/defis?valide=1");
}
