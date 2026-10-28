import Link from "next/link";
import { CATEGORY_LABEL, TEMPLATE_BY_ID, formatKg } from "@/lib/co2/challenges.ts";
import type { PlanEntry } from "@/lib/plan/weekly.ts";

const SIGNAL: Record<PlanEntry["signal"], { label: string; className: string } | null> = {
  nouveau: null,
  en_cours: { label: "En cours", className: "bg-sauge text-sapin" },
  sur_sa_lancee: { label: "Sur ta lancée", className: "bg-pollen text-encre" },
  abandonne: { label: "À reprendre en douceur", className: "bg-pollen-pale text-pollen-texte" },
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
  feasibility,
  setFeasibility,
}: {
  items: PlanEntry[];
  feasibility: Record<string, string>;
  setFeasibility: (form: FormData) => Promise<void>;
}) {
  return (
    <section aria-labelledby="plan-semaine" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <h2 id="plan-semaine" className="font-display text-xl">Proposés pour toi</h2>
        <span className="text-[13px] text-brun">recalculé chaque lundi</span>
      </div>
      <ol className="flex flex-col gap-2">
        {items.map((e) => {
          const t = TEMPLATE_BY_ID[e.template_id];
          if (!t) return null;
          const badge = SIGNAL[e.signal];
          const current = feasibility[e.template_id];
          return (
            <li key={e.template_id} className="flex flex-col gap-3 rounded-[20px] bg-papier py-3 pr-3 pl-4">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="label">{CATEGORY_LABEL[t.category]}</p>
                  <h3 className="mt-0.5 text-base leading-snug font-bold">{t.title}</h3>
                  <p className="mt-1 text-sm leading-snug text-brun">{e.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="chip bg-sauge text-sapin">≈ −{formatKg(e.kg_year)} par an</span>
                    {badge ? <span className={`chip ${badge.className}`}>{badge.label}</span> : null}
                  </div>
                </div>
                <Link
                  href={`/defis/nouveau/${t.id}`}
                  aria-label={`Lancer : ${t.title}`}
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-chloro text-white transition active:scale-95"
                >
                  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </Link>
              </div>
              <form action={setFeasibility} className="flex flex-wrap items-center gap-1.5 border-t border-sable pt-2.5">
                <input type="hidden" name="template" value={e.template_id} />
                <span className="w-full text-xs font-semibold text-brun">C&apos;est faisable pour toi ?</span>
                {LEVELS.map((l) => (
                  <button
                    key={l.id}
                    name="level"
                    value={l.id}
                    aria-pressed={current === l.id}
                    className={`min-h-9 rounded-full px-3 text-xs font-bold ${current === l.id ? "bg-nuit text-white" : "bg-sable text-sapin"}`}
                  >
                    {l.label}
                  </button>
                ))}
              </form>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-brun">
        Classés selon ce qui pèse le plus dans ton bilan et ce que tu juges faisable. Le CO₂ est calculé avec les
        facteurs de l&apos;ADEME.
      </p>
    </section>
  );
}
