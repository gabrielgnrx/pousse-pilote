"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JOIN_COOKIE } from "@/lib/constants";

export interface JoinState {
  error?: string;
  sentTo?: string;
  companyName?: string;
  mode?: "join" | "login";
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** L'adresse du site : celle configurée, sinon celle de la requête (localhost, ou l'URL Vercel). */
async function siteUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;
}

/**
 * Envoie l'e-mail de connexion : il contient un code à 6 chiffres (à taper dans l'app, fiable sur
 * téléphone) et un lien (pratique sur ordinateur).
 * « join » : première fois, avec le code de l'entreprise. « login » : compte existant, e-mail seul.
 */
export async function requestMagicLink(_prev: JoinState, form: FormData): Promise<JoinState> {
  const mode = form.get("mode") === "login" ? "login" : "join";
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { mode, error: "Adresse e-mail invalide." };
  const supabase = await createClient();
  const site = await siteUrl();

  if (mode === "login") {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${site}/auth/callback?next=/` },
    });
    if (error) {
      return /signup|not found|not allowed/i.test(error.message)
        ? { mode, error: "Aucun compte avec cette adresse. Rejoins Pousse avec le code de ton entreprise." }
        : { mode, error: "Impossible d'envoyer le code pour l'instant. Réessaie dans une minute." };
    }
    return { mode, sentTo: email };
  }

  const code = String(form.get("code") ?? "").trim().toUpperCase();
  if (!code) return { mode, error: "Indique le code de ton entreprise." };
  const { data: company, error } = await supabase.rpc("company_by_code", { p_code: code });
  if (error || !company) return { mode, error: "Ce code d'entreprise n'existe pas." };

  const domain: string | null = company.email_domain;
  if (domain && email.split("@")[1] !== domain.toLowerCase()) {
    return { mode, error: `Utilise ton adresse e-mail professionnelle (@${domain}).` };
  }

  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${site}/auth/callback?next=/bienvenue`,
      data: { join_code: code },
    },
  });
  if (otpError) return { mode, error: "Impossible d'envoyer le code pour l'instant. Réessaie dans une minute." };

  (await cookies()).set(JOIN_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return { mode, sentTo: email, companyName: company.name };
}

export interface VerifyState {
  error?: string;
}

/** Vérifie le code reçu par e-mail ; la session est ouverte sur cet appareil. */
export async function verifyCode(_prev: VerifyState, form: FormData): Promise<VerifyState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const token = String(form.get("token") ?? "").replace(/\D/g, "");
  if (!EMAIL.test(email) || token.length < 6 || token.length > 10) {
    return { error: "Tape le code à chiffres reçu par e-mail." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { error: "Code incorrect ou expiré. Vérifie le dernier e-mail reçu, ou redemande un code." };
  // La page d'accueil oriente vers l'étape suivante : bienvenue, bilan ou fil.
  redirect("/");
}
