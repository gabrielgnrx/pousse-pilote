import Link from "next/link";
import { requireHabits } from "@/lib/session";
import {
  CATEGORY_LABEL,
  TEMPLATE_BY_ID,
  TEMPLATES,
  formatKg,
  templateEligibility,
  verbOf,
} from "@/lib/co2/challenges.ts";
import type { Footprint } from "@/lib/co2/footprint.ts";
import { formatDay, todayParis } from "@/lib/dates";
import { POINTS, keptHabits } from "@/lib/co2/engagement.ts";
import { getEngagement } from "@/lib/engagement-data";
import { keepHabit } from "./actions";
import { claimDailyRewards } from "@/lib/engagement-data";
import { DailyQuests } from "@/components/DailyQuests";
import { InstallPrompt } from "@/components/InstallPrompt";
import { getQuiz } from "@/lib/game/data.ts";

interface ChallengeRow {
  id: string;
  template_id: string;
  variant: string;
  target: number;
  ends_on: string;
  status: string;
}

const FP_PARTS: { key: keyof Footprint["byCategory"]; label: string; color: string }[] = [
  { key: "transport", label: "Transports", color: "#f0a97b" },
  { key: "alimentation", label: "Alimentation", color: "#b5c890" },
  { key: "logement", label: "Chauffage", color: "#e9c9a3" },
  { key: "consommation", label: "Achats", color: "#8fa06a" },
  { key: "services", label: "Services publics", color: "#6f7d52" },
];

export default async function DefisPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string; garde?: string; erreur?: string; valide?: string; cree?: string }>;
}) {
  const { onglet, garde, erreur, valide, cree } = await searchParams;
  const tab = onglet === "catalogue" ? "catalogue" : "en-cours";
  const { supabase, user, habits } = await requireHabits();
  const today = todayParis();

  const [{ data: challenges }, { data: validations }, engagement, { data: fp }, daily, quiz] = await Promise.all([
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
    getEngagement(supabase, user.id),
    supabase
      .from("footprints")
      .select("total_kg, by_category")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ total_kg: number; by_category: Footprint["byCategory"] }>(),
    claimDailyRewards(supabase),
    getQuiz(supabase),
  ]);
  const kept = keptHabits(habits);
  // Garder le cap : 2 habitudes récompensées par semaine (keep_habit, 0009_equilibrage.sql).
  const MAX_REWARDED = 2;
  const rewardedThisWeek = Math.min(MAX_REWARDED, engagement.keptThisWeek.size);

  const progress = new Map<string, { units: number; kg: number }>();
  for (const v of validations ?? []) {
    const p = progress.get(v.challenge_id) ?? { units: 0, kg: 0 };
    p.units += v.units;
    p.kg += Number(v.kg);
    progress.set(v.challenge_id, p);
  }
  const todayUnits = (ids: string[]) =>
    (validations ?? []).filter((v) => v.day === today && ids.includes(v.template_id)).reduce((s, v) => s + v.units, 0);

  const catalog = TEMPLATES.map((t) => ({ t, e: templateEligibility(t, habits) }));
  const eligible = catalog.filter((c) => c.e.eligible && c.t.level !== "expert");
  const expert = catalog.filter((c) => c.e.eligible && c.t.level === "expert");
  const notForYou = catalog.filter((c) => !c.e.eligible);
  // Profil déjà sobre : peu de défis du quotidien lui restent.
  const alreadySober = eligible.length <= 3;

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Mon plan</h1>
        <Link href="/defis?onglet=catalogue" className="btn-primary min-h-11 px-4 text-sm">+ Défi</Link>
      </div>

      {fp ? (
        <Link href="/bilan" className="card flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-terre">Mon empreinte</span>
            <span className="text-sm font-bold">
              {(Number(fp.total_kg) / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} t/an
              {engagement.kgAvoided > 0 ? <span className="text-sapin"> · −{formatKg(engagement.kgAvoided)} évités</span> : null}
            </span>
          </div>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
            {FP_PARTS.map((c) => (
              <div key={c.key} style={{ width: `${(Number(fp.by_category[c.key]) / Number(fp.total_kg)) * 100}%`, background: c.color }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-brun">
            {FP_PARTS.filter((c) => c.key !== "services").map((c) => (
              <span key={c.key} className="flex items-center gap-1">
                <span className="size-2.5 rounded-sm" style={{ background: c.color }} aria-hidden="true" />
                {c.label} {Math.round((Number(fp.by_category[c.key]) / Number(fp.total_kg)) * 100)} %
              </span>
            ))}
            <span className="font-bold underline underline-offset-2">Détail ›</span>
          </div>
        </Link>
      ) : null}

      {daily ? <DailyQuests daily={daily} /> : null}

      {quiz ? (
        <Link href="/quiz" className="flex items-center gap-3 rounded-[18px] bg-papier px-4 py-3">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-peche font-display text-lg font-bold text-[#7a5a12]">?</span>
          <span className="flex-1">
            <span className="block text-sm font-bold">Quiz du jour</span>
            <span className="block text-xs text-terre">
              {quiz.current
                ? quiz.answered > 0
                  ? `${quiz.answered}/${quiz.total} répondues · ${quiz.score} juste${quiz.score > 1 ? "s" : ""}`
                  : "10 questions, jusqu'à 15 pousses"
                : `Terminé : ${quiz.score}/${quiz.total}. 10 nouvelles questions demain.`}
            </span>
          </span>
          <span aria-hidden="true" className="font-bold text-sapin">{quiz.current ? (quiz.answered > 0 ? "Continuer ›" : "Jouer ›") : "Revoir ›"}</span>
        </Link>
      ) : null}

      <nav aria-label="Onglets des défis" className="flex rounded-full bg-sable p-1">
        {[
          { id: "en-cours", label: "Mes défis", href: "/defis" },
          { id: "catalogue", label: "Gestes à essayer", href: "/defis?onglet=catalogue" },
        ].map((t) => (
          <Link
            key={t.id}
            href={t.href}
            aria-current={tab === t.id ? "page" : undefined}
            className={`flex h-10 flex-1 items-center justify-center rounded-full text-sm font-bold ${
              tab === t.id ? "bg-sapin text-sapin-clair" : "text-brun"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {garde ? (
        <p role="status" className="rounded-2xl bg-sauge px-4 py-3 text-sm font-bold text-[#2e3a22]">
          Noté pour cette semaine : +{POINTS.maintien} pousses !
        </p>
      ) : null}
      {valide ? (
        <p role="status" className="animate-pousse-pop rounded-2xl bg-abricot px-4 py-3 text-sm font-bold text-[#402a16]">
          Validé ! Tes pousses et ton CO₂ évité sont comptés.
          <span className="block text-xs font-semibold">
            Sans preuve, la validation reste privée. Ajoute une photo ou un collègue la prochaine fois : +5 pousses et
            elle apparaît dans le fil.
          </span>
        </p>
      ) : null}
      {cree ? (
        <p role="status" className="animate-pousse-pop rounded-2xl bg-sauge px-4 py-3 text-sm font-bold text-[#2e3a22]">
          Défi lancé ! Reviens le valider chaque fois que tu le réalises.
        </p>
      ) : null}
      {erreur ? (
        <p role="alert" className="rounded-2xl bg-peche px-4 py-3 text-sm font-semibold text-argile-fonce">{erreur}</p>
      ) : null}

      {tab === "en-cours" ? (
        <>
          {kept.length ? (
            <section className="flex flex-col gap-3 rounded-[20px] bg-sapin p-4 text-sapin-clair">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold tracking-wider uppercase">Garder le cap</p>
                  <p className="mt-1 text-sm leading-snug">
                    Tes habitudes déjà bas carbone comptent aussi : confirme-les chaque semaine.
                  </p>
                </div>
                <div className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-center">
                  <p className="font-display text-xl leading-none font-bold">{rewardedThisWeek}/{MAX_REWARDED}</p>
                  <p className="mt-0.5 text-[10px]">récompensées<br />cette semaine</p>
                </div>
              </div>
              <ul className="flex flex-col gap-2">
                {kept.map((k) => {
                  const done = engagement.keptThisWeek.has(k.key);
                  return (
                    <li key={k.key} className="flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-2.5">
                      <div className="flex-1">
                        <p className="text-sm font-bold">{k.title}</p>
                        <p className="text-[11px] opacity-90">
                          {k.kgWeek ? `${formatKg(k.kgWeek)} par semaine de moins que ${k.versus}` : k.basis}
                        </p>
                      </div>
                      {done ? (
                        <span className="chip bg-sapin-clair text-sapin">✓ Cette semaine</span>
                      ) : (
                        <form action={keepHabit}>
                          <input type="hidden" name="habit" value={k.key} />
                          <button type="submit" className="flex h-10 items-center rounded-full bg-abricot px-3.5 text-sm font-bold text-[#402a16]">
                            {rewardedThisWeek < MAX_REWARDED ? `Je garde · +${POINTS.maintien}` : "Je garde"}
                          </button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="text-[11px] opacity-90">
                +{POINTS.maintien} pousses pour les 2 premières habitudes confirmées chaque semaine ; les suivantes
                comptent pour ta série. Pas de CO₂ évité en plus : il ne compte que ce qui change.
              </p>
            </section>
          ) : null}

          <section className="card flex flex-col gap-2">
            <p className="label">Plafonds du jour</p>
            <div className="flex gap-4">
              {[
                { label: "Trajets", used: todayUnits(["velo", "transports", "covoiturage"]), max: 2 },
                { label: "Repas", used: todayUnits(["vege", "moins_boeuf", "vegetalien"]), max: 2 },
              ].map((c) => (
                <div key={c.label} className="flex-1">
                  <p className="text-xs font-semibold">
                    {c.label} {c.used}/{c.max}
                  </p>
                  <div className="mt-1 h-1.5 rounded-full bg-trait">
                    <div className="h-1.5 rounded-full bg-sapin" style={{ width: `${Math.min(100, (c.used / c.max) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-terre">Au-delà, rien n&apos;est compté. Un trajet ne compte que pour un défi.</p>
          </section>

          {(challenges ?? []).length === 0 ? (
            <div className="card flex flex-col gap-3 text-center">
              <p className="font-display text-lg font-bold">Aucun défi en cours</p>
              <p className="text-sm text-brun">Choisis un geste adapté à ton bilan et essaie-le quelques semaines.</p>
              <Link href="/defis?onglet=catalogue" className="btn-primary">Voir les gestes à essayer</Link>
            </div>
          ) : null}

          {(challenges ?? []).map((c) => {
            const t = TEMPLATE_BY_ID[c.template_id];
            if (!t) return null;
            const p = progress.get(c.id) ?? { units: 0, kg: 0 };
            const variant = t.variants.find((v) => v.key === c.variant);
            const done = c.status === "done";
            return (
              <article key={c.id} className="card flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="label">
                    {CATEGORY_LABEL[t.category]} · {done ? "réussi" : `jusqu'au ${formatDay(c.ends_on, "short")}`}
                  </span>
                  <span className="text-xs font-bold text-argile-fonce">
                    {p.units}/{c.target} {c.target > 1 ? t.unit.many : t.unit.one}
                  </span>
                </div>
                <h2 className="font-display text-lg font-bold">{t.title}</h2>
                {t.variants.length > 1 && variant ? <p className="-mt-1 text-sm text-terre">{variant.label}</p> : null}
                <div className="h-2 rounded-full bg-trait">
                  <div className="h-2 rounded-full bg-sapin" style={{ width: `${Math.min(100, (p.units / c.target) * 100)}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="chip bg-sauge">{formatKg(p.kg)} évités</span>
                  {done ? (
                    <span className="chip bg-peche">Défi réussi</span>
                  ) : (
                    <Link href={`/defis/${c.id}/valider`} className="btn-primary min-h-10 px-4 text-sm">Valider</Link>
                  )}
                </div>
              </article>
            );
          })}

          <InstallPrompt />
          <Link href="/avis" className="flex items-center gap-3 rounded-[20px] bg-peche p-4">
            <span className="flex-1">
              <span className="block text-sm font-bold">30 secondes pour améliorer Pousse ?</span>
              <span className="block text-xs text-[#5a4324]">3 questions sur ta semaine</span>
            </span>
            <span className="btn-primary min-h-10 px-4 text-sm">Répondre</span>
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm text-brun">
            Triés par impact pour toi. Lance un défi sur plusieurs jours, ou enregistre simplement le geste avec le
            bouton + quand tu le fais.
          </p>
          {[...eligible].sort((a, b) => b.e.maxKg - a.e.maxKg).map(({ t, e }) => {
            return (
              <article key={t.id} className="card flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold tracking-wider text-argile-fonce uppercase">{verbOf(t.id)}</span>
                    <span className="label">· {CATEGORY_LABEL[t.category]}</span>
                  </div>
                  <h2 className="mt-1 font-bold">{t.title}</h2>
                  <Link href={`/informer/geste/${t.id}`} className="text-xs font-bold underline underline-offset-2">Pourquoi et comment</Link>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="chip bg-peche">+{t.pointsPerUnit} pousses avec preuve</span>
                    <span className="chip bg-sauge">
                      −{e.minKg === e.maxKg ? formatKg(e.minKg) : `${formatKg(e.minKg)} à ${formatKg(e.maxKg)}`} CO₂ par {t.unit.one}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-brun">Preuve : {t.proofHint.toLowerCase()}</p>
                </div>
                <Link href={`/defis/nouveau/${t.id}`} aria-label={`Lancer : ${t.title}`} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-argile text-white">
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                </Link>
              </article>
            );
          })}

          {expert.length ? (
            <section className="flex flex-col gap-3">
              <div className="mt-2">
                <h2 className="font-display text-lg font-bold">Pour aller plus loin</h2>
                <p className="text-xs text-terre">
                  {alreadySober
                    ? "Tu as déjà adopté l'essentiel des gestes du quotidien : voici ce qui pèse encore dans ton bilan."
                    : "Des défis plus exigeants, qui rapportent plus de pousses."}
                </p>
              </div>
              {expert.map(({ t, e }) => (
                <article key={t.id} className="flex items-center gap-3 rounded-[20px] border-2 border-sapin bg-papier p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="label">{CATEGORY_LABEL[t.category]}</span>
                      <span className="chip bg-sapin px-2 py-0.5 text-[10px] tracking-wide text-sapin-clair uppercase">Expert</span>
                    </div>
                    <h3 className="mt-1 font-bold">{t.title}</h3>
                    {t.pitch ? <p className="mt-1 text-xs leading-relaxed text-brun">{t.pitch}</p> : null}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="chip bg-peche">+{t.pointsPerUnit} pousses avec preuve</span>
                      <span className="chip bg-sauge">
                        −{e.minKg === e.maxKg ? formatKg(e.minKg) : `${formatKg(e.minKg)} à ${formatKg(e.maxKg)}`} CO₂ par {t.unit.one}
                      </span>
                    </div>
                  </div>
                  <Link href={`/defis/nouveau/${t.id}`} aria-label={`Lancer : ${t.title}`} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sapin text-sapin-clair">
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                  </Link>
                </article>
              ))}
            </section>
          ) : null}

          {notForYou.length ? (
            <section className="flex flex-col gap-2">
              <h2 className="mt-2 font-display text-base font-bold">Pas proposés pour toi</h2>
              <p className="-mt-1 text-xs text-terre">
                Ils remplacent une habitude que tu n&apos;as pas déclarée : ils ne rapporteraient aucun CO₂ réel.
              </p>
              {notForYou.map(({ t, e }) => (
                <div key={t.id} className="rounded-2xl border-[1.5px] border-dashed border-[#c7b78c] px-4 py-3">
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
