"use server";
import { z } from "zod";
import { requireProfile } from "@/lib/session";
import { ISLAND_ERRORS, type IslandData } from "@/lib/game/island.ts";

const PlantInput = z.object({
  species: z.string().min(1).max(40),
  x: z.number().int().min(-3).max(3),
  z: z.number().int().min(-3).max(3),
});

export type PlantResult = { ok: true; data: IslandData } | { ok: false; error: string };

/** Plante une graine : island_plant() vérifie qu'elle a bien été gagnée par une action. */
export async function plantSeed(input: { species: string; x: number; z: number }): Promise<PlantResult> {
  const parsed = PlantInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: ISLAND_ERRORS.off_island ?? "Emplacement invalide." };
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.rpc("island_plant", {
    p_species: parsed.data.species,
    p_x: parsed.data.x,
    p_z: parsed.data.z,
  });
  if (error || !data) {
    const key = Object.keys(ISLAND_ERRORS).find((k) => error?.message?.includes(k));
    return { ok: false, error: (key && ISLAND_ERRORS[key]) || "La graine n'a pas pu être plantée. Réessaie." };
  }
  return { ok: true, data: data as IslandData };
}

/** Mon île à jour (de nouvelles actions ont pu donner des graines). */
export async function myIsland(): Promise<IslandData | null> {
  const { supabase, user } = await requireProfile();
  const { data, error } = await supabase.rpc("island", { p_user: user.id });
  return error || !data ? null : (data as IslandData);
}
