import Link from "next/link";
import { requireHabits } from "@/lib/session";
import {
  CATEGORY_LABEL,
  TEMPLATE_BY_ID,
  TEMPLATES,
  formatKg,
  isHabitAction,
  templateEligibility,
  verbOf,
} from "@/lib/co2/challenges.ts";
import { formatDay, todayParis } from "@/lib/dates";
import { cancelChallenge, setFeasibility } from "./actions";
import { WeeklyPlan } from "@/components/WeeklyPlan";
import { weekStart } from "@/lib/co2/engagement.ts";
import { buildPlan, parseInputs } from "@/lib/plan/service";
import type { PlanEntry } from "@/lib/plan/weekly.ts";
import { claimDailyRewards } from "@/lib/engagement-data";
import { DailyQuests } from "@/components/DailyQuests";
import { getDuels } from "@/lib/game/data.ts";
import { ActiveChallenges } from "@/components/ActiveChallenges";
import { DuelStrip } from "@/components/DuelStrip";
import { actionTitle } from "@/lib/actions-catalog";
import { BONUS, MODES, fmtMult } from "@/lib/boosts";
import { TEAM_KINDS, type TeamWeek } from "@/lib/team";

interface ChallengeRow {
  id: string;
  template_id: string;
  variant: string;
  target: number;
  ends_on: string;
  status: string;
}

export default async function DefisPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string; erreur?: string; cree?: string }>;
}) {
  const { onglet, erreur, cree } = await searchParams;
  const tab = onglet === "catalogue" ? "catalogue" : "en-cours";
  const { supabase, user, profile, habits } = await requireHabits();
  const today = todayParis();

  const [{ data: challenges }, { data: validations }, daily] = await Promise.all([
    supabase
      .from("user_challenges")
      .select("id, template_id, variant, target, ends_on, status")
      .eq("user_id", user.id)
      .in("status", ["active", "done"])
      .order("created_at", { ascending: false })
      .returns<ChallengeRow[]>(),
    supabase
      .from("validations")
      .select("challenge_id, units, kg, day, template_id")
      .eq("user_id", user.id)
      .eq("status", "valid"),
    claimDailyRewards(supabase),
  ]);
  const [duels, { data: teamWeekData }] = await Promise.all([
    getDuels(supabase),
    profile.team_id ? supabase.rpc("my_team_week") : Promise.resolve({ data: null }),
  ]);
  const teamWeek = teamWeekData as TeamWeek | null;

  // Mon plan de la semaine : calculé par les règles à la première visite de la semaine (ou après un
  // changement de faisabilité), puis gardé jusqu'au lundi suivant.
  const [{ data: savedPlan }, { data: planInputs }] = await Promise.all([
    supabase
      .from("user_plans")
      .select("items, source")
      .eq("user_id", user.id)
      .eq("week_start", weekStart(today))
      .maybeSingle<{ items: PlanEntry[]; source: string }>(),
    supabase.rpc("my_plan_inputs"),
  ]);
  const { feasibility, week: lastWeek } = parseInputs(planInputs as { feasibility?: unknown; stats?: unknown } | null);
  let plan = savedPlan;
  if (!plan) {
    const items = buildPlan(habits, feasibility, lastWeek);
    if (items) {
      await supabase.rpc("save_my_plan", { p_items: items, p_source: "regles", p_version: null });
      plan = { items, source: "regles" };
    }
  }
  const duelOf = (challengeId: string) =>
    duels.find((d) => d.challenge_id === challengeId && (d.status === "active" || d.status === "pending"));

  const progress = new Map<string, { units: number; kg: number }>();
  for (const v of validations ?? []) {
    const p = progress.get(v.challenge_id) ?? { units: 0, kg: 0 };
    p.units += v.units;
    p.kg += Number(v.kg);
    progress.set(v.challenge_id, p);
  }
  // Mes défis en cours, avec leur avancée et le duel qui leur est lié ; les réussis, à part.
  const active = (challenges ?? []).filter((c) => c.status === "active" && c.ends_on >= today);
  const succeeded = (challenges ?? []).filter((c) => c.status === "done").slice(0, 5);
  const activeChallenges = active.map((c) => {
    const t = TEMPLATE_BY_ID[c.template_id];
    const d = duelOf(c.id);
    return {
      id: c.id,
      title: t ? actionTitle(t.id, c.variant) : "Défi",
      unit: t?.unit ?? { one: "fois", many: "fois" },
      done: progress.get(c.id)?.units ?? 0,
      target: Number(c.target),
      endsOn: formatDay(c.ends_on, "short"),
      duel: d ? { other: d.other_name, theirs: d.theirs, status: d.status } : null,
      href: t?.requiresConfirm || t?.id === "occasion" ? `/agir?ajout=${t.id}:${c.variant}` : "/agir",
      duelHref: d ? undefined : `/defis/${c.id}/duel`,
    };
  });

  const catalog = TEMPLATES.map((t) => ({ t, e: templateEligibility(t, habits) }));
  const eligible = catalog.filter((c) => c.e.eligible && c.t.level !== "expert");
  const expert = catalog.filter((c) => c.e.eligible && c.t.level === "expert");
  // Les bonnes habitudes que tu as déjà : pas de CO₂ en plus, mais un défi dessus rapporte ses pousses.
  const alreadyDoing = catalog.filter((c) => !c.e.eligible && isHabitAction(c.t.id));
  const notForYou = catalog.filter((c) => !c.e.eligible && !isHabitAction(c.t.id));
  // Profil déjà sobre : peu de défis du quotidien lui restent.
  const alreadySober = eligible.length <= 3;

  return (
    <>
      <h1 className="sr-only">Mon plan</h1>

      <nav aria-label="Onglets des défis" className="flex rounded-full bg-sable p-1">
        {[
          { id: "en-cours", label: activeChallenges.length ? `Mes défis · ${activeChallenges.length}` : "Mes défis", href: "/defis" },
          { id: "catalogue", label: "Défis à lancer", href: "/defis?onglet=catalogue" },
        ].map((t) => (
          <Link
            key={t.id}
            href={t.href}
            aria-current={tab === t.id ? "page" : undefined}
            className={`flex h-10 flex-1 items-center justify-center rounded-full text-sm ${
              tab === t.id ? "bg-papier font-bold text-encre" : "font-semibold text-brun"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {cree ? (
        <p role="status" className="animate-pousse-pop rounded-[20px] bg-sauge px-4 py-3 text-sm font-bold text-sapin">
          Défi lancé ! Il est juste en dessous : enregistre chaque fois que tu le fais avec le bouton +.
        </p>
      ) : null}
      {erreur ? (
        <p role="alert" className="rounded-[20px] bg-pollen-pale px-4 py-3 text-sm font-semibold text-alerte">{erreur}</p>
      ) : null}

      {tab === "en-cours" ? (
        <>
          {/* Un seul ordre de lecture : ce qui attend une réponse, ce qui est en cours, ce qu'on te propose,
              les quêtes du jour, puis l'historique. */}
          <DuelStrip duels={duels.filter((d) => d.status === "pending" && d.role === "opponent")} />

          <section aria-labelledby="en-cours" className="flex flex-col gap-2.5">
            <h2 id="en-cours" className="label">En cours</h2>
            <ActiveChallenges items={activeChallenges} cancel={cancelChallenge} />
            {teamWeek?.chosen ? (
              <Link href="/equipes" className="flex flex-col gap-2.5 rounded-[24px] bg-nuit p-4 text-white">
                <span className="flex items-center justify-between">
                  <span className="flex h-6 items-center rounded-full bg-pollen px-2.5 text-[11px] font-extrabold tracking-wider text-encre uppercase">
                    Équipe · {fmtMult(MODES.equipe.mult)}
                  </span>
                  <span className="text-xs text-nuit-pale">jusqu&apos;à dimanche</span>
                </span>
                <span className="font-display text-xl leading-tight">
                  {teamWeek.target} {TEAM_KINDS[teamWeek.chosen].unit} pour l&apos;équipe
                </span>
                <span className="h-2.5 overflow-hidden rounded-full bg-white/15">
                  <span
                    className="block h-full rounded-full bg-pollen"
                    style={{ width: `${Math.min(100, ((teamWeek.progress ?? 0) / Math.max(1, teamWeek.target ?? 1)) * 100)}%` }}
                  />
                </span>
                <span className="text-xs text-nuit-pale">
                  <span className="font-bold text-white">
                    {teamWeek.progress ?? 0}/{teamWeek.target}
                  </span>{" "}
                  · toi : {teamWeek.mine ?? 0}. Objectif atteint = +{BONUS.equipe} pour chaque contributeur.
                </span>
              </Link>
            ) : null}
            {!activeChallenges.length && !teamWeek?.chosen ? (
              <div className="flex flex-col items-center gap-3 rounded-[24px] bg-papier p-5 text-center">
                <p className="font-display text-lg">Aucun défi en cours</p>
                <p className="text-sm text-brun">Choisis une action adaptée à ton bilan et essaie-la quelques jours, seul, en duel ou en équipe.</p>
                <Link href="/defis?onglet=catalogue" className="btn-dark w-full">
                  Lancer un défi
                </Link>
              </div>
            ) : null}
          </section>

          {plan?.items?.length ? (
            <WeeklyPlan items={plan.items} feasibility={feasibility} setFeasibility={setFeasibility} />
          ) : null}
          <Link href="/defis?onglet=catalogue" className="btn-ghost">
            Voir tous les défis à lancer
          </Link>

          {daily ? <DailyQuests daily={daily} /> : null}

          {succeeded.length ? (
            <section className="flex flex-col gap-2" aria-labelledby="reussis">
              <h2 id="reussis" className="label">Défis réussis</h2>
              <ul className="flex flex-col gap-1.5">
                {succeeded.map((c) => {
                  const t = TEMPLATE_BY_ID[c.template_id];
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-3 rounded-[14px] bg-sauge px-4 py-2.5">
                      <span className="text-sm font-bold text-sapin">{t ? actionTitle(t.id, c.variant) : "Défi"}</span>
                      <span className="shrink-0 text-xs font-bold text-sapin">−{formatKg(progress.get(c.id)?.kg ?? 0)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <Link href="/duels" className="self-center py-2 text-sm font-bold text-sapin underline underline-offset-2">
            Mes duels · défier un collègue ›
          </Link>
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1.5 text-center" aria-label="Ce que rapporte chaque mode">
            {(
              [
                { id: "seul", bg: "bg-papier", fg: "", bonus: `+${BONUS.seul}` },
                { id: "duel", bg: "bg-sauge", fg: "text-sapin", bonus: `+${BONUS.duelSeul}` },
                { id: "equipe", bg: "bg-pollen-pale", fg: "text-pollen-texte", bonus: `+${BONUS.equipe}` },
              ] as const
            ).map((m) => (
              <div key={m.id} className={`flex flex-col rounded-2xl px-1 py-2 ${m.bg}`}>
                <span className={`text-xs ${m.fg || "text-terre"}`}>{MODES[m.id].label}</span>
                <span className={`text-sm font-bold ${m.fg}`}>{fmtMult(MODES[m.id].mult)} · {m.bonus}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-brun">
            Triés par impact pour toi. Lance un défi sur plusieurs jours, ou enregistre simplement l&apos;action avec le
            bouton + quand tu le fais.
          </p>
          {[...eligible].sort((a, b) => b.e.maxKg - a.e.maxKg).map(({ t, e }) => {
            return (
              <article key={t.id} className="flex items-center gap-3 rounded-[20px] bg-papier py-3 pr-3 pl-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold tracking-wider text-chloro uppercase">{verbOf(t.id)}</span>
                    <span className="label">· {CATEGORY_LABEL[t.category]}</span>
                  </div>
                  <h2 className="mt-0.5 text-base leading-snug font-bold">{t.title}</h2>
                  <Link href={`/informer/geste/${t.id}`} className="text-xs font-bold underline underline-offset-2">Pourquoi et comment</Link>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="chip bg-pollen-pale text-pollen-texte">+{t.pointsPerUnit} pousses par {t.unit.one}</span>
                    <span className="chip bg-sauge text-sapin">
                      −{e.minKg === e.maxKg ? formatKg(e.minKg) : `${formatKg(e.minKg)} à ${formatKg(e.maxKg)}`} CO₂ par {t.unit.one}
                    </span>
                  </div>
                </div>
                <Link href={`/defis/nouveau/${t.id}`} aria-label={`Lancer : ${t.title}`} className="flex size-12 shrink-0 items-center justify-center rounded-full bg-chloro text-white transition active:scale-95">
                  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </Link>
              </article>
            );
          })}

          {expert.length ? (
            <section className="flex flex-col gap-3">
              <div className="mt-2">
                <h2 className="font-display text-xl">Pour aller plus loin</h2>
                <p className="text-xs text-terre">
                  {alreadySober
                    ? "Tu as déjà adopté l'essentiel des actions du quotidien : voici ce qui pèse encore dans ton bilan."
                    : "Des défis plus exigeants, qui rapportent plus de pousses."}
                </p>
              </div>
              {expert.map(({ t, e }) => (
                <article key={t.id} className="flex items-center gap-3 rounded-[20px] bg-sapin p-4 text-sapin-clair [&_.label]:text-sapin-pale [&_p]:text-sapin-pale">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="label">{CATEGORY_LABEL[t.category]}</span>
                      <span className="chip bg-feuille px-2 py-0.5 text-[11px] tracking-wide text-encre uppercase">Expert</span>
                    </div>
                    <h3 className="mt-1 font-bold">{t.title}</h3>
                    {t.pitch ? <p className="mt-1 text-xs leading-relaxed text-brun">{t.pitch}</p> : null}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="chip bg-pollen-pale text-pollen-texte">+{t.pointsPerUnit} pousses par {t.unit.one}</span>
                      <span className="chip bg-sauge text-sapin">
                        −{e.minKg === e.maxKg ? formatKg(e.minKg) : `${formatKg(e.minKg)} à ${formatKg(e.maxKg)}`} CO₂ par {t.unit.one}
                      </span>
                    </div>
                  </div>
                  <Link href={`/defis/nouveau/${t.id}`} aria-label={`Lancer : ${t.title}`} className="flex size-12 shrink-0 items-center justify-center rounded-full bg-pollen text-encre transition active:scale-95">
                    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  </Link>
                </article>
              ))}
            </section>
          ) : null}

          {alreadyDoing.length ? (
            <section className="flex flex-col gap-3">
              <div className="mt-2">
                <h2 className="font-display text-xl">Tu le fais déjà</h2>
                <p className="text-xs text-terre">
                  Pas de CO₂ en plus dans ton bilan, mais ces bonnes habitudes rapportent autant de pousses qu&apos;un changement.
                </p>
              </div>
              {alreadyDoing.map(({ t }) => (
                <article key={t.id} className="flex items-center gap-3 rounded-[20px] bg-papier py-3 pr-3 pl-4">
                  <div className="flex-1">
                    <span className="label">{CATEGORY_LABEL[t.category]}</span>
                    <h3 className="mt-1 font-bold">{t.title}</h3>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="chip bg-pollen-pale text-pollen-texte">+{t.pointsPerUnit} pousses par {t.unit.one}</span>
                      <span className="chip bg-sable text-brun">0 kg en plus</span>
                    </div>
                  </div>
                  <Link href={`/defis/nouveau/${t.id}`} aria-label={`Lancer : ${t.title}`} className="flex size-12 shrink-0 items-center justify-center rounded-full bg-chloro text-white transition active:scale-95">
                    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  </Link>
                </article>
              ))}
            </section>
          ) : null}

          {notForYou.length ? (
            <section className="flex flex-col gap-2">
              <h2 className="mt-2 font-display text-base">Pas proposés pour toi</h2>
              <p className="-mt-1 text-xs text-terre">
                Ils remplacent une habitude que tu n&apos;as pas déclarée : ils ne rapporteraient aucun CO₂ réel.
              </p>
              {notForYou.map(({ t, e }) => (
                <div key={t.id} className="rounded-2xl border-[1.5px] border-dashed border-trait px-4 py-3">
                  <p className="text-sm font-bold text-brun">{t.title}</p>
                  <p className="text-xs text-terre">{e.reason}</p>
                </div>
              ))}
            </section>
          ) : null}
          <p className="text-center text-xs text-terre">
            Chaque défi a un facteur d&apos;émission ADEME. Sans facteur, pas de défi.
          </p>
        </>
      )}
    </>
  );
}
