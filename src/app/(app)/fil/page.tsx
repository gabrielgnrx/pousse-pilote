import Link from "next/link";
import { requireHabits } from "@/lib/session";
import { TEMPLATE_BY_ID, CATEGORY_LABEL, formatKg } from "@/lib/co2/challenges.ts";
import { relativeTime } from "@/lib/dates";
import { PROOF_BUCKET } from "@/lib/constants";
import { getDailyGoodNews } from "@/lib/news";
import { cookies } from "next/headers";
import { claimDailyRewards, getCollectiveGoal, getEngagement, getTeamRanking } from "@/lib/engagement-data";
import { nextStreakMilestone, weekStart } from "@/lib/co2/engagement.ts";
import { todayParis } from "@/lib/dates";
import { INTRO_COOKIE } from "@/lib/constants";
import { WeekSummary } from "@/components/WeekSummary";
import { IntroCard } from "@/components/IntroCard";
import { GardenHero } from "@/components/GardenHero";
import { DailyQuests } from "@/components/DailyQuests";
import { RecentGains } from "@/components/RecentGains";
import { reportPost, toggleCheer } from "./actions";
import { NewsCard } from "./NewsCard";
import { Fragment } from "react";

interface Post {
  id: string;
  user_id: string;
  template_id: string;
  variant: string;
  units: number;
  kg: number;
  points: number;
  caption: string | null;
  proof_photo_path: string | null;
  witness_status: string;
  created_at: string;
  author: { display_name: string } | null;
  witness: { display_name: string } | null;
  team: { name: string } | null;
}

const CATEGORY_TINT: Record<string, string> = {
  transport: "bg-sapin",
  alimentation: "bg-argile",
  consommation: "bg-[#e9c9a3]",
  logement: "bg-abricot",
};

export default async function FilPage({ searchParams }: { searchParams: Promise<{ publie?: string }> }) {
  const { publie } = await searchParams;
  const { supabase, user, profile } = await requireHabits();
  // D'abord les bonus du jour (quêtes, série), pour qu'ils apparaissent dans le total affiché.
  const daily = await claimDailyRewards(supabase);

  const [{ data: posts }, ranking, me, { data: myReports }, news, goal, cookieStore] = await Promise.all([
    supabase
      .from("validations")
      .select(
        "id, user_id, template_id, variant, units, kg, points, caption, proof_photo_path, witness_status, created_at, author:profiles!validations_user_id_fkey(display_name), witness:profiles!validations_witness_id_fkey(display_name), team:teams(name)",
      )
      .eq("company_id", profile.company_id)
      .eq("visibility", "company")
      .eq("status", "valid")
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<Post[]>(),
    getTeamRanking(supabase, weekStart(todayParis())),
    getEngagement(supabase, user.id),
    supabase.from("reports").select("validation_id").eq("user_id", user.id),
    getDailyGoodNews(),
    getCollectiveGoal(supabase),
    cookies(),
  ]);
  const showIntro = !cookieStore.get(INTRO_COOKIE);
  // Une bonne nouvelle toutes les 2 publications ; le reste en fin de fil.
  const NEWS_EVERY = 2;
  const postCount = (posts ?? []).length;
  const leftoverNews = news.slice(Math.floor(postCount / NEWS_EVERY));

  const ids = (posts ?? []).map((p) => p.id);
  const { data: cheers } = ids.length
    ? await supabase.from("cheers").select("validation_id, user_id").in("validation_id", ids)
    : { data: [] as { validation_id: string; user_id: string }[] };
  const photoPaths = (posts ?? []).flatMap((p) => (p.proof_photo_path ? [p.proof_photo_path] : []));
  const { data: signed } = photoPaths.length
    ? await supabase.storage.from(PROOF_BUCKET).createSignedUrls(photoPaths, 3600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const photoUrl = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const reported = new Set((myReports ?? []).map((r) => r.validation_id));


  return (
    <>
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

      <GardenHero
        total={me.points.total}
        week={me.week.points}
        streak={daily?.streak ?? 0}
        nextMilestone={nextStreakMilestone(daily?.streak ?? 0)}
      />

      {daily ? <DailyQuests daily={daily} /> : null}

      <RecentGains items={me.recent.slice(0, 4)} />

      <WeekSummary team={ranking.mine} teamsCount={ranking.teams.length} goal={goal} />

      {(posts ?? []).length === 0 ? (
        <section className="card flex flex-col gap-3 text-center">
          <p className="font-display text-lg font-bold">Le fil est encore calme</p>
          <p className="text-sm text-brun">Relève un premier défi et partage-le : tes collègues suivront.</p>
          <Link href="/defis?onglet=catalogue" className="btn-primary">Choisir un défi</Link>
        </section>
      ) : null}

      {(posts ?? []).map((p, i) => {
        const t = TEMPLATE_BY_ID[p.template_id];
        const variant = t?.variants.find((v) => v.key === p.variant);
        const postCheers = (cheers ?? []).filter((c) => c.validation_id === p.id);
        const cheered = postCheers.some((c) => c.user_id === user.id);
        const url = p.proof_photo_path ? photoUrl.get(p.proof_photo_path) : undefined;
        const name = p.author?.display_name ?? "Un collègue";
        const proofs = [
          p.proof_photo_path ? "Photo" : null,
          p.witness_status === "confirmed" ? `Confirmé par ${p.witness?.display_name ?? "un collègue"}` : null,
          p.witness_status === "pending" ? "Confirmation en attente" : null,
        ].filter(Boolean);
        const newsAfter = (i + 1) % NEWS_EVERY === 0 ? news[(i + 1) / NEWS_EVERY - 1] : undefined;
        return (
          <Fragment key={p.id}>
          <article className="overflow-hidden rounded-[20px] border border-encre/10 bg-papier">
            <div className={`h-2 ${t ? CATEGORY_TINT[t.category] : "bg-sable"}`} />
            <div className="flex flex-col gap-2 p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-sauge font-display font-bold">
                  {name.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-bold">{p.user_id === user.id ? "Toi" : name}</p>
                  <p className="text-xs text-terre">
                    {p.team?.name ? `Équipe ${p.team.name} · ` : ""}
                    {relativeTime(p.created_at)}
                  </p>
                </div>
                {p.user_id !== user.id ? (
                  <form action={reportPost}>
                    <input type="hidden" name="validation" value={p.id} />
                    <button
                      type="submit"
                      disabled={reported.has(p.id)}
                      aria-label={reported.has(p.id) ? "Publication signalée" : "Signaler cette publication"}
                      className="flex size-10 items-center justify-center rounded-full text-terre"
                    >
                      <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill={reported.has(p.id) ? "#c15f2c" : "none"} stroke="currentColor" strokeWidth="2"><path d="M4 22V4c4-2 8 2 12 0v10c-4 2-8-2-12 0" /></svg>
                    </button>
                  </form>
                ) : null}
              </div>

              <h2 className="font-display text-lg leading-snug font-bold">
                {t?.title ?? "Défi"}
                {t && t.variants.length > 1 && variant ? ` · ${variant.label}` : ""}
              </h2>
              {p.caption ? <p className="text-sm leading-relaxed text-brun">{p.caption}</p> : null}

              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={`Preuve : ${t?.title ?? "défi"}`} className="mt-1 max-h-72 w-full rounded-xl object-cover" />
              ) : null}

              <div className="flex flex-wrap gap-2">
                <span className="chip bg-peche">+{p.points} pousses</span>
                <span className="chip bg-sauge">−{formatKg(Number(p.kg))} CO₂</span>
                <span className="chip bg-creme font-semibold">
                  {p.units} {p.units > 1 ? t?.unit.many : t?.unit.one} · {t ? CATEGORY_LABEL[t.category] : ""}
                </span>
                {proofs.map((pr) => (
                  <span key={pr} className="chip bg-peche">{pr}</span>
                ))}
              </div>
              {reported.has(p.id) ? (
                <p className="text-xs font-semibold text-argile-fonce">Signalé, l&apos;équipe Pousse va vérifier.</p>
              ) : null}

              <div className="mt-1 flex items-center gap-2">
                <form action={toggleCheer}>
                  <input type="hidden" name="validation" value={p.id} />
                  <button
                    type="submit"
                    aria-pressed={cheered}
                    className={`flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold ${cheered ? "bg-argile text-white" : "bg-creme text-brun"}`}
                  >
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill={cheered ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>
                    Bravo · {postCheers.length}
                  </button>
                </form>
                {p.user_id !== user.id && t ? (
                  <Link href={`/defis/nouveau/${t.id}?variante=${p.variant}&via=${p.id}`} className="flex h-10 items-center rounded-full bg-sable px-3.5 text-sm font-bold">
                    Relever aussi
                  </Link>
                ) : null}
              </div>
            </div>
          </article>
          {newsAfter ? <NewsCard item={newsAfter} /> : null}
          </Fragment>
        );
      })}

      {leftoverNews.length > 0 ? (
        <>
          {postCount > 0 ? null : (
            <h2 className="mt-2 font-display text-lg font-bold">Les bonnes nouvelles du jour</h2>
          )}
          {leftoverNews.map((n) => (
            <NewsCard key={n.link} item={n} />
          ))}
        </>
      ) : null}

      <Link href="/avis" className="flex items-center gap-3 rounded-[20px] bg-peche p-4">
        <span className="flex-1">
          <span className="block text-sm font-bold">30 secondes pour améliorer Pousse ?</span>
          <span className="block text-xs text-[#5a4324]">3 questions sur ta semaine</span>
        </span>
        <span className="btn-primary min-h-10 px-4 text-sm">Répondre</span>
      </Link>
      <p className="text-center text-xs text-terre">
        Seuls tes collègues voient tes publications. Les bonnes nouvelles viennent de {news.length > 0 ? [...new Set(news.map((n) => n.source))].join(", ") : "médias écologiques"} et sont mises à jour chaque jour.
      </p>
    </>
  );
}
