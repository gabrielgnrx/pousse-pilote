import "server-only";
import { z } from "zod";
import { keyFigures, monthNarrative, parseReportData, pickQuotes, type KeyFigure, type ReportData } from "./report.ts";

type Db = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

export const monthParam = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

/** Le mois par défaut : le mois précédent (un rapport porte sur un mois terminé). */
export function defaultMonth(now = new Date()): string {
  const paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const d = new Date(Date.UTC(paris.getFullYear(), paris.getMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}

export function pickMonth(raw: string | undefined): string {
  const parsed = monthParam.safeParse(raw);
  return parsed.success ? parsed.data : defaultMonth();
}

/** Le rapport d'un mois, calculé à chaque affichage à partir des agrégats de la base. */
export async function loadReport(
  supabase: Db,
  companyId: string,
  month: string,
): Promise<{ data: ReportData; figures: KeyFigure[]; narrative: string; quotes: string[] } | null> {
  const { data: raw, error } = await supabase.rpc("admin_report_data", { p_company: companyId, p_month: `${month}-01` });
  if (error || !raw) return null;
  const data = parseReportData(raw);
  return { data, figures: keyFigures(data), narrative: monthNarrative(data), quotes: pickQuotes(data.quotes) };
}
