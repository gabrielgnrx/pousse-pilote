import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { carKmEquivalent, formatKg } from "@/lib/co2/challenges.ts";
import { GRADE_LABEL, getAlternatives, getProduct, isBarcode, packageCo2, type Product } from "@/lib/off";
import { GradeBadge } from "@/components/GradeBadge";
import { chooseAlternative } from "../actions";

const VERDICT: Record<string, string> = {
  "a-plus": "Excellent choix pour la planète.",
  a: "Très bon choix pour la planète.",
  b: "Bon choix.",
  c: "Impact moyen : il existe souvent mieux dans le même rayon.",
  d: "Impact élevé : regarde les alternatives ci-dessous.",
  e: "Impact très élevé : une alternative ferait vraiment la différence.",
  f: "Impact très élevé : une alternative ferait vraiment la différence.",
};

function Co2Line({ p }: { p: Product }) {
  if (p.co2PerKg === null) return <p className="text-sm text-terre">Empreinte carbone non disponible.</p>;
  const pack = packageCo2(p);
  return (
    <p className="text-sm">
      <strong className="font-display text-lg">{p.co2PerKg.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg CO₂e</strong> par kg
      {pack !== null ? (
        <span className="block text-xs text-terre">
          soit {formatKg(pack)} pour ce produit ({p.quantity ?? `${p.grams} g`}), comme {Math.max(1, carKmEquivalent(pack))} km en voiture
        </span>
      ) : null}
    </p>
  );
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ choix?: string; erreur?: string }>;
}) {
  const { code } = await params;
  const { choix, erreur } = await searchParams;
  if (!isBarcode(code)) notFound();
  const { supabase, user, profile } = await requireProfile();

  const product = await getProduct(code);
  if (!product) {
    return (
      <>
        <Link href="/scanner" className="text-sm font-semibold text-terre">‹ Scanner</Link>
        <section className="card flex flex-col gap-2 text-center">
          <p className="font-display text-lg">Produit introuvable</p>
          <p className="text-sm text-brun">
            Le code {code} n&apos;est pas (encore) dans Open Food Facts, ou le service ne répond pas. Tu peux
            l&apos;ajouter avec l&apos;application Open Food Facts : il sera noté pour tout le monde.
          </p>
          <Link href="/scanner" className="btn-primary mt-1">Scanner un autre produit</Link>
        </section>
      </>
    );
  }

  // Historique personnel (pas plus d'une ligne par produit toutes les 10 minutes).
  const { data: recent } = await supabase
    .from("product_scans")
    .select("id")
    .eq("user_id", user.id)
    .eq("code", code)
    .gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString())
    .limit(1);
  if (!recent?.length) {
    await supabase.from("product_scans").insert({
      user_id: user.id,
      company_id: profile.company_id,
      code,
      name: product.name.slice(0, 200),
      grade: product.grade,
      co2_kg_per_kg: product.co2PerKg,
    });
  }

  const noAlternatives = product.grade === "a-plus" || product.gradeStatus === "not-applicable";
  const { products: alternatives, available } = noAlternatives
    ? { products: [] as Product[], available: true }
    : await getAlternatives(product);

  return (
    <>
      <Link href="/scanner" className="flex h-11 w-fit items-center gap-1.5 text-sm font-semibold text-terre">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        Scanner
      </Link>

      {choix ? (
        <p role="status" className="animate-pousse-pop -mt-2 rounded-2xl bg-abricot px-4 py-3 text-sm font-bold text-encre">
          Bien joué : +5 pousses pour ce meilleur choix !
        </p>
      ) : null}
      {erreur ? (
        <p role="alert" className="-mt-2 rounded-2xl bg-peche px-4 py-3 text-sm font-semibold text-alerte">{erreur}</p>
      ) : null}

      <section className="card flex flex-col gap-3">
        <div className="flex gap-3">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt="" className="size-20 shrink-0 rounded-xl bg-white object-contain" />
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl leading-snug">{product.name}</h1>
            <p className="text-sm text-terre">
              {[product.brand, product.quantity].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-creme p-3">
          <GradeBadge grade={product.grade} size="lg" />
          <div className="flex-1">
            <p className="text-xs font-bold tracking-wider text-terre uppercase">Green-Score</p>
            <p className="text-sm font-semibold">
              {product.grade
                ? VERDICT[product.grade]
                : product.gradeStatus === "not-applicable"
                  ? "Le Green-Score ne note pas ce type de produit (eaux, sodas, alcools…)."
                  : "Ce produit n'est pas encore noté."}
            </p>
          </div>
        </div>
        <Co2Line p={product} />
        {product.agribalyseName ? (
          <p className="text-xs text-terre">Calculé à partir de l&apos;aliment Agribalyse « {product.agribalyseName} ».</p>
        ) : null}
      </section>

      {noAlternatives ? null : (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-lg">Mieux pour la planète</h2>
            <p className="text-xs text-terre">Dans le même rayon, vendus en France. Choisis-en un : +5 pousses.</p>
          </div>
          {alternatives.length === 0 ? (
            <p className="card text-sm text-brun">
              {available
                ? "Pas d'alternative mieux notée trouvée pour l'instant dans cette catégorie."
                : "La recherche d'alternatives d'Open Food Facts est saturée pour le moment. Réessaie dans quelques minutes : la note et l'empreinte ci-dessus restent valables."}
            </p>
          ) : null}
          {alternatives.map((a) => {
            const chosen = choix === a.code;
            const delta =
              a.co2PerKg !== null && product.co2PerKg !== null && product.co2PerKg > 0
                ? Math.round((1 - a.co2PerKg / product.co2PerKg) * 100)
                : null;
            return (
              <article key={a.code} className={`card flex flex-col gap-2 ${chosen ? "border-2 border-sapin" : ""}`}>
                <Link href={`/scanner/${a.code}`} className="flex items-center gap-3">
                  {a.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.image} alt="" className="size-14 shrink-0 rounded-lg bg-white object-contain" />
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold leading-snug">{a.name}</span>
                    <span className="block text-xs text-terre">{[a.brand, a.quantity].filter(Boolean).join(" · ")}</span>
                  </span>
                  <GradeBadge grade={a.grade} />
                </Link>
                <div className="flex items-center gap-2">
                  {a.grade && product.grade ? (
                    <span className="chip bg-sauge text-sapin">
                      {GRADE_LABEL[product.grade]} → {GRADE_LABEL[a.grade]}
                    </span>
                  ) : null}
                  {delta !== null && delta > 0 ? <span className="chip bg-sauge text-sapin">−{delta} % de CO₂</span> : null}
                  <span className="flex-1" />
                  {chosen ? (
                    <span className="chip bg-sapin text-sapin-clair">✓ Choisi</span>
                  ) : (
                    <form action={chooseAlternative}>
                      <input type="hidden" name="from" value={product.code} />
                      <input type="hidden" name="to" value={a.code} />
                      <button type="submit" className="flex h-10 items-center rounded-full bg-argile px-3.5 text-sm font-bold text-white">
                        Je prends celui-ci · +5
                      </button>
                    </form>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <p className="text-center text-xs leading-relaxed text-terre">
        Le scanner rapporte des pousses, pas de CO₂ évité : on ne sait pas ce que tu aurais acheté sinon.
        Données{" "}
        <a href={`https://world.openfoodfacts.org/product/${product.code}`} className="underline" target="_blank" rel="noopener noreferrer">
          Open Food Facts
        </a>{" "}
        (ODbL), Green-Score et Agribalyse (ADEME).
      </p>
    </>
  );
}
