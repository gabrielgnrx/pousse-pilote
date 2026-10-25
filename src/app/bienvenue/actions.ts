"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sqlErrorMessage } from "@/lib/session";

export interface WelcomeState {
  error?: string;
}

export async function joinCompany(_prev: WelcomeState, form: FormData): Promise<WelcomeState> {
  const code = String(form.get("code") ?? "");
  const team = String(form.get("team") ?? "") || null;
  const name = String(form.get("display_name") ?? "").trim();
  if (form.get("consent_data") !== "on") {
    return { error: "Ce consentement est nécessaire pour calculer ton empreinte." };
  }
  if (!name || name.length > 40) return { error: "Indique un prénom (40 caractères maximum)." };
  if (!team) return { error: "Choisis ton équipe." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_company", {
    p_code: code,
    p_team: team,
    p_display_name: name,
    p_consent_team_stats: form.get("consent_team_stats") === "on",
    p_consent_feedback: form.get("consent_feedback") === "on",
  });
  if (error) return { error: sqlErrorMessage(error.message) };
  if (form.get("consent_ai") !== "on") {
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) await supabase.from("profiles").update({ consent_ai: false }).eq("id", auth.user.id);
  }

  redirect("/questionnaire");
}
