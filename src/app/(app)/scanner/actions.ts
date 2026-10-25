"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { getProduct, isBarcode, isBetter } from "@/lib/off";
import { runTask } from "@/lib/ai/run";
import { aiDepsFor } from "@/lib/ai/client";
import { pickCategory, scanPhotoTask } from "@/lib/ai/prompts/scan-photo";

const MESSAGES: Record<string, string> = {
  not_better: "Ce produit n'est pas mieux noté que celui que tu as scanné.",
  already_swapped: "Déjà compté aujourd'hui pour ce produit.",
  swap_cap: "Tu as déjà gagné tes 3 bonus de scanner aujourd'hui. Reviens demain !",
};

/** « Je prends celui-ci » : les deux fiches sont relues ici, jamais envoyées par le navigateur. */
export async function chooseAlternative(form: FormData) {
  const { supabase } = await requireProfile();
  const from = String(form.get("from") ?? "");
  const to = String(form.get("to") ?? "");
  if (!isBarcode(from) || !isBarcode(to)) redirect("/scanner");

  const [a, b] = await Promise.all([getProduct(from), getProduct(to)]);
  if (!a || !b || !isBetter(b, a)) redirect(`/scanner/${from}?erreur=${encodeURIComponent(MESSAGES.not_better)}`);

  const { error } = await supabase.rpc("record_swap", {
    p_from_code: a.code,
    p_to_code: b.code,
    p_from_grade: a.grade,
    p_to_grade: b.grade,
    p_from_co2: a.co2PerKg,
    p_to_co2: b.co2PerKg,
  });
  revalidatePath("/fil");
  revalidatePath("/scanner");
  if (error) {
    redirect(`/scanner/${from}?erreur=${encodeURIComponent(MESSAGES[error.message] ?? "Impossible d'enregistrer ton choix.")}`);
  }
  redirect(`/scanner/${from}?choix=${to}`);
}

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Scanner par photo, quand il n'y a pas de code-barres : l'IA reconnaît la catégorie (liste fermée),
 * puis la page de la catégorie affiche l'estimation Agribalyse et des alternatives. La photo n'est pas
 * gardée : elle sert à cette seule reconnaissance.
 */
export async function scanPhoto(form: FormData) {
  const { supabase } = await requireProfile();
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024 || !(PHOTO_TYPES as readonly string[]).includes(file.type)) {
    redirect("/scanner?photo=format");
  }
  const image = { mediaType: (file as File).type as (typeof PHOTO_TYPES)[number], base64: Buffer.from(await (file as File).arrayBuffer()).toString("base64") };
  const r = await runTask(scanPhotoTask, { image }, aiDepsFor(supabase));
  if (!r.ok) redirect("/scanner?photo=indisponible");
  const { sure, choices } = pickCategory(r.data);
  if (sure) redirect(`/scanner/categorie/${encodeURIComponent(sure)}`);
  if (choices.length) redirect(`/scanner?photo=choix&c=${choices.map(encodeURIComponent).join(",")}`);
  redirect("/scanner?photo=inconnu");
}
