import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHabits } from "@/lib/session";
import { CATEGORY_LABEL, GESTES, TEMPLATE_BY_ID, formatKg, templateEligibility, verbOf } from "@/lib/co2/challenges.ts";
import { FICHES } from "@/lib/informer";

export default async function FicheGestePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = TEMPLATE_BY_ID[id];
  const fiche = FICHES[id];
  if (!t || !fiche) notFound();
  const { habits } = await requireHabits();
  const e = templateEligibility(t, habits);
  const isGeste = GESTES.some((g) => g.id === id);
  const best = e.impacts.filter((i) => i.impact.eligible).sort((a, b) => b.impact.kg - a.impact.kg)[0];

  return (
    <>
      <Link href="/informer#fiches" className="flex size-11 items-center justify-center rounded-full bg-papier" aria-label="Retour à S'informer">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
      </Link>

      <div>
        <p className="text-xs font-bold tracking-wider text-argile-fonce uppercase">
          {verbOf(t.id)} · {CATEGORY_LABEL[t.category]}
        </p>
        <h1 className="mt-1 font-display text-[26px] leading-tight font-bold">{t.title}</h1>
      </div>

      <section className="flex flex-col gap-1 rounded-[20px] bg-sapin p-4 text-sapin-clair">
        <p className="text-sm opacity-90">Pour toi, d&apos;après ton bilan</p>
        {best ? (
          <>
            <p className="font-display text-3xl font-bold">
              −{formatKg(best.impact.kg)} <span className="text-base">par {t.unit.one}</span>
            </p>
            <p className="text-xs opacity-90">
              {t.variants.length > 1 ? `${best.variant.label} : ` : ""}
              {best.impact.formula}
            </p>
          </>
        ) : (
          <p className="text-base font-semibold">
            {isGeste ? "Pas de CO₂ mesurable, mais ce geste compte pour tes pousses et ta série." : e.reason}
          </p>
        )}
      </section>

      <section className="card flex flex-col gap-1.5">
        <h2 className="font-bold">Pourquoi ça compte</h2>
        <p className="text-sm leading-relaxed text-brun">{fiche.why}</p>
      </section>

      <section className="card flex flex-col gap-2">
        <h2 className="font-bold">Comment t&apos;y prendre</h2>
        <ol className="flex flex-col gap-2">
          {fiche.how.map((step, i) => (
            <li key={step} className="flex gap-3 text-sm leading-snug">
              <span className="font-bold text-sapin">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {fiche.trap ? <p className="mt-1 rounded-xl bg-peche px-3 py-2 text-sm text-[#5a4324]"><strong>Piège :</strong> {fiche.trap}</p> : null}
      </section>

      <div className="flex flex-col gap-2">
        <Link href="/agir" className="btn-dark">Je l&apos;ai fait aujourd&apos;hui</Link>
        {!isGeste && e.eligible ? (
          <Link href={`/defis/nouveau/${t.id}`} className="btn-ghost">En faire un défi sur plusieurs jours</Link>
        ) : null}
      </div>
      <p className="text-center text-xs text-terre">
        Source :{" "}
        <a href={t.source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          ADEME, Impact CO₂
        </a>
      </p>
    </>
  );
}
