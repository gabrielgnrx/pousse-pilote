"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/session";
import { ITEM_BY_KEY } from "@/lib/game/catalog.ts";
import { ISLAND_ERRORS } from "@/lib/game/island.ts";

export type BuyState = { ok?: string; error?: string };

const Item = z.string().regex(/^[a-z_]{2,30}$/);

/** Acheter une plante à la Graineterie (island_buy vérifie le prix, le solde et le déblocage). */
export async function buyItem(_prev: BuyState, form: FormData): Promise<BuyState> {
  const parsed = Item.safeParse(form.get("item"));
  const item = parsed.success ? ITEM_BY_KEY[parsed.data] : undefined;
  if (!item) return { error: "Plante inconnue." };
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("island_buy", { p_item: item.key });
  if (error) {
    const key = Object.keys(ISLAND_ERRORS).find((k) => error.message?.includes(k));
    return { error: (key && ISLAND_ERRORS[key]) || "L'achat n'a pas pu se faire. Réessaie." };
  }
  revalidatePath("/ile/graineterie");
  revalidatePath("/fil");
  return { ok: `${item.name} t'attend dans tes graines, sur ton île.` };
}

/** Offrir un myosotis à un collègue (un par jour, island_gift). */
export async function giftMyosotis(_prev: BuyState, form: FormData): Promise<BuyState> {
  const to = String(form.get("to") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(to)) return { error: "Choisis un collègue." };
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("island_gift", { p_to: to });
  if (error) {
    const key = Object.keys(ISLAND_ERRORS).find((k) => error.message?.includes(k));
    return { error: (key && ISLAND_ERRORS[key]) || "Le cadeau n'a pas pu partir. Réessaie." };
  }
  revalidatePath("/equipes");
  return { ok: "Myosotis envoyé ! Il apparaîtra sur son île." };
}
