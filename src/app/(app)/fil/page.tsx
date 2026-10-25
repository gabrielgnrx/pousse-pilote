import Link from "next/link";
import { cookies } from "next/headers";
import { requireHabits } from "@/lib/session";
import { GESTES, TEMPLATE_BY_ID, formatKg } from "@/lib/co2/challenges.ts";
import { relativeTime } from "@/lib/dates";
import { INTRO_COOKIE, PROOF_BUCKET } from "@/lib/constants";
import { claimDailyRewards } from "@/lib/engagement-data";
import { IntroCard } from "@/components/IntroCard";
import { getDuels } from "@/lib/game/data.ts";
import { CompanyHero, type CompanyPulse } from "@/components/CompanyHero";
import { InstallPrompt } from "@/components/InstallPrompt";
import { duelKindForTemplate } from "@/lib/game/labels.ts";
import { actionTitle } from "@/lib/actions-catalog";
import { reportPost, toggleCheer } from "./actions";
import { formatDay } from "@/lib/dates";

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

const AVATAR = ["#b9d3e8", "#e8a27c", "#d7e3c8", "#f6d9a8", "#e3c9e8", "#ece6d6"];
const avatarColor = (id: string) => AVATAR[parseInt(id.replace(/-/g, "").slice(-2), 16) % AVATAR.length];

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

  return (
    <>
      <h1 className="sr-only">Accueil</h1>
      {publie ? (
        <p role="status" className="rounded-2xl bg-sauge px-4 py-3 text-sm font-bold text-[#1f5134]">
          Publié ! Tes collègues peuvent maintenant t&apos;encourager.
        </p>
      ) : null}
      {showIntro ? <IntroCard /> : null}
      {daily && daily.gained > 0 ? (
        <p role="status" className="animate-pousse-pop rounded-2xl bg-abricot px-4 py-3 text-sm font-bold text-[#3a1606]">
          Bonus débloqué : +{daily.gained} pousses{daily.questDone ? " pour tes quêtes du jour" : ""} !
        </p>
      ) : null}

      {pulse ? <CompanyHero pulse={pulse as CompanyPulse} /> : null}
      <InstallPrompt />


      <div id="publications" className="mt-0.5 flex scroll-mt-4 items-center justify-between gap-2">
        <h2 className="font-display text-[21px]">Fil d&apos;actu</h2>
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
                  f.on ? "bg-encre font-bold text-[#f6f3ea]" : "border border-[#d8d0bd] font-semibold text-encre"
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
          <p className="font-display text-lg">Le fil est encore calme</p>
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
            <article key={`defi-${e.id}-${e.event}`} className={`flex flex-col gap-2.5 rounded-[24px] p-4 shadow-[0_8px_28px_rgba(31,42,30,0.06)] ${won ? "bg-sauge" : "bg-papier"}`}>
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
                  <p className="truncate text-xs text-[#5b6458]">
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
                    className="flex h-11 items-center rounded-[14px] border border-trait bg-papier px-3.5 text-sm font-medium"
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
          <article key={p.id} className="flex flex-col gap-3 rounded-[24px] bg-papier p-4 shadow-[0_8px_28px_rgba(31,42,30,0.06)]">
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
                <p className="truncate text-xs text-[#5b6458]">
                  {title} · {relativeTime(p.created_at)}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-sauge px-2.5 py-1 text-[13px] font-bold text-sapin">
                {Number(p.kg) > 0 ? `−${formatKg(Number(p.kg))}` : `+${p.points} pousses`}
              </span>
              {!mine ? (
                <form action={reportPost}>
                  <input type="hidden" name="validation" value={p.id} />
                  <button
                    type="submit"
                    disabled={reported.has(p.id)}
                    aria-label={reported.has(p.id) ? "Publication signalée" : "Signaler cette publication"}
                    className="-mr-1.5 flex size-8 items-center justify-center rounded-full text-[#5b6458]"
                  >
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill={reported.has(p.id) ? "#b4532a" : "none"} stroke="currentColor" strokeWidth="2"><path d="M4 22V4c4-2 8 2 12 0v10c-4 2-8-2-12 0" /></svg>
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
                  className={`flex h-11 items-center rounded-[14px] px-3.5 text-sm font-semibold ${
                    cheered
                      ? "bg-sapin text-sapin-clair shadow-[inset_0_-3px_0_var(--color-sapin-fonce)]"
                      : "bg-sauge text-sapin shadow-[inset_0_-3px_0_var(--color-sauge-fonce)]"
                  }`}
                >
                  Bravo · {postCheers.length}
                </button>
              </form>
              {!mine && t ? (
                <Link
                  href={GESTES.some((g) => g.id === t.id) ? "/agir" : `/defis/nouveau/${t.id}?variante=${p.variant}&via=${p.id}`}
                  className="flex h-11 items-center rounded-[14px] border border-trait bg-papier px-3.5 text-sm font-medium"
                >
                  J&apos;essaie aussi
                </Link>
              ) : null}
              {!mine && t ? (
                <Link
                  href={`/duels?avec=${p.user_id}&type=${duelKindForTemplate(t.id)}`}
                  className="flex h-11 items-center rounded-[14px] border border-trait bg-papier px-3.5 text-sm font-medium"
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
