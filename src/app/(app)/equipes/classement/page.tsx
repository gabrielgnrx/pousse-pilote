import Link from "next/link";
import { requireProfile } from "@/lib/session";
import { formatKg } from "@/lib/co2/challenges.ts";
import { todayParis } from "@/lib/dates";
import { weekStart } from "@/lib/co2/engagement.ts";
import { getCollectiveGoal, getEngagement, getTeamRanking } from "@/lib/engagement-data";
import { GoalCard } from "@/components/GoalCard";
import { WeeklyGoalCard } from "@/components/WeeklyGoalCard";
import { DuelStrip } from "@/components/DuelStrip";
import { getDuels, getWeeklyGoal } from "@/lib/game/data.ts";

export const metadata = { title: "Classement des équipes · Pousse" };

export default async function ClassementPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const { periode } = await searchParams;
  const week = periode !== "total";
  const since = week ? weekStart(todayParis()) : null;
  const { supabase, user } = await requireProfile();

  const [{ teams }, goal, me, weekly, duels] = await Promise.all([
    getTeamRanking(supabase, since),
    getCollectiveGoal(supabase),
    getEngagement(supabase, user.id),
    getWeeklyGoal(supabase),
    getDuels(supabase),
  ]);

  return (
    <>
      <Link href="/equipes" className="flex h-11 items-center gap-1 self-start rounded-full bg-papier pr-4 pl-3 text-sm font-bold">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
        Retour au QG
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Classement des équipes</h1>
          <p className="mt-1 text-sm text-terre">Le total des pousses de tous les membres de chaque équipe.</p>
        </div>
        <Link href="/regles" className="mt-1 shrink-0 text-xs font-bold underline underline-offset-2">Comment ça marche ?</Link>
      </div>

      <nav aria-label="Période" className="flex rounded-full bg-sable p-1">
        {[
          { id: "semaine", label: "Cette semaine", on: week },
          { id: "total", label: "Depuis le début", on: !week },
        ].map((t) => (
          <Link
            key={t.id}
            href={t.id === "total" ? "/equipes/classement?periode=total" : "/equipes/classement"}
            aria-current={t.on ? "page" : undefined}
            className={`flex h-10 flex-1 items-center justify-center rounded-full text-sm font-bold ${t.on ? "bg-sapin text-sapin-clair" : "text-brun"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {teams.length === 0 ? (
        <p className="card text-sm">
          Le classement apparaît dès qu&apos;une équipe compte 5 participants, pour que personne ne soit
          identifiable. En attendant, tes pousses comptent déjà.
        </p>
      ) : (
        <ol className="card flex flex-col divide-y divide-encre/10 p-0">
          {teams.map((t, i) => (
            <li key={t.team_name} className={`flex items-center gap-3 px-4 py-3 ${t.is_mine ? "bg-peche" : ""}`}>
              <span className="w-6 font-display text-lg font-bold">{i + 1}</span>
              <div className="flex-1">
                <p className="font-bold">
                  {t.team_name}
                  {t.is_mine ? <span className="ml-2 text-xs font-semibold text-argile-fonce">ton équipe</span> : null}
                </p>
                <p className="text-xs text-terre">
                  {t.active}/{t.participants} actifs · {formatKg(t.kg)} de CO₂ évités
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-xl font-bold">{t.points.toLocaleString("fr-FR")}</p>
                <p className="text-[11px] text-terre">pousses au total</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <section className="flex items-center gap-4 rounded-[20px] bg-sapin p-4 text-sapin-clair">
        <div className="flex-1">
          <p className="text-[11px] font-bold tracking-wider uppercase">Toi, {week ? "cette semaine" : "depuis le début"}</p>
          <p className="mt-1">
            <span className="font-display text-3xl font-bold">{week ? me.week.points : me.points.total}</span>
            <span className="ml-1 text-sm font-semibold">pousses</span>
          </p>
          <p className="text-xs opacity-90">
            et {formatKg(week ? me.week.kg : me.kgAvoided)} de CO₂ évités
          </p>
        </div>
        <Link href="/agir" className="btn-primary min-h-11 shrink-0 px-4 text-sm">Gagner des pousses</Link>
      </section>

      <h2 className="mt-1 font-display text-xl font-bold">Duels</h2>
      <DuelStrip duels={duels} />
      <Link href="/duels" className="flex items-center gap-3 rounded-[18px] border border-encre/10 bg-papier px-4 py-3">
        <span aria-hidden="true" className="font-display text-xl">⚔</span>
        <span className="flex-1">
          <span className="block text-sm font-bold">Défier un collègue</span>
          <span className="block text-xs text-terre">Une autre équipe, 7 jours, des pousses à gagner… ou à perdre</span>
        </span>
        <span className="text-sm font-bold">›</span>
      </Link>

      <h2 className="mt-1 font-display text-xl font-bold">Toute l&apos;entreprise</h2>
      {weekly ? <WeeklyGoalCard goal={weekly} /> : null}
      {goal ? (
        <section className="card flex flex-col gap-2">
          <p className="label">L&apos;impact de toute l&apos;entreprise</p>
          <GoalCard goal={goal} />
        </section>
      ) : null}

      <p className="rounded-2xl bg-sauge px-4 py-3 text-xs leading-relaxed text-[#2e3a22]">
        Ton employeur voit les totaux par équipe, jamais ton nom ni tes défis. Les équipes de moins de 5
        participants sont regroupées ou masquées.
      </p>
    </>
  );
}
