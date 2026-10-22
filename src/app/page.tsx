import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo, Sprout } from "@/components/Logo";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (!profile) redirect("/bienvenue");
    const { data: habits } = await supabase.from("habits").select("user_id").eq("user_id", user.id).maybeSingle();
    redirect(habits ? "/fil" : "/questionnaire");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-6 py-8">
      <Logo />
      <div className="flex flex-1 items-center justify-center">
        <div className="flex size-44 items-center justify-center rounded-full bg-sable">
          <Sprout size={110} />
        </div>
      </div>
      <h1 className="font-display text-4xl leading-tight">Moins de CO₂, plus de fun.</h1>
      <p className="text-[15px] leading-relaxed text-brun">
        Calcule ton empreinte pour de vrai, relève des défis avec tes collègues et regarde-la
        fondre, semaine après semaine.
      </p>
      <div className="flex gap-4 text-sm font-semibold text-terre">
        <span>15 questions</span>
        <span>2 minutes</span>
        <span>Zéro jugement</span>
      </div>
      <Link href="/rejoindre" className="btn-primary">
        Rejoindre avec le code de mon entreprise
      </Link>
      <Link href="/connexion" className="btn-ghost">
        J&apos;ai déjà un compte
      </Link>
      <Link href="/methodologie" className="text-center text-sm font-semibold text-brun underline">
        Comment on calcule
      </Link>
    </main>
  );
}
