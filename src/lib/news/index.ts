import { todayParis } from "../dates.ts";
import { parseFeed, pickGoodNews, type NewsItem, type NewsSource } from "./rss.ts";

export type { NewsItem } from "./rss.ts";

/** Médias suivis. Pour en ajouter un, il suffit d'ajouter son flux RSS ou Atom ici. */
export const NEWS_SOURCES: NewsSource[] = [
  { id: "vert", name: "Vert", url: "https://vert.eco/feed" },
  { id: "novethic", name: "Novethic", url: "https://www.novethic.fr/rss" },
  { id: "kaizen", name: "Kaizen", url: "https://www.kaizen-magazine.com/feed/", solutions: true },
  { id: "socialter", name: "Socialter", url: "https://www.socialter.fr/rss" },
  { id: "releve", name: "La Relève et La Peste", url: "https://lareleveetlapeste.fr/feed/" },
  { id: "reporterre", name: "Reporterre", url: "https://reporterre.net/spip.php?page=backend" },
  { id: "wedemain", name: "We Demain", url: "https://www.wedemain.fr/feed/", solutions: true },
  { id: "positivr", name: "Positivr", url: "https://positivr.fr/feed/", solutions: true },
];

// Les flux sont relus toutes les 3 heures : les nouveautés du matin arrivent dans la journée.
const REFRESH = 3 * 60 * 60;

async function fetchSource(source: NewsSource) {
  const res = await fetch(source.url, {
    headers: { "user-agent": "Pousse/1.1 (+https://pousse-pilote.vercel.app)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(6000),
    next: { revalidate: REFRESH, tags: ["news"] },
  });
  if (!res.ok) throw new Error(`${source.name}: HTTP ${res.status}`);
  return parseFeed(await res.text(), source.name, source.url);
}

// Cache mémoire du serveur, en plus du cache Next : une sélection par tranche de 3 heures.
let cache: { slot: string; items: NewsItem[] } | null = null;

/** État de la dernière lecture de chaque flux (nombre d'articles ou erreur), pour /api/news. */
export const feedStatus: Record<string, string> = {};

/**
 * Bonnes nouvelles écologiques du jour, tirées des vrais médias.
 * Ne lève jamais d'erreur : un média injoignable est simplement ignoré.
 */
export async function getDailyGoodNews(): Promise<NewsItem[]> {
  const slot = `${todayParis()}-${Math.floor(Date.now() / (REFRESH * 1000))}`;
  if (cache?.slot === slot && cache.items.length > 0) return cache.items;

  const results = await Promise.allSettled(NEWS_SOURCES.map(fetchSource));
  const all = results.flatMap((r, i) => {
    feedStatus[NEWS_SOURCES[i].name] =
      r.status === "fulfilled" ? `${r.value.length} articles` : `erreur : ${r.reason instanceof Error ? r.reason.message : r.reason}`;
    if (r.status === "fulfilled") return r.value;
    console.warn(`[news] ${NEWS_SOURCES[i].name} ignoré :`, r.reason instanceof Error ? r.reason.message : r.reason);
    return [];
  });

  const items = pickGoodNews(all, NEWS_SOURCES, new Date(), { limit: 6, perSource: 2, maxAgeDays: 6 });
  cache = { slot, items };
  return items;
}
