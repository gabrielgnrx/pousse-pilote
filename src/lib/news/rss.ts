/**
 * Lecture des flux RSS / Atom des médias et sélection des bonnes nouvelles.
 * Fonctions pures, sans dépendance : testées dans news.test.ts.
 */

export interface NewsSource {
  id: string;
  name: string;
  url: string;
  /** Média orienté solutions : ses articles sont gardés sauf s'ils sont clairement négatifs. */
  solutions?: boolean;
}

export interface NewsItem {
  source: string;
  title: string;
  link: string;
  excerpt: string;
  image: string | null;
  publishedAt: string; // ISO
  score: number;
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  laquo: "«", raquo: "»", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  hellip: "…", ndash: "–", mdash: "—", eacute: "é", egrave: "è", agrave: "à",
  ecirc: "ê", ccedil: "ç", ocirc: "ô", icirc: "î", ucirc: "û", oelig: "œ",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

/** Texte brut d'un fragment HTML (balises retirées, entités décodées, espaces normalisés). */
export function toText(html: string): string {
  return decodeEntities(stripCdata(html).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? stripCdata(m[1]).trim() : null;
}

function attr(block: string, name: string, attribute: string, where?: RegExp): string | null {
  const re = new RegExp(`<${name}\\s[^>]*>`, "gi");
  for (const m of block.matchAll(re)) {
    if (where && !where.test(m[0])) continue;
    const a = m[0].match(new RegExp(`${attribute}\\s*=\\s*["']([^"']+)["']`, "i"));
    if (a) return decodeEntities(a[1]);
  }
  return null;
}

function cleanUrl(url: string | null, base: string): string | null {
  if (!url) return null;
  let u = url.trim();
  // Certains flux répètent le domaine : https://www.site.fr/www.site.fr/wp-content/...
  u = u.replace(/^(https?:\/\/)([^/]+)\/\2\//, "$1$2/");
  try {
    const abs = new URL(u, base);
    return abs.protocol === "https:" || abs.protocol === "http:" ? abs.href : null;
  } catch {
    return null;
  }
}

function excerptOf(text: string, max = 160): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).trimEnd()}…`;
}

/** Lit un flux RSS 2.0 ou Atom et renvoie ses articles (sans score). */
export function parseFeed(xml: string, sourceName: string, feedUrl: string): Omit<NewsItem, "score">[] {
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const blocks = xml.match(isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  const items: Omit<NewsItem, "score">[] = [];

  for (const b of blocks) {
    const title = toText(tag(b, "title") ?? "");
    const link = isAtom
      ? attr(b, "link", "href", /rel=["']alternate["']/i) ?? attr(b, "link", "href", /^(?![\s\S]*rel=)/) ?? attr(b, "link", "href")
      : tag(b, "link") ?? tag(b, "guid");
    const href = cleanUrl(link ? decodeEntities(link) : null, feedUrl);
    if (!title || !href) continue;

    const body = tag(b, "description") ?? tag(b, "summary") ?? tag(b, "content:encoded") ?? tag(b, "content") ?? "";
    const rawImage =
      attr(b, "media:thumbnail", "url") ??
      attr(b, "media:content", "url", /medium=["']image["']|type=["']image/i) ??
      attr(b, "media:content", "url") ??
      attr(b, "enclosure", "url", /type=["']image/i) ??
      tag(b, "image") ??
      (decodeEntities(stripCdata(b)).match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null);

    const dateStr = tag(b, "pubDate") ?? tag(b, "published") ?? tag(b, "updated") ?? tag(b, "dc:date");
    const date = dateStr ? new Date(dateStr) : null;
    if (!date || Number.isNaN(date.getTime())) continue;

    items.push({
      source: sourceName,
      title,
      link: href,
      excerpt: excerptOf(toText(body)),
      image: cleanUrl(rawImage ? toText(rawImage) : null, href),
      publishedAt: date.toISOString(),
    });
  }
  return items;
}

// --- Sélection des bonnes nouvelles ---------------------------------------------------------

/** Racines de mots (sans accents, en minuscules) qui signalent une avancée. */
const POSITIVE = [
  "bat un record", "record de production", "reussi", "succes", "victoire", "gagne", " adopte",
  "protege", "protection", "restaur", "renatur", "reboise", "replant", "retour d", "revient", "reapparait",
  "sauve", "renouvelable", "solaire", "eolien", "photovolta", "geotherm", "baisse des emissions",
  "emissions baissent", "recul des emissions", "decarbon", "sobriete", "solution", "initiative",
  "innov", "inaugur", " lance", " ouvre", "reemploi", "reparation", "repar", "recycl", "seconde main",
  "velo", "covoiturage", "train de nuit", "transition", "agroecolog", "bio ", "vegetal", "compost",
  "biodiversite", "foret", "haie", "abeille", "pollinis", "cooperative", "citoyen", "regener",
  "economie d'energie", "renov", "isolation", "pompe a chaleur", "zero dechet", "interdit les",
  "interdiction des", "bonne nouvelle", "espoir", "progres", " encourage", " accord", " engage",
];

/** Racines qui signalent une mauvaise nouvelle : l'article est écarté s'il en contient trop. */
const NEGATIVE = [
  " mort", "deces", " tue ", " tues ", "victime", "catastroph", "drame", "tragedie", "incendie", "feux de foret",
  "secheresse", "inondation", "canicule", "tempete", "ouragan", "seisme", "pollu", "contamin",
  "pesticide", "toxique", "danger", "menace", "alerte", "alarm", "crise", "effondr", "extinction",
  "disparition", "declin", "recul de la biodiversite", "record de chaleur", "records de chaleur",
  " cede", " report d", " reporte", "abandon", "renonce", "detricot", "condamn", " proces ", "plainte", "attaque",
  "violence", "guerre", "scandale", "fraude", "greenwashing", " rn ", "extreme droite",
  "blocage", "bloque", "arrest", "police", "greve", "lyceen", "sans convaincre", "levee de boucliers", "insuffisant", "critique", "inegal", "colere", " rage", "contre les", "faire la peau", " pire", "inquiet", "echec", "hausse des emissions",
];

/** Note minimale pour être retenue comme bonne nouvelle. */
export const MIN_SCORE = 2;

/** Un titre qui annonce lui-même une mauvaise nouvelle est toujours écarté. */
export function hasNegativeTitle(title: string): boolean {
  return hits(normalize(title), NEGATIVE) > 0;
}

export function normalize(s: string): string {
  const base = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'");
  return ` ${base.replace(/[^a-z0-9']+/g, " ")} `;
}

function hits(text: string, words: string[]): number {
  return words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);
}

/**
 * Note de « bonne nouvelle » : le titre compte double. Positive = gardée.
 * Les médias orientés solutions partent avec un bonus.
 */
export function positivityScore(title: string, excerpt: string, solutions = false): number {
  const t = normalize(title);
  const e = normalize(excerpt);
  const pos = 2 * hits(t, POSITIVE) + hits(e, POSITIVE);
  const neg = 3 * hits(t, NEGATIVE) + hits(e, NEGATIVE);
  return pos - neg + (solutions ? 2 : 0);
}

/** Bonus de fraîcheur : un article du jour passe devant un « meilleur » article de la semaine dernière. */
export function freshnessBonus(publishedAt: string, now: Date): number {
  const hours = (now.getTime() - new Date(publishedAt).getTime()) / 3_600_000;
  if (hours < 24) return 4;
  if (hours < 48) return 3;
  if (hours < 72) return 2;
  if (hours < 96) return 1;
  return 0;
}

/**
 * Choisit les bonnes nouvelles : récentes (moins de `maxAgeDays` jours), notées positivement,
 * sans doublon de titre, au plus `perSource` par média pour garder de la diversité.
 * Le classement mêle positivité et fraîcheur, pour que le fil change chaque jour.
 */
export function pickGoodNews(
  items: Omit<NewsItem, "score">[],
  sources: NewsSource[],
  now: Date,
  { limit = 6, perSource = 2, maxAgeDays = 7 } = {},
): NewsItem[] {
  const solutions = new Set(sources.filter((s) => s.solutions).map((s) => s.name));
  const minTime = now.getTime() - maxAgeDays * 86_400_000;
  const seen = new Set<string>();

  const scored = items
    .filter((i) => {
      const time = new Date(i.publishedAt).getTime();
      return time >= minTime && time <= now.getTime() + 3_600_000;
    })
    .map((i) => ({ ...i, score: positivityScore(i.title, i.excerpt, solutions.has(i.source)) }))
    .filter((i) => i.score >= MIN_SCORE && !hasNegativeTitle(i.title))
    .filter((i) => {
      const key = normalize(i.title).replace(/[^a-z0-9]/g, "").slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    // Positivité + fraîcheur d'abord, puis les plus récentes.
    .sort(
      (a, b) =>
        b.score + freshnessBonus(b.publishedAt, now) - (a.score + freshnessBonus(a.publishedAt, now)) ||
        b.publishedAt.localeCompare(a.publishedAt),
    );

  const perCount = new Map<string, number>();
  const picked: NewsItem[] = [];
  for (const i of scored) {
    const n = perCount.get(i.source) ?? 0;
    if (n >= perSource) continue;
    perCount.set(i.source, n + 1);
    picked.push(i);
    if (picked.length >= limit) break;
  }
  return picked.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
