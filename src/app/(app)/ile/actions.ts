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

/** Plante une espèce débloquée : island_plant() vérifie le déblocage, la case et le solde de pousses. */
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

const Tile = z.object({ x: z.number().int().min(-3).max(3), z: z.number().int().min(-3).max(3) });

function failure(message: string | undefined, fallback: string): PlantResult {
  const key = Object.keys(ISLAND_ERRORS).find((k) => message?.includes(k));
  return { ok: false, error: (key && ISLAND_ERRORS[key]) || fallback };
}

/** Déplace une de mes plantes vers une case libre (island_move). */
export async function movePlant(input: { from: { x: number; z: number }; to: { x: number; z: number } }): Promise<PlantResult> {
  const from = Tile.safeParse(input.from);
  const to = Tile.safeParse(input.to);
  if (!from.success || !to.success) return { ok: false, error: ISLAND_ERRORS.off_island ?? "Emplacement invalide." };
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.rpc("island_move", { p_from_x: from.data.x, p_from_z: from.data.z, p_to_x: to.data.x, p_to_z: to.data.z });
  if (error || !data) return failure(error?.message, "La plante n'a pas pu être déplacée. Réessaie.");
  return { ok: true, data: data as IslandData };
}

/** Arrache une de mes plantes : ses graines reviennent dans le bac (island_uproot). */
export async function uprootPlant(input: { x: number; z: number }): Promise<PlantResult> {
  const at = Tile.safeParse(input);
  if (!at.success) return { ok: false, error: ISLAND_ERRORS.off_island ?? "Emplacement invalide." };
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.rpc("island_uproot", { p_x: at.data.x, p_z: at.data.z });
  if (error || !data) return failure(error?.message, "La plante n'a pas pu être arrachée. Réessaie.");
  return { ok: true, data: data as IslandData };
}

/** Fait grandir une de mes plantes d'un stade avec mes pousses (island_grow). */
export async function growPlant(input: { x: number; z: number }): Promise<PlantResult> {
  const at = Tile.safeParse(input);
  if (!at.success) return { ok: false, error: ISLAND_ERRORS.off_island ?? "Emplacement invalide." };
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.rpc("island_grow", { p_x: at.data.x, p_z: at.data.z });
  if (error || !data) return failure(error?.message, "La plante n'a pas pu grandir. Réessaie.");
  return { ok: true, data: data as IslandData };
}
