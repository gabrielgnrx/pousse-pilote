import type { SupabaseClient } from "@supabase/supabase-js";
import { weekStart } from "@/lib/co2/engagement.ts";
import { TEMPLATE_BY_ID } from "@/lib/co2/challenges.ts";
import { todayParis } from "@/lib/dates";

export interface Engagement {
  /** Impact réel : CO₂ évité par les défis validés, depuis le début. */
  kgAvoided: number;
  /** Le jeu : pousses depuis le début, par source. */
  points: {
    total: number;
    defis: number;
    maintien: number;
    influence: number;
    temoin: number;
    /** Quêtes du jour et séries de jours actifs. */
    bonus: number;
    /** Meilleurs choix au scanner. */
    scan: number;
    /** Quiz, graines mystère, défis collectifs et duels. */
    jeu: number;
  };
  /** Cette semaine (depuis lundi) : points et kg. */
  week: { points: number; kg: number };
  /** Pousses gagnées aujourd'hui. */
  today: number;
  /** Série : jours actifs d'affilée (défi, habitude gardée, bravo, scan). */
  streak: number;
  /** Dernières pousses gagnées, les plus récentes d'abord. */
  recent: { label: string; points: number; at: string }[];
  /** Habitudes déjà confirmées cette semaine. */
  keptThisWeek: Set<string>;
  influence: { challenges: number; colleagues: number; kg: number };
}

/** Points, impact et série de la personne connectée (lus sous ses propres droits). */
export async function getEngagement(supabase: SupabaseClient, userId: string): Promise<Engagement> {
  const [{ data: validations }, { data: ledger }, { data: checkins }, { data: influence }, { data: dayStreak }] = await Promise.all([
    supabase
      .from("validations")
      .select("kg, points, day, template_id, units, proof_level, created_at")
      .eq("user_id", userId)
      .eq("status", "valid"),
    supabase.from("points_ledger").select("kind, points, created_at").eq("user_id", userId),
    supabase.from("habit_checkins").select("habit, week_start").eq("user_id", userId),
    supabase.rpc("my_influence").maybeSingle<{ challenges: number; colleagues: number; kg: number }>(),
    supabase.rpc("my_day_streak"),
  ]);

  const today = todayParis();
  const monday = weekStart(today);
  const parisDay = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const byKind = (kind: string) =>
    (ledger ?? []).filter((l) => l.kind === kind).reduce((s, l) => s + Number(l.points), 0);
  const defis = (validations ?? []).reduce((s, v) => s + Number(v.points), 0);
  const maintien = byKind("maintien");
  const influencePts = byKind("influence");
  const temoin = byKind("temoin");
  const bonus = byKind("quete") + byKind("serie");
  const scan = byKind("scan");
  const jeu = byKind("quiz") + byKind("graine") + byKind("collectif") + byKind("duel") + byKind("equipe");
  const LEDGER_LABEL: Record<string, string> = {
    maintien: "Cap gardé",
    influence: "Un collègue a relevé ton défi",
    temoin: "Témoin pour un collègue",
    quete: "Quêtes du jour réussies",
    serie: "Bonus de série",
    scan: "Meilleur choix au scanner",
    quiz: "Quiz du jour",
    graine: "Graine mystère",
    collectif: "Défi collectif réussi",
    duel: "Duel réussi",
    equipe: "Défi d'équipe réussi",
  };
  const recent = [
    ...(validations ?? [])
      .filter((v) => Number(v.points) > 0)
      .map((v) => {
        const t = TEMPLATE_BY_ID[v.template_id as string];
        return {
          label: `${t?.title ?? "Défi"}${v.units > 1 ? ` ×${v.units}` : ""}${v.proof_level > 0 ? " · preuve" : ""}`,
          points: Number(v.points),
          at: v.created_at as string,
        };
      }),
    ...(ledger ?? []).map((l) => ({ label: LEDGER_LABEL[l.kind] ?? "Bonus", points: Number(l.points), at: l.created_at as string })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);
  const thisWeek = (validations ?? []).filter((v) => v.day >= monday);

  return {
    kgAvoided: (validations ?? []).reduce((s, v) => s + Number(v.kg), 0),
    points: {
      total: defis + maintien + influencePts + temoin + bonus + scan + jeu,
      defis,
      maintien,
      influence: influencePts,
      temoin,
      bonus,
      scan,
      jeu,
    },
    week: {
      points:
        thisWeek.reduce((s, v) => s + Number(v.points), 0) +
        (ledger ?? []).filter((l) => parisDay(l.created_at) >= monday).reduce((s, l) => s + Number(l.points), 0),
      kg: thisWeek.reduce((s, v) => s + Number(v.kg), 0),
    },
    today:
      (validations ?? []).filter((v) => v.day === today).reduce((s, v) => s + Number(v.points), 0) +
      (ledger ?? []).filter((l) => parisDay(l.created_at) === today).reduce((s, l) => s + Number(l.points), 0),
    recent,
    streak: Number(dayStreak ?? 0),
    keptThisWeek: new Set((checkins ?? []).filter((c) => c.week_start === monday).map((c) => c.habit as string)),
    influence: {
      challenges: Number(influence?.challenges ?? 0),
      colleagues: Number(influence?.colleagues ?? 0),
      kg: Number(influence?.kg ?? 0),
    },
  };
}

export interface CollectiveGoal {
  name: string;
  participants: number;
  kg: number;
  goal_kg: number;
  ends_on: string;
}

/** L'objectif collectif de l'entreprise, en kg de CO₂ évités depuis le début du pilote. */
export async function getCollectiveGoal(supabase: SupabaseClient): Promise<CollectiveGoal | null> {
  const { data } = await supabase.rpc("collective_goal").maybeSingle<CollectiveGoal>();
  return data ? { ...data, kg: Number(data.kg), goal_kg: Number(data.goal_kg) } : null;
}

export interface TeamRow {
  team_name: string;
  participants: number;
  active: number;
  points: number;
  points_per_person: number;
  kg: number;
  is_mine: boolean;
}

/** Classement des équipes en points par participant (depuis une date, ou depuis le début). */
export async function getTeamRanking(supabase: SupabaseClient, since: string | null) {
  const { data } = await supabase.rpc("team_stats", { p_since: since });
  const teams = ((data ?? []) as TeamRow[]).map((t) => ({
    ...t,
    points_per_person: Number(t.points_per_person),
    kg: Number(t.kg),
  }));
  const mineIndex = teams.findIndex((t) => t.is_mine);
  return { teams, mine: mineIndex >= 0 ? { rank: mineIndex + 1, row: teams[mineIndex] } : null };
}

export type QuestKey = "preuve" | "defi" | "expert" | "lancer" | "scan" | "meilleur_choix" | "bravo" | "cap" | "quiz";

/** La graine mystère du jour : à ouvrir, ou déjà ouverte (avec ce qu'elle a donné). */
export type SeedState = { state: "ready" } | { state: "opened"; plant: string | null; points: number } | null;

export interface DailyState {
  /** Les 3 quêtes du jour, dans l'ordre. */
  order: QuestKey[];
  quests: Partial<Record<QuestKey, boolean>>;
  questDone: boolean;
  /** Jours actifs consécutifs. */
  streak: number;
  /** Pousses de bonus créditées à l'instant. */
  gained: number;
  seed: SeedState;
}

/** Relève les quêtes du jour et la série ; la base crédite les bonus dus, une seule fois. */
export async function claimDailyRewards(supabase: SupabaseClient): Promise<DailyState | null> {
  const { data, error } = await supabase.rpc("claim_daily_rewards");
  if (error || !data) return null;
  const d = data as {
    order: QuestKey[];
    quests: DailyState["quests"];
    quest_done: boolean;
    streak: number;
    gained: number;
    seed: SeedState;
  };
  return { order: d.order ?? [], quests: d.quests, questDone: d.quest_done, streak: d.streak, gained: d.gained, seed: d.seed ?? null };
}
