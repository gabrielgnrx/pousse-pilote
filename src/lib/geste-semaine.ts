import { TEMPLATE_BY_ID, TEMPLATES, templateEligibility } from "./co2/challenges.ts";
import type { Habits } from "./co2/footprint.ts";
import { weekNumber } from "./informer.ts";

/** Les gestes qui servent le défi collectif de la semaine, du plus parlant au moins parlant. */
const FOR_GOAL: Record<string, string[]> = {
  repas: ["vege", "moins_boeuf", "vegetalien"],
  trajets: ["velo", "transports", "covoiturage"],
  scan: ["occasion", "reparation"],
};

/**
 * Le geste de la semaine : lié au défi collectif quand c'est possible, et adapté au bilan
 * (un geste qui remplace vraiment une habitude). Sinon, il tourne chaque lundi.
 */
export function gesteOfWeek(h: Habits, goalKind: string | null, today: string) {
  const eligible = (id: string) => {
    const t = TEMPLATE_BY_ID[id];
    return t ? templateEligibility(t, h).eligible : false;
  };
  const linked = goalKind ? (FOR_GOAL[goalKind] ?? []).find(eligible) : undefined;
  if (linked) return { id: linked, linkedToGoal: true };
  const pool = TEMPLATES.filter((t) => t.level !== "expert" && eligible(t.id));
  const list = pool.length ? pool : TEMPLATES.filter((t) => t.level !== "expert");
  return { id: list[weekNumber(today) % list.length].id, linkedToGoal: false };
}
