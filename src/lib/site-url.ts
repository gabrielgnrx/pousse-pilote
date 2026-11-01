import "server-only";
import { headers } from "next/headers";

/**
 * L'adresse du site pour les liens envoyés par e-mail. En production : celle configurée
 * (NEXT_PUBLIC_SITE_URL). Sur une prévisualisation Vercel ou en local : celle de la requête, pour que
 * le lien de connexion ramène sur la version testée et non sur la production.
 */
export async function siteUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const fromRequest = `${proto}://${host}`;
  if (process.env.VERCEL_ENV === "preview") return fromRequest;
  return process.env.NEXT_PUBLIC_SITE_URL || fromRequest;
}
