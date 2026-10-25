import { requireHabits } from "@/lib/session";
import { todayParis } from "@/lib/dates";
import { actionItems } from "@/lib/actions-catalog";
import { ActionPicker } from "./ActionPicker";
import { ProofToResend, type ProofRow } from "./ProofToResend";
import { getDuels } from "@/lib/game/data.ts";
import { duelCountsFor } from "@/lib/game/labels.ts";
import { countsForTeam, type Boost } from "@/lib/boosts";
import type { TeamWeek } from "@/lib/team";

export const metadata = { title: "Enregistrer une action · Pousse" };

export default async function AgirPage({ searchParams }: { searchParams: Promise<{ ajout?: string; justificatif?: string }> }) {
  const { ajout, justificatif } = await searchParams;
  const { supabase, user, profile, habits } = await requireHabits();
  const today = todayParis();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [{ data: recent }, { data: active }, duels, { data: teamWeek }, { data: toResend }] = await Promise.all([
    supabase
      .from("validations")
      .select("template_id, variant, day")
      .eq("user_id", user.id)
      .eq("status", "valid")
      .gte("day", monthStart),
    supabase
      .from("user_challenges")
      .select("template_id, variant")
      .eq("user_id", user.id)
      .eq("status", "active")
      .lte("starts_on", today)
      .gte("ends_on", today),
    getDuels(supabase),
    profile.team_id ? supabase.rpc("my_team_week") : Promise.resolve({ data: null }),
    supabase
      .from("validations")
      .select("id, template_id, variant, day")
      .eq("user_id", user.id)
      .eq("status", "valid")
      .eq("proof_status", "needs_review")
      .order("created_at", { ascending: false })
      .limit(3)
      .returns<ProofRow[]>(),
  ]);

  const counts: Record<string, number> = {};
  const doneToday: Record<string, boolean> = {};
  for (const v of recent ?? []) {
    const key = `${v.template_id}:${v.variant}`;
    counts[key] = (counts[key] ?? 0) + 1;
    if (v.day === today) doneToday[key] = true;
  }
  const inChallenge = (active ?? []).map((c) => `${c.template_id}:${c.variant}`);

  const items = actionItems(habits);

  // À plusieurs, ça rapporte plus : ×2 pour le défi d'équipe de la semaine, sinon ×1,5 pour un duel en cours.
  const week = teamWeek as TeamWeek | null;
  const boosts: Record<string, Boost> = {};
  for (const i of items) {
    if (week?.chosen && countsForTeam(week.chosen, i)) {
      boosts[i.key] = { kind: "equipe", mult: 2, label: "Compte pour le défi d'équipe" };
      continue;
    }
    const d = duels.find((x) => x.status === "active" && duelCountsFor(x, i.templateId));
    if (d) boosts[i.key] = { kind: "duel", mult: 1.5, label: `Compte pour ton duel contre ${d.other_name}` };
  }
  // Tes habitudes : d'abord les défis en cours, puis ce que tu fais souvent ;
  // à défaut, les actions du quotidien qui comptent le plus pour toi.
  const score = (key: string) => (boosts[key] ? 2000 : 0) + (inChallenge.includes(key) ? 1000 : 0) + (counts[key] ?? 0);
  let favorites = items
    .filter((i) => !i.requiresReceipt && score(i.key) > 0)
    .sort((a, b) => score(b.key) - score(a.key) || b.kg - a.kg)
    .slice(0, 4);
  if (favorites.length < 3) {
    const extra = items
      .filter((i) => !favorites.includes(i) && !i.requiresReceipt && ["trajets", "repas", "bureau"].includes(i.theme))
      .sort((a, b) => b.kg - a.kg || b.points - a.points)
      .slice(0, 4 - favorites.length);
    favorites = [...favorites, ...extra];
  }

  const resendStatus = justificatif && !/^[0-9a-f-]{36}$/i.test(justificatif) ? justificatif : null;
  return (
    <>
    <ProofToResend rows={toResend ?? []} status={resendStatus} />
    <ActionPicker
      items={items}
      favorites={favorites.map((f) => f.key)}
      counts={counts}
      doneToday={doneToday}
      inChallenge={inChallenge}
      boosts={boosts}
      openReceipt={ajout && items.some((i) => i.key === ajout && i.requiresReceipt) ? ajout : null}
      habits={habits}
    />
    </>
  );
}
