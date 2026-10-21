import Link from "next/link";
import { cookies } from "next/headers";
import { requireHabits } from "@/lib/session";
import { GESTES, TEMPLATE_BY_ID, formatKg } from "@/lib/co2/challenges.ts";
import { relativeTime } from "@/lib/dates";
import { INTRO_COOKIE, PROOF_BUCKET } from "@/lib/constants";
import { claimDailyRewards } from "@/lib/engagement-data";
import { IntroCard } from "@/components/IntroCard";
import { TeamWeekCard } from "@/components/TeamWeekCard";
import type { TeamWeek } from "@/lib/team";
import { parisOffset } from "@/lib/dates";
import { getDuels, getQuiz, getWeeklyGoal } from "@/lib/game/data.ts";
import { QuizPopup } from "@/components/QuizPopup";
import { duelKindForTemplate } from "@/lib/game/labels.ts";
import { actionTitle } from "@/lib/actions-catalog";
import { cancelChallenge, reportPost, setFeedSharing, toggleCheer } from "./actions";
import { ActiveChallenges } from "@/components/ActiveChallenges";
import { DuelStrip } from "@/components/DuelStrip";
import { formatDay, todayParis } from "@/lib/dates";

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

const AVATAR = ["#b9d3e8", "#f0a97b", "#d7e3c8", "#f6d9a8", "#e3c9e8", "#ecddbb"];
const avatarColor = (id: string) => AVATAR[parseInt(id.replace(/-/g, "").slice(-2), 16) % AVATAR.length];

export default async function FilPage({ searchParams }: { searchParams: Promise<{ publie?: string; vue?: string; defi?: string }> }) {
  const { publie, vue, defi } = await searchParams;
  const { supabase, user, profile } = await requireHabits();
  // Tout ce qui crédite des pousses passe avant le total affiché : bonus du jour, défi collectif, duels terminés.
  const [daily, weekly, duels] = await Promise.all([claimDailyRewards(supabase), getWeeklyGoal(supabase), getDuels(supabase)]);

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

  const today = todayParis();
  const [{ data: posts }, { data: myReports }, cookieStore, { data: teamWeek }, { data: mine }, quiz, { data: challengeEvents }] = await Promise.all([
    postsQuery.order("created_at", { ascending: false }).limit(30).returns<Post[]>(),
    supabase.from("reports").select("validation_id").eq("user_id", user.id),
    cookies(),
    profile.team_id ? supabase.rpc("my_team_week") : Promise.resolve({ data: null }),
    supabase
      .from("user_challenges")
      .select("id, template_id, variant, target, ends_on")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gte("ends_on", today)
      .order("ends_on"),
    getQuiz(supabase),
    supabase.rpc("company_challenge_feed", { p_team_only: teamOnly }),
  ]);
  // Mes défis en cours, avec leur avancée et le duel qui leur est lié.
  const challengeIds = (mine ?? []).map((c) => c.id as string);
  const { data: progress } = challengeIds.length
    ? await supabase.from("validations").select("challenge_id, units").in("challenge_id", challengeIds).eq("status", "valid")
    : { data: [] as { challenge_id: string; units: number }[] };
  const activeChallenges = (mine ?? []).map((c) => {
    const t = TEMPLATE_BY_ID[c.template_id as string];
    const duel = duels.find((d) => d.challenge_id === c.id && ["pending", "active"].includes(d.status));
    return {
      id: c.id as string,
      title: t ? actionTitle(t.id, c.variant as string) : "Défi",
      unit: t?.unit ?? { one: "fois", many: "fois" },
      done: (progress ?? []).filter((p) => p.challenge_id === c.id).reduce((s, p) => s + Number(p.units), 0),
      target: Number(c.target),
      endsOn: formatDay(c.ends_on as string, "short"),
      duel: duel ? { other: duel.other_name, theirs: duel.theirs, status: duel.status } : null,
    };
  });
  const week = teamWeek as TeamWeek | null;
  const at = (local: string) => new Date(`${local}${parisOffset(new Date(`${local}Z`))}`).getTime();
  const voteOpen = !!week && week.phase === "open" && Date.now() < at(week.closes_at);
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

  return (
    <>
      {quiz?.current ? <QuizPopup quiz={quiz} day={today} /> : null}
      {defi ? (
        <p role="status" className="rounded-2xl bg-sauge px-4 py-3 text-sm font-bold text-[#2e3a22]">
          Défi lancé ! Il est juste en dessous : enregistre chaque fois que tu le fais avec le bouton +.
        </p>
      ) : null}
      {publie ? (
        <p role="status" className="rounded-2xl bg-sauge px-4 py-3 text-sm font-bold text-[#2e3a22]">
          Publié ! Tes collègues peuvent maintenant t&apos;encourager.
        </p>
      ) : null}
      {showIntro ? <IntroCard /> : null}
      {daily && daily.gained > 0 ? (
        <p role="status" className="animate-pousse-pop rounded-2xl bg-abricot px-4 py-3 text-sm font-bold text-[#402a16]">
          Bonus débloqué : +{daily.gained} pousses{daily.questDone ? " pour tes quêtes du jour" : ""} !
        </p>
      ) : null}
      {weekly && weekly.gained > 0 ? (
        <p role="status" className="animate-pousse-pop rounded-2xl bg-abricot px-4 py-3 text-sm font-bold text-[#402a16]">
          Défi collectif réussi : +{weekly.gained} pousses pour toi !
        </p>
      ) : null}


      {week ? <TeamWeekCard week={week} voteOpen={voteOpen} /> : null}

      <DuelStrip duels={duels.filter((d) => d.status === "pending" && d.role === "opponent")} />

      <ActiveChallenges items={activeChallenges} cancel={cancelChallenge} />

      {!profile.feed_choice_at ? (
        <section aria-labelledby="partage" className="flex flex-col gap-2.5 rounded-[18px] border-2 border-sapin bg-papier p-4">
          <h2 id="partage" className="font-display text-lg font-bold">Nouveau : le fil montre tout ce que vous faites</h2>
          <p className="text-sm text-brun">
            Tes actions et tes défis (lancés, réussis) apparaissent dans le fil de l&apos;entreprise, pour que tes collègues
            puissent t&apos;encourager ou essayer aussi. Rien de ce que tu as fait avant n&apos;est publié, et tes reçus
            d&apos;achat restent privés. Tu peux changer d&apos;avis dans ton profil.
          </p>
          <form action={setFeedSharing} className="flex gap-2">
            <button name="share" value="oui" className="btn-dark min-h-11 flex-1 text-sm">D&apos;accord, je partage</button>
            <button name="share" value="non" className="btn-ghost min-h-11 flex-1 text-sm">Garder pour moi</button>
          </form>
        </section>
      ) : null}

      <div id="publications" className="mt-0.5 flex scroll-mt-4 items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold">Fil d&apos;actu</h2>
        {profile.team_id ? (
          <nav aria-label="Filtrer le fil" className="flex gap-1.5">
            {[
              { id: "entreprise", label: "Entreprise", href: "/fil", on: !teamOnly },
              { id: "equipe", label: "Mon équipe", href: "/fil?vue=equipe", on: teamOnly },
            ].map((f) => (
              <Link
                key={f.id}
                href={f.href}
                aria-current={f.on ? "page" : undefined}
                className={`flex h-[34px] items-center rounded-full px-3 text-xs ${
                  f.on ? "bg-encre font-bold text-[#f7f1e3]" : "border border-[#cdbf9f] font-semibold text-encre"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      {(posts ?? []).length === 0 && events.length === 0 ? (
        <section className="flex flex-col gap-3 rounded-[18px] bg-papier p-4 text-center">
          <p className="font-display text-lg font-bold">Le fil est encore calme</p>
          <p className="text-sm text-brun">
            Enregistre une action avec le bouton + : elle apparaît ici, et tes collègues suivront.
          </p>
          <Link href="/agir" className="btn-dark">Enregistrer une action</Link>
        </section>
      ) : null}

      {timeline.map((item) => {
        if (item.kind === "defi") {
          const e = item.e;
          const t = TEMPLATE_BY_ID[e.template_id];
          const mine = e.user_id === user.id;
          const name = mine ? "Toi" : e.display_name;
          const title = t ? actionTitle(t.id, e.variant) : "Défi";
          const won = e.event === "reussi";
          return (
            <article key={`defi-${e.id}-${e.event}`} className={`flex flex-col gap-2.5 rounded-[18px] p-3.5 ${won ? "bg-[#e3edd9]" : "bg-papier"}`}>
              <div className="flex items-center gap-2.5">
                <Link
                  href={mine ? "/jardin" : `/jardin/${e.user_id}`}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-encre"
                  style={{ background: avatarColor(e.user_id) }}
                  aria-label={`Jardin de ${name}`}
                >
                  {e.display_name.charAt(0).toUpperCase()}
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {name}
                    {e.team_name ? ` · ${e.team_name}` : ""}
                  </p>
                  <p className="truncate text-xs text-[#5e5240]">
                    {won ? (mine ? "as réussi un défi" : "a réussi un défi") : mine ? "as lancé un défi" : "a lancé un défi"} · {relativeTime(e.at)}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold uppercase ${e.duel_with ? "bg-sapin text-sapin-clair" : "bg-sable text-brun"}`}>
                  {e.duel_with ? "Duel" : "Défi"}
                </span>
              </div>
              <p className="text-[15px] leading-snug font-bold">
                {won ? "Objectif atteint : " : ""}
                {title}, {e.target} {t ? (e.target > 1 ? t.unit.many : t.unit.one) : "fois"}
                {e.duel_with ? ` · en duel contre ${e.duel_with}` : ""}
              </p>
              {!won ? (
                <div className="flex items-center gap-2 text-xs text-terre">
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-trait">
                    <span className="block h-full rounded-full bg-sapin" style={{ width: `${Math.min(100, (e.done / Math.max(1, e.target)) * 100)}%` }} />
                  </span>
                  <span className="font-bold">{Math.min(e.done, e.target)}/{e.target}</span>
                  <span>· jusqu&apos;au {formatDay(e.ends_on, "short")}</span>
                </div>
              ) : null}
              {!mine && t ? (
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/defis/nouveau/${t.id}?variante=${e.variant}`}
                    className="flex h-10 items-center rounded-xl border border-[#cdbf9f] px-3.5 text-[13px] font-semibold"
                  >
                    Je relève aussi
                  </Link>
                </div>
              ) : null}
            </article>
          );
        }
        const p = item.p;
        const t = TEMPLATE_BY_ID[p.template_id];
        const postCheers = (cheers ?? []).filter((c) => c.validation_id === p.id);
        const cheered = postCheers.some((c) => c.user_id === user.id);
        const url = p.proof_photo_path ? photoUrl.get(p.proof_photo_path) : undefined;
        const mine = p.user_id === user.id;
        const name = mine ? "Toi" : (p.author?.display_name ?? "Un collègue");
        const title = t ? actionTitle(t.id, p.variant) : "Action";
        return (
          <article key={p.id} className="flex flex-col gap-2.5 rounded-[18px] bg-papier p-3.5">
            <div className="flex items-center gap-2.5">
              <Link
                href={mine ? "/jardin" : `/jardin/${p.user_id}`}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-encre"
                style={{ background: avatarColor(p.user_id) }}
                aria-label={`Jardin de ${name}`}
              >
                {(p.author?.display_name ?? "?").charAt(0).toUpperCase()}
              </Link>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {name}
                  {p.team?.name ? ` · ${p.team.name}` : ""}
                </p>
                <p className="truncate text-xs text-[#5e5240]">
                  {title} · {relativeTime(p.created_at)}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[#e3edd9] px-2 py-1 text-xs font-bold text-[#22502c]">
                {Number(p.kg) > 0 ? `−${formatKg(Number(p.kg))}` : `+${p.points} pousses`}
              </span>
              {!mine ? (
                <form action={reportPost}>
                  <input type="hidden" name="validation" value={p.id} />
                  <button
                    type="submit"
                    disabled={reported.has(p.id)}
                    aria-label={reported.has(p.id) ? "Publication signalée" : "Signaler cette publication"}
                    className="-mr-1.5 flex size-8 items-center justify-center rounded-full text-[#8c7a55]"
                  >
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill={reported.has(p.id) ? "#c15f2c" : "none"} stroke="currentColor" strokeWidth="2"><path d="M4 22V4c4-2 8 2 12 0v10c-4 2-8-2-12 0" /></svg>
                  </button>
                </form>
              ) : null}
            </div>

            <p className="text-[15px] leading-snug">{p.caption ?? title}</p>

            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={`Photo : ${title}`} className="max-h-72 w-full rounded-xl object-cover" />
            ) : null}
            {reported.has(p.id) ? (
              <p className="text-xs font-semibold text-argile-fonce">Signalé, l&apos;équipe Pousse va vérifier.</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <form action={toggleCheer}>
                <input type="hidden" name="validation" value={p.id} />
                <button
                  type="submit"
                  aria-pressed={cheered}
                  className={`flex h-10 items-center rounded-xl px-3.5 text-[13px] font-bold ${
                    cheered ? "bg-[#22502c] text-[#f7f1e3]" : "bg-[#e3edd9] text-[#22502c]"
                  }`}
                >
                  Bravo · {postCheers.length}
                </button>
              </form>
              {!mine && t ? (
                <Link
                  href={GESTES.some((g) => g.id === t.id) ? "/agir" : `/defis/nouveau/${t.id}?variante=${p.variant}&via=${p.id}`}
                  className="flex h-10 items-center rounded-xl border border-[#cdbf9f] px-3.5 text-[13px] font-semibold"
                >
                  J&apos;essaie aussi
                </Link>
              ) : null}
              {!mine && t ? (
                <Link
                  href={`/duels?avec=${p.user_id}&type=${duelKindForTemplate(t.id)}`}
                  className="flex h-10 items-center rounded-xl border border-[#cdbf9f] px-3.5 text-[13px] font-semibold"
                  aria-label={`Défier ${name} en duel`}
                >
                  Défier
                </Link>
              ) : null}
            </div>
          </article>
        );
      })}
    </>
  );
}
