/**
 * Ce que l'animateur sait d'une équipe pour un rendez-vous : les agrégats calculés par la base
 * (animator_due), relus sans confiance et mis en mots simples. Aucun prénom, sauf ceux des personnes
 * qui ont publié dans le fil, remplacés ici par des marqueurs {{prenom_1}}… que le code réinjecte.
 */
import { TEAM_KINDS, type TeamKind } from "../team.ts";
import { TEMPLATE_BY_ID, formatKg } from "../co2/challenges.ts";

export type Slot = "vote_open" | "vote_close" | "friday" | "midweek" | "reaction" | "meteo";

export interface Due {
  team_id: string;
  company_id: string;
  slot: Slot;
  ref: string;
  context: Record<string, unknown>;
}

const num = (x: unknown) => (Number.isFinite(Number(x)) ? Number(x) : 0);
const isKind = (x: unknown): x is TeamKind => typeof x === "string" && x in TEAM_KINDS;
const kindLabel = (k: unknown) => (isKind(k) ? TEAM_KINDS[k].unit : "actions");

export interface Facts {
  slot: Slot;
  /** Les faits, une ligne chacun, sans donnée personnelle. */
  lines: string[];
  /** Prénoms à féliciter (vendredi), dans l'ordre des marqueurs {{prenom_1}}, {{prenom_2}}… */
  names: string[];
}

export function factsFor(due: Due, weather?: { goodForBike: boolean; tempMax: number } | null): Facts {
  const c = due.context ?? {};
  const lines: string[] = [];
  let names: string[] = [];
  switch (due.slot) {
    case "vote_open": {
      const options = Array.isArray(c.options) ? c.options.filter(isKind) : [];
      lines.push(`Le vote du défi de la semaine est ouvert jusqu'à 14 h, directement dans ce chat.`);
      lines.push(`Les 3 propositions : ${options.map((o) => TEAM_KINDS[o].unit).join(" ; ")}.`);
      const lw = (c.last_week ?? {}) as Record<string, unknown>;
      if (num(lw.actions) > 0) lines.push(`La semaine dernière, l'équipe a enregistré ${num(lw.actions)} actions et évité ${formatKg(num(lw.kg))} de CO₂.`);
      break;
    }
    case "vote_close":
      lines.push(`Le vote est clos. Défi retenu : ${num(c.target)} ${kindLabel(c.chosen)} pour toute l'équipe, d'ici dimanche.`);
      lines.push(`Chaque action qui y compte rapporte double, et +50 pousses pour chaque contributeur si l'objectif est atteint.`);
      if (num(c.votes) > 0) lines.push(`${num(c.votes)} personnes ont voté.`);
      break;
    case "friday": {
      lines.push(`Bilan de la semaine : ${num(c.actions)} actions enregistrées, ${formatKg(num(c.kg))} de CO₂ évités par l'équipe.`);
      const top = Array.isArray(c.top) ? c.top.filter((t): t is string => typeof t === "string" && !!TEMPLATE_BY_ID[t]) : [];
      if (top.length) lines.push(`Actions phares : ${top.map((t) => TEMPLATE_BY_ID[t].title.toLowerCase()).join(" ; ")}.`);
      if (isKind(c.chosen) && num(c.target) > 0) {
        lines.push(`Défi de la semaine : ${num(c.progress)} sur ${num(c.target)} ${TEAM_KINDS[c.chosen].unit}${num(c.progress) >= num(c.target) ? ", objectif atteint" : ""}.`);
      }
      const rank = (c.rank ?? {}) as Record<string, unknown>;
      const monday = (c.rank_monday ?? {}) as Record<string, unknown>;
      if (num(rank.rank) > 0 && num(rank.teams) > 1) {
        const before = num(monday.rank);
        const move = before > 0 ? (before > num(rank.rank) ? `, en progrès (${before}e lundi)` : before < num(rank.rank) ? `, contre ${before}e lundi` : ", stable depuis lundi") : "";
        lines.push(`Classement des équipes : ${num(rank.rank)}e sur ${num(rank.teams)}${move}.`);
      }
      names = Array.isArray(c.publishers) ? c.publishers.filter((n): n is string => typeof n === "string" && n.length <= 40).slice(0, 8) : [];
      if (names.length) lines.push(`Ont partagé leurs actions dans le fil : ${names.map((_, i) => `{{prenom_${i + 1}}}`).join(", ")}.`);
      break;
    }
    case "midweek":
      lines.push(`Depuis lundi, l'équipe a enregistré ${num(c.this_week)} actions, contre ${num(c.last_week)} à la même période la semaine dernière.`);
      lines.push(`Il reste de quoi rattraper d'ici dimanche.`);
      break;
    case "reaction":
      if (c.kind === "palier") lines.push(`L'équipe vient de dépasser ${formatKg(num(c.kg))} de CO₂ évités depuis le début.`);
      else lines.push(`L'équipe enregistre des actions ${num(c.days)} jours de suite.`);
      break;
    case "meteo":
      if (weather) lines.push(`Demain, il fera beau et sec à Paris (${Math.round(weather.tempMax)} °C) : idéal pour venir à vélo.`);
      if (num(c.car_commuters) > 0) lines.push(`${num(c.car_commuters)} personnes de l'équipe viennent d'habitude en voiture.`);
      break;
  }
  return { slot: due.slot, lines, names };
}

/** Réinjecte les prénoms à la place des marqueurs ; un marqueur inconnu est retiré. */
export function fillNames(text: string, names: string[]): string {
  return text.replace(/\{\{prenom_(\d+)\}\}/g, (_, i) => names[Number(i) - 1] ?? "").replace(/\s+,/g, ",").replace(/ {2,}/g, " ").trim();
}

/** Les messages de l'animateur : préparés, courts, chaleureux, au tutoiement. */
export function animatorMessage(f: Facts): string {
  const body = f.lines.join(" ");
  const intro: Record<Slot, string> = {
    vote_open: "Bonjour l'équipe !",
    vote_close: "C'est voté !",
    friday: "Bonne fin de semaine à tous !",
    midweek: "Petit coup de pouce de mi-semaine :",
    reaction: "Bravo l'équipe !",
    meteo: "Idée pour demain :",
  };
  const outro: Record<Slot, string> = {
    vote_open: "À vous de choisir !",
    vote_close: "On y va ensemble ?",
    friday: names(f) ? "Merci et bravo !" : "Merci à tous !",
    midweek: "Une action aujourd'hui, et on repart !",
    reaction: "Continuez comme ça !",
    meteo: "Qui tente le vélo ?",
  };
  return fillNames(`${intro[f.slot]} ${body} ${outro[f.slot]}`, f.names).slice(0, 500);
}
const names = (f: Facts) => f.names.length > 0;
