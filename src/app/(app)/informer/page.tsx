import Link from "next/link";
import { requireHabits } from "@/lib/session";
import { getDailyGoodNews } from "@/lib/news";
import { NewsCard } from "@/components/NewsCard";
import { FICHES, recettesOfWeek, videoSearch } from "@/lib/informer";
import { CATEGORY_LABEL, TEMPLATE_BY_ID, formatKg, templateEligibility, verbOf } from "@/lib/co2/challenges.ts";
import { gesteOfWeek } from "@/lib/geste-semaine";
import { getQuiz } from "@/lib/game/data.ts";
import type { TeamWeek } from "@/lib/team";
import { MONTHS, inSeason } from "@/lib/saison";
import { todayParis } from "@/lib/dates";

export const metadata = { title: "S'informer · Pousse" };

export default async function InformerPage() {
  const { supabase, profile, habits } = await requireHabits();
  const today = todayParis();
  const month = Number(today.slice(5, 7));
  const [news, quiz, { data: teamWeek }] = await Promise.all([
    getDailyGoodNews(),
    getQuiz(supabase),
    profile.team_id ? supabase.rpc("my_team_week") : Promise.resolve({ data: null }),
  ]);
  // Les fiches gestes : celles qui comptent pour toi d'abord, le geste de la semaine en tête.
  const week = teamWeek as TeamWeek | null;
  const featured = gesteOfWeek(habits, week?.chosen ?? null, today);
  const fiches = Object.keys(FICHES)
    .flatMap((id) => {
      const t = TEMPLATE_BY_ID[id];
      return t ? [{ t, e: templateEligibility(t, habits) }] : [];
    })
    .filter((f) => f.e.eligible)
    .sort((a, b) => Number(b.t.id === featured.id) - Number(a.t.id === featured.id) || b.e.maxKg - a.e.maxKg)
    .slice(0, 6);
  const { legumes, fruits, next } = inSeason(month);
  const recettes = recettesOfWeek(today);

  return (
    <>
      <h1 className="sr-only">S&apos;informer</h1>

      <nav aria-label="Aller à une rubrique" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
        {[
          { href: "#quiz", label: "Quiz" },
          { href: "#fiches", label: "Fiches" },
          { href: "#recettes", label: "Recettes" },
          { href: "#saison", label: "De saison" },
          { href: "#actu", label: "Actus" },
        ].map((c) => (
          <a key={c.href} href={c.href} className="flex h-9 shrink-0 items-center rounded-full border border-[#cdbf9f] px-3.5 text-[13px] font-semibold">
            {c.label}
          </a>
        ))}
      </nav>

      <Link href="/scanner" className="flex items-center gap-3.5 rounded-[20px] bg-[#2f5b36] p-4 text-[#f7f1e3]">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/[0.14]">
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
            <path d="M8 8v8M11 8v8M14 8v8M17 8v8" />
          </svg>
        </span>
        <span className="flex-1">
          <span className="block text-[17px] font-bold">Scanner un produit</span>
          <span className="block text-[13px] text-[#ddebd3]">Son impact, son score, une alternative mieux notée</span>
        </span>
      </Link>

      {quiz ? (
        <Link id="quiz" href="/quiz" className="flex scroll-mt-4 flex-col gap-2 rounded-[20px] bg-[#f6d9a8] p-4 text-[#3d2a0e]">
          <span className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-[0.06em] uppercase">Quiz du jour</span>
            <span className="rounded-full bg-[#2f5b36] px-2 py-0.5 text-xs font-bold text-[#f7f1e3]">jusqu&apos;à 15 pousses</span>
          </span>
          <span className="text-base leading-snug font-bold">
            {quiz.current
              ? quiz.answered > 0
                ? `${quiz.answered}/${quiz.total} répondues · ${quiz.score} juste${quiz.score > 1 ? "s" : ""}`
                : "10 questions sur ce qui pèse vraiment, chiffres ADEME"
              : `Terminé : ${quiz.score}/${quiz.total}. 10 nouvelles questions demain.`}
          </span>
          <span className="text-sm font-bold">{quiz.current ? (quiz.answered > 0 ? "Continuer ›" : "Jouer ›") : "Revoir mes réponses ›"}</span>
        </Link>
      ) : null}

      {fiches.length ? (
        <section id="fiches" className="flex scroll-mt-4 flex-col gap-2" aria-labelledby="fiches-titre">
          <div>
            <h2 id="fiches-titre" className="font-display text-xl font-bold">Les fiches</h2>
            <p className="text-sm text-terre">Pourquoi ça compte et comment s&apos;y prendre, d&apos;après ton bilan.</p>
          </div>
          <ul className="grid grid-cols-2 gap-2.5">
            {fiches.map(({ t, e }) => (
              <li key={t.id}>
                <Link
                  href={`/informer/geste/${t.id}`}
                  className={`flex h-full flex-col gap-1.5 rounded-[18px] p-3 ${t.id === featured.id ? "border-2 border-[#8fa77b] bg-papier" : "bg-papier"}`}
                >
                  <span className="text-[11px] font-bold tracking-[0.06em] text-argile-fonce uppercase">
                    {t.id === featured.id ? "La fiche de la semaine" : `${verbOf(t.id)} · ${CATEGORY_LABEL[t.category]}`}
                  </span>
                  <span className="text-sm leading-snug font-bold">{t.title}</span>
                  <span className="mt-auto text-[13px] font-bold text-[#22502c]">jusqu&apos;à −{formatKg(e.maxKg)} par {t.unit.one}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section id="recettes" className="flex scroll-mt-4 flex-col gap-2" aria-labelledby="recettes-titre">
        <h2 id="recettes-titre" className="font-display text-xl font-bold">Recettes végé de la semaine</h2>
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

      {/* De saison ce mois-ci : ce qu'on met dans son panier. */}
      <section id="saison" className="flex scroll-mt-4 flex-col gap-3 rounded-[22px] bg-sapin p-4 text-sapin-clair" aria-labelledby="saison-titre">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-wider uppercase opacity-90">Ce mois-ci dans ton panier</p>
            <h2 id="saison-titre" className="font-display text-2xl leading-tight font-bold">De saison en {MONTHS[month - 1]}</h2>
          </div>
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22V12" /><path d="M12 12C7 12 4 9 4 4c5 0 8 3 8 8Z" /><path d="M12 15c0-4 3-7 8-7 0 4-3 7-8 7Z" /></svg>
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-bold opacity-90">Légumes</p>
          <ul className="flex flex-wrap gap-1.5">
            {legumes.map((p) => (
              <li key={p.name} className="rounded-full bg-white/12 px-2.5 py-1 text-[13px] font-semibold">{p.name}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-bold opacity-90">Fruits</p>
          <ul className="flex flex-wrap gap-1.5">
            {fruits.map((p) => (
              <li key={p.name} className="rounded-full bg-abricot/90 px-2.5 py-1 text-[13px] font-semibold text-[#402a16]">{p.name}</li>
            ))}
          </ul>
        </div>
        {next.length ? (
          <p className="text-xs opacity-90">Le mois prochain : {next.slice(0, 6).map((p) => p.name.toLowerCase()).join(", ")}.</p>
        ) : null}
        <p className="rounded-2xl bg-white/10 px-3 py-2 text-sm leading-snug">
          Une mangue venue par avion pèse 16 fois plus qu&apos;une mangue venue par bateau. Hors saison, beaucoup de produits viennent
          de serres chauffées ou de loin.
        </p>
        <Link href="/informer/saison" className="flex min-h-11 items-center justify-center rounded-full bg-sapin-clair text-sm font-bold text-sapin">
          Le calendrier complet, avec le CO₂ de chaque produit ›
        </Link>
      </section>

      {/* Les bonnes nouvelles des médias. */}
      <section id="actu" className="flex scroll-mt-4 flex-col gap-3" aria-labelledby="actu-titre">
        <div>
          <h2 id="actu-titre" className="font-display text-xl font-bold">L&apos;actu qui fait du bien</h2>
          <p className="text-sm text-terre">Les bonnes nouvelles pour la planète, relayées des médias plusieurs fois par jour.</p>
        </div>
        {news.length ? (
          <>
            {news.map((n) => (
              <NewsCard key={n.link} item={n} />
            ))}
            <p className="text-center text-xs text-terre">Sources : {[...new Set(news.map((n) => n.source))].join(", ")}.</p>
          </>
        ) : (
          <p className="card text-sm text-brun">Pas d&apos;article à relayer pour l&apos;instant. Reviens un peu plus tard.</p>
        )}
      </section>

    </>
  );
}
