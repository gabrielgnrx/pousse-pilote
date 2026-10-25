import type { KeyFigure } from "@/lib/admin/report";
import { Narrative } from "./Narrative";

/** Le corps du rapport, partagé par la page et la vue d'impression. */
export function ReportBody({ figures, narrative, quotes, teams, k }: {
  figures: KeyFigure[];
  narrative: string | null;
  quotes: string[];
  teams: { name: string; members: number }[];
  k: number;
}) {
  return (
    <>
      <section aria-labelledby="chiffres" className="card flex flex-col gap-2">
        <h2 id="chiffres" className="font-display text-lg">Chiffres clés</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {figures.map((f) => (
            <div key={f.label} className="flex items-baseline justify-between gap-3 border-b border-trait py-1">
              <dt className="text-sm text-brun">{f.label}</dt>
              <dd className="font-display text-lg">{f.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-terre">Valeurs masquées sous {k} personnes, pour protéger l&apos;anonymat.</p>
      </section>
      {narrative ? (
        <section aria-label="Synthèse" className="card">
          <Narrative text={narrative} />
        </section>
      ) : null}
      {teams.length ? (
        <section aria-labelledby="classement" className="card flex flex-col gap-1.5">
          <h2 id="classement" className="font-display text-lg">Classement des équipes</h2>
          <ol className="ml-5 list-decimal text-sm">
            {teams.map((t) => <li key={t.name}><span className="font-semibold">{t.name}</span> · {t.members} membres</li>)}
          </ol>
        </section>
      ) : null}
      {quotes.length ? (
        <section aria-labelledby="verbatims" className="card flex flex-col gap-2">
          <h2 id="verbatims" className="font-display text-lg">Dans les QG d&apos;équipe</h2>
          {quotes.map((q) => (
            <blockquote key={q} className="rounded-2xl bg-sauge px-4 py-2.5 text-sm text-sapin">« {q} »</blockquote>
          ))}
          <p className="text-xs text-terre">Messages publics des chats d&apos;équipe, sans auteur ; les prénoms sont remplacés.</p>
        </section>
      ) : null}
    </>
  );
}
