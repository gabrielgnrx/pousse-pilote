import { createClient } from "@/lib/supabase/server";
import { defaultMonth, monthParam } from "@/lib/admin/report-server";
import { toCsv } from "@/lib/admin/csv";

export const dynamic = "force-dynamic";

/**
 * Export CSV de la mobilité domicile-travail, agrégée par mois et par mode (scope 3, forfait mobilités
 * durables). Par défaut, les 12 mois qui finissent par le mois demandé. Cellule vide : moins de 5 personnes.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const org = url.searchParams.get("org") ?? "";
  const parsed = monthParam.safeParse(url.searchParams.get("mois") ?? undefined);
  const month = parsed.success ? parsed.data : defaultMonth();
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_org_admin", { p_company: org });
  if (isAdmin !== true) return new Response("Accès refusé.", { status: 403 });

  const [y, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 12, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const { data, error } = await supabase.rpc("admin_mobility_csv", { p_company: org, p_from: from, p_to: to });
  if (error) return new Response("Export indisponible.", { status: 503 });

  const csv = toCsv(
    ["mois", "mode", "trajets", "km", "kg_co2e_evites", "personnes"],
    (data ?? []).map((r: { month: string; mode: string; trips: number | null; km: number | null; kg_avoided: number | null; people: number | null }) => [
      r.month, r.mode, r.trips, r.km, r.kg_avoided, r.people,
    ]),
  );
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="pousse-mobilite-${from.slice(0, 7)}_${month}.csv"`,
      "cache-control": "no-store",
    },
  });
}
