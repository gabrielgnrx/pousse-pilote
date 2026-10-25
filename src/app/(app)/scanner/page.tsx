import Link from "next/link";
import { requireProfile } from "@/lib/session";
import { parisMidnightISO, relativeTime } from "@/lib/dates";
import { normalizeGrade } from "@/lib/off/product.ts";
import { GradeBadge } from "@/components/GradeBadge";
import { Scanner } from "./Scanner";
import { PhotoScan } from "./PhotoScan";
import { CATEGORY_BY_TAG } from "@/lib/off/categories";

const PHOTO_STATUS: Record<string, string> = {
  format: "Photo au format JPEG, PNG ou WebP, 5 Mo au plus.",
  indisponible: "La reconnaissance par photo est indisponible pour le moment : scanne le code-barres ou tape-le.",
  inconnu: "Je n'ai pas reconnu ce produit. Essaie le code-barres, ou une photo plus nette du produit.",
  choix: "Je ne suis pas sûr. C'est l'un de ces rayons ?",
};

export const metadata = { title: "Scanner · Pousse" };

const EXAMPLES = [
  { code: "3017620422003", label: "Pâte à tartiner" },
  { code: "3033490506629", label: "Fromage blanc" },
  { code: "3560070894222", label: "Sirop de cerise" },
];

export default async function ScannerPage({ searchParams }: { searchParams: Promise<{ photo?: string; c?: string }> }) {
  const { photo, c } = await searchParams;
  const choices = (c ?? "").split(",").filter((t) => CATEGORY_BY_TAG[t]);
  const { supabase, user } = await requireProfile();
  const [{ data: scans }, { count: swapsToday }] = await Promise.all([
    supabase
      .from("product_scans")
      .select("code, name, grade, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("product_swaps")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", parisMidnightISO()),
  ]);
  // Un produit par ligne, le plus récent.
  const history = [...new Map((scans ?? []).map((s) => [s.code, s])).values()].slice(0, 8);

  return (
    <>
      <div>
        <h1 className="font-display text-2xl">Scanner</h1>
        <p className="mt-1 text-sm text-terre">
          L&apos;impact d&apos;un produit en un scan, et de meilleures options dans le même rayon.
        </p>
      </div>

      <Scanner />

      {photo && PHOTO_STATUS[photo] ? (
        <div role="status" className="flex flex-col gap-2 rounded-2xl bg-peche px-4 py-3 text-sm font-semibold text-argile-fonce">
          {PHOTO_STATUS[photo]}
          {photo === "choix" && choices.length ? (
            <span className="flex flex-wrap gap-1.5">
              {choices.map((t) => (
                <Link key={t} href={`/scanner/categorie/${encodeURIComponent(t)}`} className="chip min-h-9 bg-papier text-encre">
                  {CATEGORY_BY_TAG[t].label}
                </Link>
              ))}
            </span>
          ) : null}
        </div>
      ) : null}
      <PhotoScan />

      <p className="rounded-2xl bg-peche px-4 py-3 text-sm text-[#3f4a3c]">
        <strong>+5 pousses</strong> chaque fois que tu choisis une alternative mieux notée, jusqu&apos;à 3 fois par
        jour{swapsToday ? ` (${Math.min(3, swapsToday)}/3 aujourd'hui)` : ""}.
      </p>

      {history.length ? (
        <section className="card flex flex-col gap-1 py-3">
          <h2 className="label">Tes derniers scans</h2>
          <ul>
            {history.map((s) => (
              <li key={s.code} className="border-t border-encre/10 first:border-0">
                <Link href={`/scanner/${s.code}`} className="flex items-center gap-3 py-2">
                  <GradeBadge grade={normalizeGrade(s.grade)} size="sm" />
                  <span className="flex-1 text-sm font-semibold">{s.name ?? s.code}</span>
                  <span className="text-xs text-terre">{relativeTime(s.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="flex flex-col gap-2">
          <p className="text-sm text-terre">Pas de produit sous la main ? Essaie avec :</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <Link key={e.code} href={`/scanner/${e.code}`} className="chip bg-sable py-2 text-sm">
                {e.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="text-center text-xs text-terre">
        Données{" "}
        <a href="https://world.openfoodfacts.org" className="underline" target="_blank" rel="noopener noreferrer">
          Open Food Facts
        </a>{" "}
        (licence ODbL) · Green-Score et empreinte carbone Agribalyse (ADEME). Produits alimentaires uniquement.
      </p>
    </>
  );
}
