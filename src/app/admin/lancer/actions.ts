"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/session";

const ERRORS: Record<string, string> = {
  invalid_name: "Le nom de l'organisation doit faire entre 2 et 80 caractères.",
  invalid_domain: "Ce domaine e-mail n'est pas valide (exemple : entreprise.fr).",
  domain_mismatch: "Le domaine doit être celui de ton adresse e-mail professionnelle.",
  too_many_organizations: "Tu administres déjà 3 organisations.",
  invalid_teams: "Indique entre 1 et 30 équipes.",
};

const launchSchema = z.object({
  name: z.string().trim().min(2).max(80),
  domain: z.string().trim().max(80),
  teams: z.array(z.string().trim().min(1).max(40)).min(1).max(30),
  consent: z.literal("on"),
});

export interface LaunchState {
  error?: string;
}

/** Création de l'organisation en self-serve : le code d'invitation est généré par la base. */
export async function createOrganization(_prev: LaunchState, form: FormData): Promise<LaunchState> {
  const parsed = launchSchema.safeParse({
    name: form.get("name"),
    domain: form.get("domain") ?? "",
    teams: String(form.get("teams") ?? "")
      .split(/\n|,/)
      .map((t) => t.trim())
      .filter(Boolean),
    consent: form.get("consent"),
  });
  if (!parsed.success) return { error: "Vérifie le nom, les équipes (une par ligne) et la case d'engagement." };
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_email_domain: form.get("restrict") === "on" ? parsed.data.domain : null,
    p_teams: [...new Set(parsed.data.teams)],
  });
  if (error || !data) return { error: ERRORS[error?.message ?? ""] ?? "La création n'a pas abouti. Réessaie." };
  redirect(`/admin/lancer?org=${(data as { company_id: string }).company_id}&cree=1`);
}

/** Ajoute des équipes à une organisation existante. */
export async function addTeams(form: FormData) {
  const org = String(form.get("org") ?? "");
  const { supabase } = await requireAdmin(org);
  const teams = String(form.get("teams") ?? "")
    .split(/\n|,/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1 && t.length <= 40)
    .slice(0, 30);
  if (teams.length) await supabase.rpc("admin_add_teams", { p_company: org, p_teams: teams });
  revalidatePath("/admin/lancer");
}
