import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { formatKg } from "@/lib/co2/challenges.ts";
import { GRADE_LABEL, getCategoryProducts } from "@/lib/off";
import { CATEGORY_BY_TAG, estimateCategory } from "@/lib/off/categories";
import { GradeBadge } from "@/components/GradeBadge";

export const metadata = { title: "Scanner · Pousse" };

/**
 * Un rayon choisi dans le scanner : son impact estimé (médiane Agribalyse des
 * produits de la catégorie, affichée comme une estimation) et des alternatives mieux notées.
 */
export default async function CategoryPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: raw } = await params;
  const tag = decodeURIComponent(raw);
  const category = CATEGORY_BY_TAG[tag];
  if (!category) notFound();
  await requireProfile();

  const products = await getCategoryProducts(tag);
  const estimate = products ? estimateCategory(products) : null;

  return (
    <>
      <Link href="/scanner" className="text-sm font-semibold text-sapin">‹ Scanner</Link>
      <section className="card flex flex-col gap-3">
        <p className="label">Rayon</p>
        <h1 className="font-display text-2xl leading-snug">{category.label}</h1>
        {estimate ? (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-creme p-3">
              <GradeBadge grade={estimate.typicalGrade} size="lg" />
              <div className="flex-1">
                <p className="text-xs font-bold tracking-wider text-terre uppercase">Green-Score le plus courant</p>
                <p className="text-sm font-semibold">
                  {estimate.typicalGrade ? `La plupart des produits de ce rayon sont notés ${GRADE_LABEL[estimate.typicalGrade]}.` : "Ce rayon est peu noté pour l'instant."}
                </p>
              </div>
            </div>
            <p className="rounded-2xl bg-sauge px-4 py-3 text-sm text-sapin">
              {estimate.co2PerKg !== null ? (
                <>
                  <strong>≈ {formatKg(estimate.co2PerKg)} de CO₂ par kg</strong> : estimation pour la catégorie (médiane de{" "}
                  {estimate.sample} produits), pas pour ton produit précis.
                </>
              ) : (
                "Pas assez de données dans cette catégorie pour estimer son empreinte carbone."
              )}
            </p>
            <p className="text-xs text-terre">Scanne le code-barres pour la note et l&apos;empreinte exactes de ton produit.</p>
          </>
        ) : (
          <p className="text-sm text-brun">Open Food Facts ne répond pas pour le moment. Réessaie dans quelques minutes.</p>
        )}
      </section>

      {estimate?.alternatives.length ? (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-lg">Mieux notés dans ce rayon</h2>
            <p className="text-xs text-terre">Vendus en France. Ouvre une fiche pour la choisir : +5 pousses.</p>
          </div>
          {estimate.alternatives.map((a) => (
            <Link key={a.code} href={`/scanner/${a.code}`} className="card flex items-center gap-3">
              {a.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.image} alt="" className="size-14 shrink-0 rounded-lg bg-white object-contain" />
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block font-bold leading-snug">{a.name}</span>
                <span className="block text-xs text-terre">
                  {[a.brand, a.co2PerKg !== null ? `${formatKg(a.co2PerKg)} CO₂/kg` : null].filter(Boolean).join(" · ")}
                </span>
              </span>
              <GradeBadge grade={a.grade} />
            </Link>
          ))}
        </section>
      ) : null}

      <p className="text-center text-xs leading-relaxed text-terre">
        Données Open Food Facts (ODbL), Green-Score et Agribalyse (ADEME).
      </p>
    </>
  );
}
