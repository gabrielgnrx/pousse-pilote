import Link from "next/link";
import { requireHabits } from "@/lib/session";
import { getDailyGoodNews } from "@/lib/news";
import { NewsCard } from "@/components/NewsCard";
import { recettesOfWeek, videoSearch } from "@/lib/informer";
import { MONTHS, inSeason } from "@/lib/saison";
import { todayParis } from "@/lib/dates";

export const metadata = { title: "S'informer · Pousse" };

export default async function InformerPage() {
  await requireHabits();
  const today = todayParis();
  const month = Number(today.slice(5, 7));
  const news = await getDailyGoodNews();
  const { legumes, fruits, next } = inSeason(month);
  const recettes = recettesOfWeek(today);

  return (
    <>
      <h1 className="font-display text-2xl font-bold">S&apos;informer</h1>

      {/* 1. De saison ce mois-ci : ce qu'on met dans son panier, tout de suite. */}
      <section className="flex flex-col gap-3 rounded-[22px] bg-sapin p-4 text-sapin-clair" aria-labelledby="saison">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-wider uppercase opacity-90">Ce mois-ci dans ton panier</p>
            <h2 id="saison" className="font-display text-2xl leading-tight font-bold">De saison en {MONTHS[month - 1]}</h2>
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

      {/* 2. Le fil d'actu des médias. */}
      <section className="flex flex-col gap-3" aria-labelledby="actu">
        <div>
          <h2 id="actu" className="font-display text-xl font-bold">L&apos;actu qui fait du bien</h2>
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

      {/* 3. Le reste, plus discret : scanner et recettes. */}
      <Link href="/scanner" className="flex items-center gap-3 rounded-[18px] bg-papier px-4 py-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sauge text-sapin">
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
            <path d="M8 8v8M11 8v8M14 8v8M17 8v8" />
          </svg>
        </span>
        <span className="flex-1">
          <span className="block font-bold">Scanner un produit</span>
          <span className="block text-xs text-terre">Son impact et une alternative mieux notée</span>
        </span>
        <span aria-hidden="true" className="text-terre">›</span>
      </Link>

      <section className="flex flex-col gap-2" aria-labelledby="recettes">
        <h2 id="recettes" className="font-display text-xl font-bold">Recettes végé de la semaine</h2>
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
    </>
  );
}
