import Link from "next/link";
import { requireHabits } from "@/lib/session";
import { getDailyGoodNews } from "@/lib/news";
import { getQuiz, getWeeklyGoal } from "@/lib/game/data.ts";
import { QuizCard } from "@/components/QuizCard";
import { NewsCard } from "@/components/NewsCard";
import { WhichWeighsMore } from "@/components/WhichWeighsMore";
import { CATEGORY_LABEL, TEMPLATE_BY_ID, formatKg, templateEligibility, verbOf } from "@/lib/co2/challenges.ts";
import { DUOS, recettesOfWeek, videoSearch, weekNumber } from "@/lib/informer";
import { gesteOfWeek } from "@/lib/geste-semaine";
import { GOAL_KINDS } from "@/lib/game/labels.ts";
import { todayParis } from "@/lib/dates";

export const metadata = { title: "S'informer · Pousse" };

export default async function InformerPage() {
  const { supabase, habits } = await requireHabits();
  const today = todayParis();
  const [quiz, weekly, news] = await Promise.all([getQuiz(supabase), getWeeklyGoal(supabase), getDailyGoodNews()]);

  const geste = gesteOfWeek(habits, weekly?.kind ?? null, today);
  const t = TEMPLATE_BY_ID[geste.id];
  const e = t ? templateEligibility(t, habits) : null;
  const recettes = recettesOfWeek(today);

  return (
    <>
      <h1 className="font-display text-2xl font-bold">S&apos;informer</h1>

      <Link href="/scanner" className="flex items-center gap-4 rounded-[20px] bg-sapin p-4 text-sapin-clair">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
            <path d="M8 8v8M11 8v8M14 8v8M17 8v8" />
          </svg>
        </span>
        <span className="flex-1">
          <span className="block text-lg font-bold">Scanner un produit</span>
          <span className="block text-sm opacity-90">Son impact, sa note et une alternative mieux notée</span>
        </span>
        <span aria-hidden="true" className="text-xl">›</span>
      </Link>

      {quiz ? <QuizCard initial={quiz} /> : null}

      <WhichWeighsMore duos={DUOS} start={weekNumber(today)} />

      {t && e ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-xl font-bold">Le geste de la semaine</h2>
          <Link href={`/informer/geste/${t.id}`} className="card flex flex-col gap-2.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold tracking-wider text-argile-fonce uppercase">
                  {verbOf(t.id)} · {CATEGORY_LABEL[t.category]}
                </p>
                <p className="mt-0.5 text-base leading-snug font-bold">{t.title}</p>
              </div>
              {e.eligible ? (
                <span className="shrink-0 font-display text-lg font-bold text-sapin">−{formatKg(e.maxKg)}</span>
              ) : null}
            </div>
            <p className="text-sm text-brun">
              {e.eligible
                ? `Pour toi, d'après ton bilan : ${formatKg(e.maxKg)} de CO₂ évités par ${t.unit.one}. Pourquoi ça compte et comment t'y prendre, en une minute.`
                : "Pourquoi ce geste compte et comment t'y prendre, en une minute."}
            </p>
            <span className="flex items-center justify-between rounded-xl bg-sauge px-3 py-2.5 text-sm font-bold text-sapin">
              <span>{geste.linkedToGoal && weekly ? `Lié au défi collectif : ${GOAL_KINDS[weekly.kind]?.label ?? ""}` : "Change chaque lundi"}</span>
              <span>Lire la fiche ›</span>
            </span>
          </Link>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xl font-bold">Recettes végé de la semaine</h2>
        <ul className="flex flex-col gap-2">
          {recettes.map((r) => (
            <li key={r.id}>
              <details className="card group py-3">
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-peche">
                    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7a5a12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11h16a8 8 0 0 1-16 0Z" /><path d="M12 7c0-2 1-3 3-3" /></svg>
                  </span>
                  <span className="flex-1">
                    <span className="block font-bold">{r.name}</span>
                    <span className="block text-xs text-terre">{r.minutes} min · {r.protein}</span>
                  </span>
                  <span aria-hidden="true" className="text-terre transition group-open:rotate-90">›</span>
                </summary>
                <div className="mt-3 flex flex-col gap-2 text-sm text-brun">
                  <p className="font-bold text-encre">Ingrédients</p>
                  <ul className="list-disc pl-5">
                    {r.ingredients.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                  <p className="font-bold text-encre">Préparation</p>
                  <ol className="list-decimal pl-5">
                    {r.steps.map((x) => <li key={x}>{x}</li>)}
                  </ol>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a href={videoSearch(r.name)} target="_blank" rel="noopener noreferrer" className="btn-ghost min-h-10 px-4 text-sm">
                      Voir en vidéo <span aria-hidden="true">↗</span><span className="sr-only"> (nouvel onglet)</span>
                    </a>
                    <Link href="/agir" className="btn-dark min-h-10 px-4 text-sm">Je l&apos;ai cuisinée</Link>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>

      {news.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold">Bonnes nouvelles</h2>
          {news.map((n) => (
            <NewsCard key={n.link} item={n} />
          ))}
          <p className="text-center text-xs text-terre">
            Titres relayés de {[...new Set(news.map((n) => n.source))].join(", ")}, mis à jour plusieurs fois par jour.
          </p>
        </section>
      ) : null}
    </>
  );
}
