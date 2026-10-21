import { BottomNav } from "@/components/BottomNav";
import { ProgressHud } from "@/components/ProgressHud";
import { requireProfile } from "@/lib/session";
import { getEngagement } from "@/lib/engagement-data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await requireProfile();

  const [{ data: pulse }, { count: toConfirm }, { count: unseen }, me] = await Promise.all([
    supabase.rpc("company_pulse"),
    supabase
      .from("validations")
      .select("id", { count: "exact", head: true })
      .eq("witness_id", user.id)
      .eq("witness_status", "pending"),
    supabase.from("alerts").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("seen_at", null),
    getEngagement(supabase, user.id),
  ]);
  const p = pulse as { name: string; kg: number; goal_kg: number } | null;

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-28">
      <ProgressHud
        initial={profile.display_name.charAt(0).toUpperCase()}
        total={me.points.total}
        streak={me.streak}
        notifications={(toConfirm ?? 0) + (unseen ?? 0)}
        company={p ? { name: p.name, kg: Number(p.kg), goalKg: Number(p.goal_kg) } : null}
      />
      <main className="flex flex-col gap-4 px-4">{children}</main>
      <BottomNav />
    </div>
  );
}
