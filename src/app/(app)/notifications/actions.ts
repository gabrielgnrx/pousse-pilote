"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";

export async function respondWitness(form: FormData) {
  const { supabase } = await requireProfile();
  await supabase.rpc("respond_witness", {
    p_validation: String(form.get("validation")),
    p_confirm: form.get("answer") === "oui",
  });
  revalidatePath("/notifications");
  revalidatePath("/fil");
}
