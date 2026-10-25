import Link from "next/link";
import { TEMPLATE_BY_ID, formatKg } from "@/lib/co2/challenges.ts";
import type { PlanEntry } from "@/lib/plan/weekly.ts";

const SIGNAL: Record<PlanEntry["signal"], { label: string; className: string } | null> = {
  nouveau: null,
  en_cours: { label: "En cours", className: "bg-sauge text-sapin" },
  sur_sa_lancee: { label: "Sur ta lancée", className: "bg-feuille text-encre" },
  abandonne: { label: "À reprendre en douceur", className: "bg-peche text-argile-fonce" },
};

const LEVELS = [
  { id: "facile", label: "Facile" },
  { id: "possible", label: "Possible" },
  { id: "difficile", label: "Difficile" },
  { id: "impossible", label: "Pas pour moi" },
] as const;

/**
 * « Ton plan de la semaine » : 3 défis choisis pour la personne, chacun avec sa phrase « pourquoi toi ».
 * La faisabilité déclarée (« C'est faisable ? ») fait évoluer le plan.
 */
export function WeeklyPlan({
  items,
  source,
  feasibility,
  setFeasibility,
}: {
  items: PlanEntry[];
  source: "regles" | "ia" | "mock";
  feasibility: Record<string, string>;
  setFeasibility: (form: FormData) => Promise<void>;
}) {
  return (
    <section aria-labelledby="plan-semaine" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <h2 id="plan-semaine" className="font-display text-[21px]">Ton plan de la semaine</h2>
        <span className="text-xs text-terre">recalculé chaque lundi</span>
      </div>
      <ol className="flex flex-col gap-2.5">
        {items.map((e, i) => {
          const t = TEMPLATE_BY_ID[e.template_id];
          if (!t) return null;
          const badge = SIGNAL[e.signal];
          const current = feasibility[e.template_id];
          return (
            <li key={e.template_id} className="card flex flex-col gap-2.5">
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sapin font-display text-lg text-sapin-clair">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold leading-snug">{t.title}</h3>
                  <p className="mt-1 text-sm leading-snug text-brun">{e.reason}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="chip bg-sauge text-sapin">≈ {formatKg(e.kg_year)} évités par an</span>
                    {badge ? <span className={`chip ${badge.className}`}>{badge.label}</span> : null}
                  </div>
                </div>
                <Link
                  href={`/defis/nouveau/${t.id}`}
                  aria-label={`Lancer : ${t.title}`}
                  className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-feuille text-encre shadow-[inset_0_-4px_0_var(--color-feuille-fonce)]"
                >
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                </Link>
              </div>
              <form action={setFeasibility} className="flex flex-wrap items-center gap-1.5">
                <input type="hidden" name="template" value={e.template_id} />
                <span className="text-xs font-semibold text-terre">C&apos;est faisable pour toi ?</span>
                {LEVELS.map((l) => (
                  <button
                    key={l.id}
                    name="level"
                    value={l.id}
                    aria-pressed={current === l.id}
                    className={`min-h-9 rounded-full px-3 text-xs font-semibold ${current === l.id ? "bg-sapin text-sapin-clair" : "border border-trait bg-papier text-brun"}`}
                  >
                    {l.label}
                  </button>
                ))}
              </form>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-terre">
        {source === "regles"
          ? "Classés selon ce qui pèse le plus dans ton bilan et ce que tu juges faisable."
          : "Défis classés par Pousse selon ton bilan ; les phrases sont rédigées par le coach IA de Pousse, qui ne voit que des totaux anonymes."}{" "}
        Le CO₂ est toujours calculé avec les facteurs de l&apos;ADEME, jamais par l&apos;IA.
      </p>
    </section>
  );
}
