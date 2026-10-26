import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/session";
import { monthLabel } from "@/lib/admin/report";
import { defaultMonth, loadReport, pickMonth } from "@/lib/admin/report-server";
import { ReportBody } from "./ReportBody";

export const metadata = { title: "Rapport mensuel · Pousse" };

/** Les 12 derniers mois terminés. */
function lastMonths(): string[] {
  const first = defaultMonth();
  const [y, m] = first.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
}

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ org?: string; mois?: string }> }) {
  const sp = await searchParams;
  const { supabase, org } = await requireAdmin(sp.org);
  if (!org) redirect("/admin/lancer");
  const month = pickMonth(sp.mois);
  const report = await loadReport(supabase, org.company_id, month);
  if (!report) return <p className="card text-sm">Le rapport n&apos;a pas pu se charger. Réessaie dans un instant.</p>;
  const { data } = report;
  const q = `org=${org.company_id}&mois=${month}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">{org.name}</p>
          <h1 className="font-display text-3xl first-letter:uppercase">{monthLabel(month)}</h1>
        </div>
        <form className="flex items-center gap-2" action="/admin/rapport">
          <input type="hidden" name="org" value={org.company_id} />
          <label htmlFor="mois" className="sr-only">Mois du rapport</label>
          <select id="mois" name="mois" defaultValue={month} className="input min-h-11 py-0 text-sm">
            {lastMonths().map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <button type="submit" className="btn-ghost min-h-11 text-sm">Afficher</button>
        </form>
      </div>

      <ReportBody figures={report.figures} narrative={report.narrative} quotes={report.quotes} teams={data.teams} k={data.k} />

      <p className="text-xs text-terre">
        Rapport calculé à partir des seuls totaux de l&apos;organisation, sans aucune donnée individuelle. Faits marquants
        et recommandations sont tirés de ces chiffres.
      </p>

      <section className="flex flex-wrap gap-2">
        <Link href={`/admin/rapport/imprimer?${q}`} className="btn-ghost min-h-11 text-sm">Exporter en PDF</Link>
        <a href={`/admin/export/mobilite?${q}`} className="btn-ghost min-h-11 text-sm">Mobilité domicile-travail (CSV)</a>
      </section>
    </>
  );
}
