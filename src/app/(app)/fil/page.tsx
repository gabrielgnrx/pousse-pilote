import Link from "next/link";
import { cookies } from "next/headers";
import { requireHabits } from "@/lib/session";
import { GESTES, TEMPLATE_BY_ID, formatKg } from "@/lib/co2/challenges.ts";
import { dayLabel, formatDay, parisDay, relativeTime, todayParis } from "@/lib/dates";
import { INTRO_COOKIE, PROOF_BUCKET } from "@/lib/constants";
import { claimDailyRewards } from "@/lib/engagement-data";
import { IntroCard } from "@/components/IntroCard";
import { getDuels } from "@/lib/game/data.ts";
import { CompanyHero, type CompanyPulse } from "@/components/CompanyHero";
import { InstallPrompt } from "@/components/InstallPrompt";
import { duelKindForTemplate } from "@/lib/game/labels.ts";
import { actionTitle } from "@/lib/actions-catalog";
import { reportPost, toggleCheer } from "./actions";
import { ActionPost, ChallengePost, DayMarker, FeedStem, StemNote } from "@/components/Feed";

interface Post {
  id: string;
  user_id: string;
  template_id: string;
  variant: string;
  kg: number;
  points: number;
  caption: string | null;
  proof_photo_path: string | null;
  witness_status: string;
  created_at: string;
  author: { display_name: string } | null;
  team: { name: string } | null;
}

export default async function FilPage({ searchParams }: { searchParams: Promise<{ publie?: string; vue?: string }> }) {
  const { publie, vue } = await searchParams;
  const { supabase, user, profile } = await requireHabits();
  // Tout ce qui crédite des pousses passe avant le total affiché : bonus du jour, duels terminés
  // (getDuels solde les duels finis). Les défis et les duels eux-mêmes s'affichent dans Mon plan.
  const [daily] = await Promise.all([claimDailyRewards(supabase), getDuels(supabase)]);

  const teamOnly = vue === "equipe" && !!profile.team_id;
  let postsQuery = supabase
    .from("validations")
    .select(
      "id, user_id, template_id, variant, kg, points, caption, proof_photo_path, witness_status, created_at, author:profiles!validations_user_id_fkey(display_name), team:teams(name)",
    )
    .eq("company_id", profile.company_id)
    .eq("visibility", "company")
    .eq("status", "valid");
  if (teamOnly) postsQuery = postsQuery.eq("team_id", profile.team_id as string);

  const [{ data: posts }, { data: myReports }, cookieStore, { data: pulse }, { data: challengeEvents }] = await Promise.all([
    postsQuery.order("created_at", { ascending: false }).limit(30).returns<Post[]>(),
    supabase.from("reports").select("validation_id").eq("user_id", user.id),
    cookies(),
    supabase.rpc("company_pulse"),
    supabase.rpc("company_challenge_feed", { p_team_only: teamOnly }),
  ]);
  const showIntro = !cookieStore.get(INTRO_COOKIE);

  const ids = (posts ?? []).map((p) => p.id);
  const { data: cheers } = ids.length
    ? await supabase.from("cheers").select("validation_id, user_id").in("validation_id", ids)
    : { data: [] as { validation_id: string; user_id: string }[] };
  const photoPaths = (posts ?? []).flatMap((p) => (p.proof_photo_path ? [p.proof_photo_path] : []));
  const { data: signed } = photoPaths.length
    ? await supabase.storage.from(PROOF_BUCKET).createSignedUrls(photoPaths, 3600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const photoUrl = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  // Le fil : les actions enregistrées et les défis lancés ou réussis, du plus récent au plus ancien.
  type ChallengeEvent = {
    id: string;
    user_id: string;
    display_name: string;
    team_name: string | null;
    template_id: string;
    variant: string;
    target: number;
    done: number;
    status: string;
    event: "lance" | "reussi";
    at: string;
    duel_with: string | null;
    ends_on: string;
  };
  const events = (challengeEvents ?? []) as ChallengeEvent[];
  const timeline = [
    ...(posts ?? []).map((p) => ({ kind: "action" as const, at: p.created_at, p })),
    ...events.map((e) => ({ kind: "defi" as const, at: e.at, e })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const reported = new Set((myReports ?? []).map((r) => r.validation_id));

  // Un repère « Aujourd'hui », « Hier »… sur la tige à chaque changement de jour.
  const withDays: (
    | { kind: "jour"; key: string; label: string }
    | (typeof timeline)[number]
  )[] = [];
  let lastDay = "";
  for (const item of timeline) {
    const day = parisDay(item.at);
    if (day !== lastDay) {
      withDays.push({ kind: "jour", key: `jour-${day}`, label: dayLabel(item.at) });
      lastDay = day;
    }
    withDays.push(item);
  }
  type Note = { title: string; detail?: string };
  const notes = ([
    publie ? { title: "Publié ! Tes collègues peuvent maintenant t'encourager." } : null,
    daily && daily.gained > 0
      ? { title: "Bonus du jour débloqué", detail: `+${daily.gained} pousses${daily.questDone ? " pour tes quêtes" : ""}` }
      : null,
  ] as (Note | null)[]).filter((n): n is Note => n !== null);
  const empty = (posts ?? []).length === 0 && events.length === 0;
  // Les bonus et confirmations se rangent sous « Aujourd'hui », avant les publications du jour.
  const firstIsToday = timeline.length > 0 && parisDay(timeline[0].at) === todayParis();
  const notesUnderFirst = notes.length > 0 && firstIsToday;
  const rest = notesUnderFirst ? withDays.slice(1) : withDays;

  return (
    <>
      <h1 className="sr-only">Accueil</h1>
      {showIntro ? <IntroCard /> : null}
      {pulse ? <CompanyHero pulse={pulse as CompanyPulse} /> : null}
      <InstallPrompt />

      <div id="publications" className="-mx-4 flex scroll-mt-4 items-center justify-between gap-2 border-t border-trait px-4 pt-4">
        <h2 className="font-display text-xl">Fil d&apos;actu</h2>
        {profile.team_id ? (
          <nav aria-label="Filtrer le fil" className="flex rounded-full bg-sable p-[3px]">
            {[
              { id: "entreprise", label: "Entreprise", href: "/fil", on: !teamOnly },
              { id: "equipe", label: "Mon équipe", href: "/fil?vue=equipe", on: teamOnly },
            ].map((f) => (
              <Link
                key={f.id}
                href={f.href}
                aria-current={f.on ? "page" : undefined}
                className={`flex h-[34px] items-center rounded-full px-3 text-[13px] ${
                  f.on ? "bg-papier font-bold text-encre" : "font-semibold text-brun"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      <FeedStem>
        {notes.length > 0 ? <DayMarker label="Aujourd'hui" /> : null}
        {notes.map((n) => (
          <StemNote key={n.title} title={n.title} detail={n.detail} />
        ))}

        {empty ? (
          <li className="flex gap-3.5">
            <span className="w-[38px] shrink-0" />
            <section className="flex flex-1 flex-col gap-3 rounded-[20px] bg-papier p-4 text-center">
              <p className="font-display text-lg">Le fil est encore calme</p>
              <p className="text-sm text-brun">Enregistre une action avec le bouton + : elle apparaît ici, et tes collègues suivront.</p>
              <Link href="/agir" className="btn-primary">Enregistrer une action</Link>
            </section>
          </li>
        ) : null}

        {rest.map((item) => {
          if (item.kind === "jour") return <DayMarker key={item.key} label={item.label} />;
          if (item.kind === "defi") {
            const e = item.e;
            const t = TEMPLATE_BY_ID[e.template_id];
            const mine = e.user_id === user.id;
            const won = e.event === "reussi";
            return (
              <ChallengePost
                key={`defi-${e.id}-${e.event}`}
                userId={e.user_id}
                name={mine ? "Toi" : e.display_name}
                authorName={e.display_name}
                teamName={e.team_name}
                verb={won ? (mine ? "as réussi un défi" : "a réussi un défi") : mine ? "as lancé un défi" : "a lancé un défi"}
                when={relativeTime(e.at)}
                title={`${won ? "Objectif atteint : " : ""}${t ? actionTitle(t.id, e.variant) : "Défi"}, ${e.target} ${t ? (e.target > 1 ? t.unit.many : t.unit.one) : "fois"}${e.duel_with ? ` · en duel contre ${e.duel_with}` : ""}`}
                isDuel={!!e.duel_with}
                won={won}
                done={e.done}
                target={e.target}
                until={formatDay(e.ends_on, "short")}
                joinHref={!mine && t ? `/defis/nouveau/${t.id}?variante=${e.variant}` : undefined}
                mine={mine}
              />
            );
          }
          const p = item.p;
          const t = TEMPLATE_BY_ID[p.template_id];
          const postCheers = (cheers ?? []).filter((c) => c.validation_id === p.id);
          const mine = p.user_id === user.id;
          const name = mine ? "Toi" : (p.author?.display_name ?? "Un collègue");
          const title = t ? actionTitle(t.id, p.variant) : "Action";
          return (
            <ActionPost
              key={p.id}
              id={p.id}
              userId={p.user_id}
              name={name}
              authorName={p.author?.display_name ?? "?"}
              teamName={p.team?.name ?? null}
              title={title}
              when={relativeTime(p.created_at)}
              caption={p.caption ?? title}
              gain={Number(p.kg) > 0 ? `−${formatKg(Number(p.kg))}` : `+${p.points} pousses`}
              photoUrl={(p.proof_photo_path ? photoUrl.get(p.proof_photo_path) : null) ?? undefined}
              cheers={postCheers.length}
              cheered={postCheers.some((c) => c.user_id === user.id)}
              mine={mine}
              reported={reported.has(p.id)}
              tryHref={
                !mine && t ? (GESTES.some((g) => g.id === t.id) ? "/agir" : `/defis/nouveau/${t.id}?variante=${p.variant}&via=${p.id}`) : undefined
              }
              duelHref={!mine && t ? `/duels?avec=${p.user_id}&type=${duelKindForTemplate(t.id)}` : undefined}
              cheerAction={toggleCheer}
              reportAction={reportPost}
            />
          );
        })}
      </FeedStem>
    </>
  );
}
