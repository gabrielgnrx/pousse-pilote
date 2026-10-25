import "server-only";
import { z } from "zod";
import { keyFigures, parseReportData, pickQuotes, type KeyFigure, type ReportData } from "./report.ts";

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

export const savedSchema = z.object({
  narrative: z.string().max(6000),
  figures: z.array(z.object({ label: z.string(), value: z.string() })).max(10),
  quotes: z.array(z.string()).max(3),
  replaced: z.boolean().optional(),
});
export type SavedReport = z.infer<typeof savedSchema> & { source: string; created_at: string };

export async function loadReport(
  supabase: Db,
  companyId: string,
  month: string,
): Promise<{ data: ReportData; figures: KeyFigure[]; quotes: string[]; saved: SavedReport | null } | null> {
  const [{ data: raw, error }, { data: row }] = await Promise.all([
    supabase.rpc("admin_report_data", { p_company: companyId, p_month: `${month}-01` }),
    supabase.from("monthly_reports").select("content, source, created_at").eq("company_id", companyId).eq("month", `${month}-01`).maybeSingle(),
  ]);
  if (error || !raw) return null;
  const data = parseReportData(raw);
  const content = row ? savedSchema.safeParse(row.content) : null;
  const saved = row && content?.success ? { ...content.data, source: row.source as string, created_at: row.created_at as string } : null;
  return { data, figures: keyFigures(data), quotes: pickQuotes(data.quotes), saved };
}
