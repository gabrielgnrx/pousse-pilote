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

/** Instant réel d'une heure de Paris écrite sans fuseau (« 2026-10-19T14:00:00 »). */
const parisInstant = (local: string) => new Date(`${local}${parisOffset(new Date(`${local}Z`))}`);

export default async function QGPage() {
  const { supabase, user, profile } = await requireProfile();

  const [{ data: team }, ranking, { data: week }, messagesRes, { data: myReports }, { count: members }] = await Promise.all([
    profile.team_id ? supabase.from("teams").select("name").eq("id", profile.team_id).single() : Promise.resolve({ data: null }),
    getTeamRanking(supabase, weekStart(todayParis())),
    supabase.rpc("my_team_week"),
    profile.team_id
      ? supabase
          .from("team_messages")
          .select("id, user_id, body, created_at")
          .order("created_at", { ascending: false })
          .limit(80)
          .returns<{ id: string; user_id: string | null; body: string; created_at: string }[]>()
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
  if (mineIndex === 0 && teams[1]) gap = `${fr(teams[0].points_per_person - teams[1].points_per_person)} d'avance`;
  else if (mineIndex > 0) gap = `à ${fr(teams[mineIndex - 1].points_per_person - teams[mineIndex].points_per_person)} du ${ordinal(mineIndex)}`;

  const rows = messagesRes.data;
  const chatError = "error" in messagesRes && messagesRes.error ? messagesRes.error.message : null;
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
      author: m.user_id ? (nameOf.get(m.user_id) ?? "Un collègue") : "Pousse",
      body: m.body,
      at: m.created_at,
    }));
  const now = Date.now();
  const opensAt = w ? parisInstant(w.opens_at).getTime() : 0;
  const closesAt = w ? parisInstant(w.closes_at).getTime() : 0;

  return (
    <>
      <section className="-mt-1 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl leading-tight font-bold">{team?.name ? `QG ${team.name}` : "QG de l'équipe"}</h1>
            <p className="text-xs text-terre">
              {members ? `${members} membre${members > 1 ? "s" : ""}` : "Pas encore d'équipe"}
              {mineIndex >= 0 ? ` · ${ordinal(mineIndex + 1)} de l'entreprise cette semaine` : ""}
            </p>
          </div>
          <Link
            href="/equipes/classement"
            className="flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-sapin px-4 text-sm font-bold text-sapin-clair shadow-sm active:scale-95"
          >
            Classement complet
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
          </Link>
        </div>

        {podium.length ? (
          <Link href="/equipes/classement" aria-label="Voir le classement complet" className="grid grid-cols-3 gap-1.5">
            {podium.map((t) => (
              <span
                key={t.team_name}
                className={`flex flex-col gap-px rounded-2xl px-2.5 py-2 ${t.is_mine ? "bg-[#2f5b36] text-[#f7f1e3]" : "bg-papier"}`}
              >
                <span className={`text-[11px] font-bold ${t.is_mine ? "text-[#cfe3c4]" : t.rank === 1 ? "text-[#8a6a1a]" : "text-terre"}`}>
                  {ordinal(t.rank)}
                  {t.is_mine ? " · vous" : ""}
                </span>
                <span className="truncate text-sm font-bold">{t.team_name}</span>
                <span className={`text-xs ${t.is_mine && gap ? "font-bold text-abricot" : t.is_mine ? "text-[#ddebd3]" : "text-terre"}`}>
                  {t.is_mine && gap ? gap : `${fr(t.points_per_person)} pousses/pers.`}
                </span>
              </span>
            ))}
          </Link>
        ) : (
          <Link href="/equipes/classement" className="rounded-2xl bg-papier px-4 py-3 text-sm">
            Le classement apparaît dès qu&apos;une équipe compte 5 participants. <strong className="underline">Voir le détail</strong>
          </Link>
        )}
      </section>

      {chatError ? <p hidden data-chat-error={chatError} /> : null}
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
