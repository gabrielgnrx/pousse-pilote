"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { getProduct, isBarcode, isBetter } from "@/lib/off";

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
