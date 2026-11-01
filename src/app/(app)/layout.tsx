import { BottomNav } from "@/components/BottomNav";
import { ProgressHud } from "@/components/ProgressHud";
import { requireProfile } from "@/lib/session";
import { getEngagement } from "@/lib/engagement-data";
import { getIsland } from "@/lib/game/data.ts";
import { IslandProvider } from "@/components/island/IslandProvider";
import { GamePanel } from "@/components/island/GamePanel";

/**
 * L'appli est un jeu : l'île en 3D occupe tout l'écran, l'en-tête et la barre du bas flottent dessus,
 * et chaque rubrique s'ouvre en panneau par-dessus l'île.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await requireProfile();

  const [{ count: unseen }, me, { data: team }, island] = await Promise.all([
    supabase.from("alerts").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("seen_at", null),
    getEngagement(supabase, user.id),
    profile.team_id ? supabase.from("teams").select("name").eq("id", profile.team_id).maybeSingle<{ name: string }>() : Promise.resolve({ data: null }),
    getIsland(supabase, user.id),
  ]);

  return (
    <IslandProvider initial={island ?? { name: profile.display_name, counts: {}, exploits: {}, rares: [], plants: [] }}>
      <ProgressHud
        initial={profile.display_name.charAt(0).toUpperCase()}
        total={me.points.total}
        streak={me.streak}
        notifications={unseen ?? 0}
        teamName={team?.name ?? null}
      />
      <GamePanel>{children}</GamePanel>
      <BottomNav />
    </IslandProvider>
  );
}
