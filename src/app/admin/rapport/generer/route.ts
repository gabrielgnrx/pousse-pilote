import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAiClient, aiMockEnabled } from "@/lib/ai/client";
import { adminStore } from "@/lib/ai/store";
import { streamText, type StreamingClient } from "@/lib/ai/stream";
import { RAPPORT_VERSION, rapportTask, rapportUser } from "@/lib/ai/prompts/rapport";
import { fallbackNarrative, monthLabel, numbersSupported, reportFacts } from "@/lib/admin/report";
import { loadReport, monthParam } from "@/lib/admin/report-server";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const body = z.object({ org: z.guid(), month: monthParam });

/** Rapports générés par l'IA par organisation et par jour. */
const DAILY_LIMIT = 5;

/**
 * Rédige la synthèse du rapport mensuel en flux (texte brut) à partir des agrégats seulement.
 * À la fin, le code vérifie que chaque chiffre cité figure dans les agrégats ; sinon, le texte des
 * règles est enregistré à la place. La page se recharge ensuite sur la version enregistrée.
 */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("Requête invalide.", { status: 400 });
  const { org, month } = parsed.data;
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_org_admin", { p_company: org });
  if (isAdmin !== true) return new Response("Accès refusé.", { status: 403 });
  const report = await loadReport(supabase, org, month);
  if (!report) return new Response("Données indisponibles.", { status: 503 });

  const facts = reportFacts(report.data);
  const base = { figures: report.figures, quotes: report.quotes };
  const save = (narrative: string, source: "ia" | "gabarit" | "mock", replaced = false) =>
    supabase.rpc("admin_save_report", {
      p_company: org,
      p_month: `${month}-01`,
      p_content: { ...base, narrative, replaced },
      p_source: source,
      p_version: source === "ia" ? RAPPORT_VERSION : null,
    });

  const encoder = new TextEncoder();
  const client = getAiClient() as unknown as StreamingClient | null;
  const store = adminStore(supabase, org);
  // Pas de clé, mode simulé, ou trop de rapports aujourd'hui : le texte des règles, sans appel à l'IA.
  const mock = aiMockEnabled();
  const allowed = !mock && client !== null && (await store.consume(rapportTask.id, DAILY_LIMIT, DAILY_LIMIT));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (t: string) => controller.enqueue(encoder.encode(t));
      if (!allowed || !client) {
        const text = fallbackNarrative(report.data);
        send(text);
        await save(text, mock ? "mock" : "gabarit");
        controller.close();
        return;
      }
      const text = await streamText(client, rapportTask, rapportUser(monthLabel(month), facts), store, send);
      if (text && numbersSupported(text, facts)) await save(text.trim(), "ia");
      else await save(fallbackNarrative(report.data), "gabarit", text !== null);
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
