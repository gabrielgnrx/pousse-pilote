import type { KeyObject } from "node:crypto";
import { vapidKey } from "./vapid.ts";

export { sendEmptyPush } from "./vapid.ts";

/** Clés VAPID depuis l'environnement ; null tant que les rappels ne sont pas configurés. */
export function pushConfig(): { publicKey: string; key: KeyObject; subject: string } | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  try {
    return { publicKey, key: vapidKey(publicKey, privateKey), subject: "https://pousse-pilote.vercel.app" };
  } catch {
    return null;
  }
}

/** Le texte du rappel, selon la série en cours. */
export function reminderText(streak: number): { title: string; body: string } {
  if (streak >= 2) {
    return {
      title: `Ta série de ${streak} jours s'arrête ce soir`,
      body: "Un défi, un scan ou un bravo à un collègue suffit pour la garder.",
    };
  }
  return {
    title: "Tes quêtes du jour t'attendent",
    body: "Trois petites actions, +15 pousses. Ça prend deux minutes.",
  };
}
