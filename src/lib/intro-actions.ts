"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { INTRO_COOKIE } from "@/lib/constants";

/** Masque l'écran « Comment ça marche » du fil (le barème reste accessible depuis /regles). */
export async function dismissIntro() {
  (await cookies()).set(INTRO_COOKIE, "1", { maxAge: 60 * 60 * 24 * 365, path: "/", sameSite: "lax" });
  revalidatePath("/fil");
}
