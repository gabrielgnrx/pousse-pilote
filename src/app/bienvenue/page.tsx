import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { JOIN_COOKIE } from "@/lib/constants";
import { WelcomeForm } from "./WelcomeForm";

export default async function BienvenuePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/rejoindre");

  const { data: existing } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (existing) redirect("/");

  const code =
    (await cookies()).get(JOIN_COOKIE)?.value ?? (user.user_metadata?.join_code as string | undefined);
  const { data: company } = code
    ? await supabase.rpc("company_by_code", { p_code: code })
    : { data: null };

  if (!code || !company) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-6 py-10">
        <h1 className="font-display text-3xl">Code d&apos;entreprise introuvable</h1>
        <p className="text-brun">Recommence depuis la page d&apos;accueil avec le code fourni par ton entreprise.</p>
        <Link href="/rejoindre" className="btn-primary">Saisir le code</Link>
      </main>
    );
  }

  const defaultName = (user.email ?? "").split("@")[0].split(/[._-]/)[0];
  return (
    <WelcomeForm
      code={code}
      companyName={company.name}
      teams={company.teams as { id: string; name: string }[]}
      defaultName={defaultName.charAt(0).toUpperCase() + defaultName.slice(1)}
    />
  );
}
