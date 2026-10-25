"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";

export async function toggleCheer(form: FormData) {
  const { supabase, user } = await requireProfile();
  const id = String(form.get("validation"));
  const { data: existing } = await supabase
    .from("cheers")
    .select("validation_id")
    .eq("validation_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    await supabase.from("cheers").delete().eq("validation_id", id).eq("user_id", user.id);
  } else {
    await supabase.from("cheers").insert({ validation_id: id, user_id: user.id });
  }
  revalidatePath("/fil");
}

export async function reportPost(form: FormData) {
  const { supabase, user } = await requireProfile();
  const id = String(form.get("validation"));
  await supabase
    .from("reports")
    .upsert({ validation_id: id, user_id: user.id }, { onConflict: "validation_id,user_id", ignoreDuplicates: true });
  revalidatePath("/fil");
}
