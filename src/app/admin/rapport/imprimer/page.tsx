import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/session";
import { monthLabel } from "@/lib/admin/report";
import { loadReport, pickMonth } from "@/lib/admin/report-server";
import { ReportBody } from "../ReportBody";
import { PrintButton } from "./PrintButton";

export const metadata = { title: "Rapport mensuel (PDF) · Pousse" };

/** Vue d'impression du rapport : le navigateur l'enregistre en PDF, sans bibliothèque en plus. */
export default async function PrintReport({ searchParams }: { searchParams: Promise<{ org?: string; mois?: string }> }) {
  const sp = await searchParams;
  const { supabase, org } = await requireAdmin(sp.org);
  if (!org) redirect("/admin/lancer");
  const month = pickMonth(sp.mois);
  const report = await loadReport(supabase, org.company_id, month);
  if (!report) return <p className="card text-sm">Le rapport n&apos;a pas pu se charger.</p>;
  const { data } = report;
  return (
    <article className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Programme climat · {org.name}</p>
          <h1 className="font-display text-3xl first-letter:uppercase">Rapport de {monthLabel(month)}</h1>
        </div>
        <PrintButton />
      </header>
      <ReportBody figures={report.figures} narrative={report.narrative} quotes={report.quotes} teams={data.teams} k={data.k} />
      <p className="text-xs text-terre">
        CO₂ évité calculé par Pousse avec les facteurs d&apos;émission de l&apos;ADEME (Base Empreinte, Agribalyse), par rapport aux
        habitudes déclarées par chaque participant. Données agrégées uniquement.
      </p>
    </article>
  );
}
