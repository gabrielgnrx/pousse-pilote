import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { requireProfile } from "@/lib/session";
import { getEngagement } from "@/lib/engagement-data";
import { PousseCounter } from "@/components/PousseCounter";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await requireProfile();

  const [{ data: company }, { data: team }, { count: pending }, me] = await Promise.all([
    supabase.from("companies").select("name").eq("id", profile.company_id).single(),
    profile.team_id
      ? supabase.from("teams").select("name").eq("id", profile.team_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("validations")
      .select("id", { count: "exact", head: true })
      .eq("witness_id", user.id)
      .eq("witness_status", "pending"),
    getEngagement(supabase, user.id),
  ]);

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-28">
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <Link href="/profil" aria-label="Voir mon profil" className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-abricot font-display text-lg font-bold text-[#402a16]">
            {profile.display_name.charAt(0).toUpperCase()}
          </span>
          <span>
            <span className="block text-xs text-terre">
              {company?.name}
              {team?.name ? ` · équipe ${team.name}` : ""}
            </span>
            <span className="block font-display text-lg font-bold">Salut {profile.display_name} !</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
        <Link
          href="/fil"
          aria-label={`${me.points.total} pousses`}
          className="flex h-11 items-center gap-1.5 rounded-full bg-sapin pr-3.5 pl-2.5 font-display text-lg font-bold text-sapin-clair"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b5c890" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 21v-9" />
            <path d="M12 12c0-4 3-7 8-7 0 5-3 7-8 7Z" fill="#b5c890" />
            <path d="M12 15c0-3-2.5-5.5-7-5.5 0 4 2.5 5.5 7 5.5Z" fill="#8fa06a" />
          </svg>
          <PousseCounter total={me.points.total} storageKey="pousse.entete.total" />
        </Link>
        <Link
          href="/notifications"
          aria-label={pending ? `Notifications, ${pending} en attente` : "Notifications"}
          className="relative flex size-11 items-center justify-center rounded-full bg-sable"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a4030" strokeWidth="1.8">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          {pending ? <span className="absolute top-2 right-2.5 size-2.5 rounded-full bg-argile" /> : null}
        </Link>
        </div>
      </header>
      <main className="flex flex-col gap-4 px-4">{children}</main>
      <BottomNav />
    </div>
  );
}
