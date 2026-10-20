import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { requireProfile } from "@/lib/session";
import { getEngagement } from "@/lib/engagement-data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await requireProfile();

  const [{ data: company }, { data: team }, { count: toConfirm }, { count: unseen }, me] = await Promise.all([
    supabase.from("companies").select("name").eq("id", profile.company_id).single(),
    profile.team_id
      ? supabase.from("teams").select("name").eq("id", profile.team_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("validations")
      .select("id", { count: "exact", head: true })
      .eq("witness_id", user.id)
      .eq("witness_status", "pending"),
    supabase.from("alerts").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("seen_at", null),
    getEngagement(supabase, user.id),
  ]);

  const pending = (toConfirm ?? 0) + (unseen ?? 0);

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-28">
      <header className="flex items-center justify-between px-5 pt-4 pb-2.5">
        <Link href="/profil" aria-label={`Voir mon profil (${profile.display_name}${team?.name ? `, équipe ${team.name}` : ""}, ${company?.name ?? ""})`} className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-abricot font-display text-lg font-bold text-[#402a16]">
            {profile.display_name.charAt(0).toUpperCase()}
          </span>
          <span className="font-display text-[22px] font-bold">Pousse</span>
        </Link>
        <div className="flex items-center gap-2">
          {pending ? (
            <Link
              href="/notifications"
              aria-label={`Notifications, ${pending} nouvelle${pending > 1 ? "s" : ""}`}
              className="relative flex size-10 items-center justify-center rounded-full bg-sable"
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a4030" strokeWidth="1.8">
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              <span className="absolute top-1.5 right-2 size-2.5 rounded-full bg-argile" />
            </Link>
          ) : null}
          <Link
            href="/profil#pousses"
            aria-label={`Série de ${me.streak} jour${me.streak > 1 ? "s" : ""} d'affilée`}
            className="flex h-10 items-center gap-1.5 rounded-full bg-sable px-3 text-sm font-bold text-brun"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill={me.streak > 0 ? "#f0a97b" : "none"} stroke="#c15f2c" strokeWidth="2">
              <path d="M12 2c2 4-2 5-2 8a4 4 0 1 0 8 0c0-2-1-3-2-4 1 3-1 4-2 3 1-2-1-3-2-7Z" />
            </svg>
            {me.streak} {me.streak > 1 ? "jours" : "jour"}
          </Link>
        </div>
      </header>
      <main className="flex flex-col gap-4 px-4">{children}</main>
      <BottomNav />
    </div>
  );
}
