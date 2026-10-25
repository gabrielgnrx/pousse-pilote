/**
 * Les contenus de la semaine dont sont tirées les questions : 3 fiches gestes (en rotation, chaque
 * semaine différentes) et jusqu'à 3 bonnes nouvelles des médias. Le texte de chaque source est
 * exactement ce que voient les salariés dans S'informer.
 */
import { FICHES, weekNumber } from "../informer.ts";
import { TEMPLATE_BY_ID } from "../co2/challenges.ts";
import type { NewsItem } from "../news/rss.ts";

export interface QuizSource {
  id: string;
  kind: "fiche" | "actu";
  title: string;
  text: string;
  url: string | null;
}

export function ficheSources(isoMonday: string, n = 3): QuizSource[] {
  const ids = Object.keys(FICHES).filter((id) => TEMPLATE_BY_ID[id]);
  const start = (weekNumber(isoMonday) * n) % ids.length;
  return Array.from({ length: Math.min(n, ids.length) }, (_, i) => ids[(start + i) % ids.length]).map((id) => {
    const f = FICHES[id];
    return {
      id: `fiche:${id}`,
      kind: "fiche",
      title: TEMPLATE_BY_ID[id].title,
      text: [f.why, ...f.how, f.trap ?? ""].filter(Boolean).join(" "),
      url: null,
    };
  });
}

export function newsSources(items: NewsItem[], n = 3): QuizSource[] {
  return items
    .filter((it) => it.link.startsWith("https://") && it.excerpt.length >= 60)
    .slice(0, n)
    .map((it, i) => ({ id: `actu:${i + 1}`, kind: "actu", title: it.title, text: `${it.title}. ${it.excerpt}`, url: it.link }));
}
