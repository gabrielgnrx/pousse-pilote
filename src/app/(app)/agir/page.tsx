import { requireHabits } from "@/lib/session";
import { todayParis } from "@/lib/dates";
import { actionItems } from "@/lib/actions-catalog";
import { ActionPicker } from "./ActionPicker";

export const metadata = { title: "Enregistrer une action · Pousse" };

export default async function AgirPage() {
  const { supabase, user, habits } = await requireHabits();
  const today = todayParis();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [{ data: recent }, { data: active }] = await Promise.all([
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
  // Tes habitudes : d'abord les défis en cours, puis ce que tu fais souvent ;
  // à défaut, les actions du quotidien qui comptent le plus pour toi.
  const score = (key: string) => (inChallenge.includes(key) ? 1000 : 0) + (counts[key] ?? 0);
  let favorites = items
    .filter((i) => score(i.key) > 0)
    .sort((a, b) => score(b.key) - score(a.key) || b.kg - a.kg)
    .slice(0, 4);
  if (favorites.length < 3) {
    const extra = items
      .filter((i) => !favorites.includes(i) && ["trajets", "repas", "bureau"].includes(i.theme))
      .sort((a, b) => b.kg - a.kg || b.points - a.points)
      .slice(0, 4 - favorites.length);
    favorites = [...favorites, ...extra];
  }

  return (
    <ActionPicker
      items={items}
      favorites={favorites.map((f) => f.key)}
      counts={counts}
      doneToday={doneToday}
      inChallenge={inChallenge}
    />
  );
}
