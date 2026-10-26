/**
 * Rapport mensuel de l'admin RSE : uniquement à partir des agrégats de la base (admin_report_data),
 * jamais de données individuelles. Chiffres clés, faits marquants et recommandations sont écrits par
 * des règles à partir de ces seuls agrégats.
 */
import { TEMPLATE_BY_ID, formatKg } from "../co2/challenges.ts";

export interface ReportData {
  month: string;
  k: number;
  participants: number;
  active: number | null;
  kg: number | null;
  kg_previous: number | null;
  actions: number | null;
  by_poste: Record<string, number | null>;
  top_actions: { template: string; count: number; people: number }[];
  challenges_done: number | null;
  teams: { name: string; members: number; kg: number }[];
  quotes: string[];
}

export const POSTE_LABEL: Record<string, string> = {
  mobilite: "Mobilité",
  alimentation: "Alimentation",
  consommation: "Consommation",
  energie: "Énergie",
  autre: "Autres gestes",
};

const n = (x: unknown): number | null => (x === null || x === undefined || !Number.isFinite(Number(x)) ? null : Number(x));

/** Relit sans confiance la réponse de la base. */
export function parseReportData(raw: unknown): ReportData {
  const r = (raw ?? {}) as Record<string, unknown>;
  const byPoste: Record<string, number | null> = {};
  for (const [k, v] of Object.entries((r.by_poste ?? {}) as Record<string, unknown>)) if (k in POSTE_LABEL) byPoste[k] = n(v);
  const arr = <T,>(x: unknown, f: (y: Record<string, unknown>) => T | null): T[] =>
    Array.isArray(x) ? x.map((y) => f((y ?? {}) as Record<string, unknown>)).filter((y): y is T => y !== null) : [];
  return {
    month: typeof r.month === "string" ? r.month : "",
    k: n(r.k) ?? 5,
    participants: n(r.participants) ?? 0,
    active: n(r.active),
    kg: n(r.kg),
    kg_previous: n(r.kg_previous),
    actions: n(r.actions),
    by_poste: byPoste,
    top_actions: arr(r.top_actions, (y) => (typeof y.template === "string" && TEMPLATE_BY_ID[y.template] ? { template: y.template, count: n(y.count) ?? 0, people: n(y.people) ?? 0 } : null)),
    challenges_done: n(r.challenges_done),
    teams: arr(r.teams, (y) => (typeof y.name === "string" ? { name: y.name, members: n(y.members) ?? 0, kg: n(y.kg) ?? 0 } : null)),
    quotes: Array.isArray(r.quotes) ? r.quotes.filter((q): q is string => typeof q === "string" && q.length >= 20 && q.length <= 300) : [],
  };
}

const fr = (x: number) => x.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
}

export interface KeyFigure {
  label: string;
  value: string;
}

/** Les chiffres clés, mis en forme par le code (les valeurs masquées restent masquées). */
export function keyFigures(d: ReportData): KeyFigure[] {
  const masked = `moins de ${d.k} personnes`;
  const out: KeyFigure[] = [
    { label: "Participants inscrits", value: fr(d.participants) },
    { label: "Personnes actives ce mois-ci", value: d.active === null ? masked : fr(d.active) },
    { label: "CO₂ évité ce mois-ci", value: d.kg === null ? masked : formatKg(d.kg) },
    { label: "Actions enregistrées", value: d.actions === null ? masked : fr(d.actions) },
  ];
  if (d.kg !== null && d.kg_previous !== null && d.kg_previous > 0) {
    const delta = Math.round(((d.kg - d.kg_previous) / d.kg_previous) * 100);
    out.push({ label: "Évolution par rapport au mois précédent", value: `${delta > 0 ? "+" : ""}${delta} %` });
  }
  if (d.challenges_done !== null) out.push({ label: "Défis réussis", value: fr(d.challenges_done) });
  return out;
}

/** Jusqu'à 3 verbatims, choisis parmi les messages publics anonymisés (les plus positifs d'abord). */
export function pickQuotes(quotes: string[], max = 3): string[] {
  const positive = /(bravo|merci|super|génial|top|content|fier|facile|sympa|motiv|chouette|réussi)/i;
  return [...quotes].sort((a, b) => Number(positive.test(b)) - Number(positive.test(a))).slice(0, max);
}

/** Faits marquants et recommandations du mois, écrits par des règles à partir des agrégats. */
export function monthNarrative(d: ReportData): string {
  const facts: string[] = [];
  if (d.kg !== null) {
    let line = `Ce mois-ci, les participants ont évité ${formatKg(d.kg)} de CO₂`;
    if (d.kg_previous !== null && d.kg_previous > 0) {
      const delta = Math.round(((d.kg - d.kg_previous) / d.kg_previous) * 100);
      line += delta === 0 ? ", autant que le mois précédent" : `, ${delta > 0 ? "+" : ""}${delta} % par rapport au mois précédent`;
    }
    facts.push(`${line}.`);
  }
  if (d.active !== null && d.participants > 0) facts.push(`${fr(d.active)} personnes sur ${fr(d.participants)} inscrites ont enregistré au moins une action.`);
  const postes = Object.entries(d.by_poste)
    .filter((e): e is [string, number] => e[1] !== null && e[1] > 0)
    .sort((a, b) => b[1] - a[1]);
  if (postes[0]) facts.push(`Le poste qui a le plus réduit : ${POSTE_LABEL[postes[0][0]].toLowerCase()} (${formatKg(postes[0][1])}).`);
  if (d.top_actions[0]) facts.push(`L'action la plus fréquente : ${TEMPLATE_BY_ID[d.top_actions[0].template].title.toLowerCase()}.`);
  if (d.teams[0]) facts.push(`L'équipe ${d.teams[0].name} mène le classement.`);

  const reco: string[] = [];
  if (d.active !== null && d.participants > 0 && d.active / d.participants < 0.5) {
    reco.push("Relancer les personnes inscrites qui n'ont encore rien enregistré, par exemple avec le lien d'invitation dans un message d'équipe.");
  }
  if (!d.by_poste.mobilite) reco.push("Mettre en avant les trajets domicile-travail (vélo, transports, covoiturage) : c'est souvent le premier levier.");
  if (!d.by_poste.alimentation) reco.push("Proposer un défi repas végétarien à la cantine ou en équipe.");
  reco.push("Relayer le défi d'équipe du lundi dans vos canaux internes.");
  reco.push("Mettre en avant les actions phares du mois dans la communication RSE.");
  reco.push("Partager ce rapport avec les équipes pour montrer le chemin parcouru.");
  return `Faits marquants\n${facts.join(" ") || "Pas assez de participants ce mois-ci pour un bilan chiffré."}\n\nRecommandations\n${reco.slice(0, 3).map((r) => `- ${r}`).join("\n")}`;
}
