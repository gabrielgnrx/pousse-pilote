import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AdminOrg {
  company_id: string;
  name: string;
  join_code: string;
  email_domain: string | null;
  teams: { id: string; name: string }[];
  participants: number;
}

/** Espace admin : personne connectée (participante ou non) ; ses organisations, l'active d'abord. */
export async function requireAdmin(orgId?: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entreprise");
  const { data } = await supabase.rpc("my_admin_organizations");
  const orgs = (data ?? []) as AdminOrg[];
  const org = orgs.find((o) => o.company_id === orgId) ?? orgs[0] ?? null;
  return { supabase, user, orgs, org };
}
