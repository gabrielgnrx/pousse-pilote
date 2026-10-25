import Link from "next/link";
import { requireProfile } from "@/lib/session";
import { getTeamRanking } from "@/lib/engagement-data";
import { weekStart } from "@/lib/co2/engagement.ts";
import { parisOffset, todayParis } from "@/lib/dates";
import type { TeamWeek } from "@/lib/team";
import { TeamChat, type ChatMessage } from "./TeamChat";

export const metadata = { title: "QG de l'équipe · Pousse" };

const ordinal = (n: number) => (n === 1 ? "1er" : `${n}e`);
const fr = (n: number) => Math.round(n).toLocaleString("fr-FR");
/** Écart de pousses par personne, arrondi à l'unité supérieure (« 1 » plutôt que « 0 »). */
const ecart = (n: number) => {
  const v = Math.max(1, Math.ceil(n));
  return `${v.toLocaleString("fr-FR")} pousse${v > 1 ? "s" : ""}/pers.`;
};

/** Instant réel d'une heure de Paris écrite sans fuseau (« 2026-10-19T14:00:00 »). */
const parisInstant = (local: string) => new Date(`${local}${parisOffset(new Date(`${local}Z`))}`);

export default async function QGPage({ searchParams }: { searchParams: Promise<{ propose?: string }> }) {
  const { propose } = await searchParams;
  const { supabase, user, profile } = await requireProfile();

  const [{ data: team }, ranking, { data: week }, messagesRes, { data: myReports }, { count: members }] = await Promise.all([
    profile.team_id ? supabase.from("teams").select("name").eq("id", profile.team_id).single() : Promise.resolve({ data: null }),
    getTeamRanking(supabase, weekStart(todayParis())),
    supabase.rpc("my_team_week"),
    profile.team_id
      ? supabase
          .from("team_messages")
          .select("id, user_id, body, created_at, author_kind")
          .order("created_at", { ascending: false })
          .limit(80)
          .returns<{ id: string; user_id: string | null; body: string; created_at: string; author_kind: string }[]>()
      : Promise.resolve({ data: [] }),
    supabase.from("team_message_reports").select("message_id").eq("user_id", user.id),
    profile.team_id
      ? supabase.from("profiles").select("id", { count: "exact", head: true }).eq("team_id", profile.team_id)
      : Promise.resolve({ count: 0 }),
  ]);

  // Le podium : les 3 premières équipes de la semaine ; la tienne à la 3e place si elle est plus loin.
  const teams = ranking.teams;
  const mineIndex = teams.findIndex((t) => t.is_mine);
  const podium = teams.slice(0, 3).map((t, i) => ({ ...t, rank: i + 1 }));
  if (mineIndex >= 3) podium[2] = { ...teams[mineIndex], rank: mineIndex + 1 };
  let gap: string | null = null;
  const pp = (i: number) => Number(teams[i].points_per_person);
  if (mineIndex === 0 && teams[1]) gap = `${ecart(pp(0) - pp(1))} d'avance`;
  else if (mineIndex > 0) gap = `à ${ecart(pp(mineIndex - 1) - pp(mineIndex))} du ${ordinal(mineIndex)}`;

  const rows = messagesRes.data;
  // Les prénoms des auteurs, lus à part (les profils des collègues sont lisibles dans l'entreprise).
  const authorIds = [...new Set((rows ?? []).flatMap((m) => (m.user_id ? [m.user_id] : [])))];
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", authorIds)
    : { data: [] as { id: string; display_name: string }[] };
  const nameOf = new Map((authors ?? []).map((a) => [a.id, a.display_name]));

  const w = week as TeamWeek | null;
  const reported = new Set((myReports ?? []).map((r) => r.message_id));
  const messages: ChatMessage[] = (rows ?? [])
    .filter((m) => !reported.has(m.id))
    .reverse()
    .map((m) => ({
      id: m.id,
      mine: m.user_id === user.id,
      fromPousse: m.user_id === null,
      bot: m.author_kind === "animateur",
      author: m.user_id ? (nameOf.get(m.user_id) ?? "Un collègue") : m.author_kind === "animateur" ? "L'animateur Pousse" : "Pousse",
      body: m.body,
      at: m.created_at,
    }));
  const now = Date.now();
  const opensAt = w ? parisInstant(w.opens_at).getTime() : 0;
  const closesAt = w ? parisInstant(w.closes_at).getTime() : 0;

  return (
    <>
      {propose ? (
        <p role="status" className="rounded-2xl bg-sauge px-4 py-3 text-sm font-bold text-[#1f5134]">
          Proposé ! Ton défi sera en tête du vote de lundi prochain, de 9 h à 14 h, ici dans le chat.
        </p>
      ) : null}
      <h1 className="sr-only">{team?.name ? `QG ${team.name}` : "QG de l'équipe"}</h1>
      <p className="-mt-2 text-xs text-terre">
        {members ? `${members} membre${members > 1 ? "s" : ""}` : "Pas encore d'équipe"}
        {mineIndex >= 0 ? ` · ${ordinal(mineIndex + 1)} de l'entreprise cette semaine` : ""}
      </p>

      <section aria-labelledby="classement" className="flex flex-col gap-2.5 rounded-[28px] bg-nuit p-4 text-sapin-clair shadow-[inset_0_-6px_0_#121a12]">
        <div className="flex items-center justify-between">
          <h2 id="classement" className="font-display text-[19px]">Classement des équipes</h2>
          <Link href="/equipes/classement" className="-my-2 flex min-h-11 items-center text-[13px] font-semibold text-feuille">
            Tout voir
          </Link>
        </div>
        {podium.length ? (
          <ol className="flex flex-col gap-0.5">
            {podium.map((t) => (
              <li
                key={t.team_name}
                className={`flex items-center gap-2.5 min-h-11 rounded-[14px] px-2.5 py-1.5 text-sm ${t.is_mine ? "bg-feuille font-semibold text-encre shadow-[inset_0_-3px_0_var(--color-feuille-fonce)]" : ""}`}
              >
                <span className={`w-7 font-bold ${t.is_mine ? "text-sapin" : "text-[#c3cfbe]"}`}>{ordinal(t.rank)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {t.team_name}
                  {t.is_mine ? " · vous" : ""}
                </span>
                <span className={`shrink-0 text-xs ${t.is_mine && gap ? "font-bold text-argile-fonce" : "font-bold"}`}>
                  {t.is_mine && gap ? gap : `${fr(Number(t.points_per_person))} /pers.`}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-[#e3dccb]">Le classement apparaît dès qu&apos;une équipe compte 5 participants.</p>
        )}
      </section>

      {profile.team_id && w ? (
        <TeamChat
          week={w}
          messages={messages}
          voteOpen={now >= opensAt && now < closesAt && w.phase !== "closed"}
          minutesLeft={Math.max(0, Math.round((closesAt - now) / 60000))}
          voteAt={new Date(opensAt).toISOString()}
        />
      ) : (
        <section className="card flex flex-col gap-2 text-sm">
          <p className="font-bold">Le QG est réservé aux membres d&apos;une équipe.</p>
          <p className="text-brun">Demande à la personne qui pilote Pousse dans ton entreprise de t&apos;ajouter à une équipe.</p>
        </section>
      )}
    </>
  );
}
