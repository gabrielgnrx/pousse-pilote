"use server";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { JOIN_COOKIE } from "@/lib/constants";

export interface JoinState {
  error?: string;
  sentTo?: string;
  companyName?: string;
}

export async function requestMagicLink(_prev: JoinState, form: FormData): Promise<JoinState> {
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!code) return { error: "Indique le code de ton entreprise." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Adresse e-mail invalide." };

  const supabase = await createClient();
  const { data: company, error } = await supabase.rpc("company_by_code", { p_code: code });
  if (error || !company) return { error: "Ce code d'entreprise n'existe pas." };

  const domain: string | null = company.email_domain;
  if (domain && email.split("@")[1] !== domain.toLowerCase()) {
    return { error: `Utilise ton adresse e-mail professionnelle (@${domain}).` };
  }

  // L'adresse du site : celle configurée, sinon celle de la requête (localhost, ou l'URL Vercel).
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const site = process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${site}/auth/callback?next=/bienvenue`,
      data: { join_code: code },
    },
  });
  if (otpError) return { error: "Impossible d'envoyer le lien pour l'instant. Réessaie dans une minute." };

  (await cookies()).set(JOIN_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return { sentTo: email, companyName: company.name };
}
