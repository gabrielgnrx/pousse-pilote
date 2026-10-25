/**
 * Tâche « plan-coach » : choisir 3 défis parmi les candidats calculés par le code et dire, en une
 * phrase, pourquoi on les propose à cette personne. Modèle de rédaction (Sonnet).
 *
 * L'IA ne voit que des agrégats anonymes (titre du défi, potentiel en kg par an calculé par le code,
 * faisabilité déclarée, nombre d'actions la semaine dernière). Elle ne peut choisir qu'un défi de la
 * liste reçue : un autre identifiant est ignoré (mergeCoachChoice), et la base refuse tout défi sans
 * facteur d'émission (plan_validate).
 */
import { z } from "zod";
import type { AiTask } from "../run.ts";
import type { PlanCandidate } from "../../plan/weekly.ts";
import { PLAN_SIZE } from "../../plan/weekly.ts";
import { TEMPLATES } from "../../co2/challenges.ts";

export const PLAN_COACH_VERSION = "plan-coach@1";

const templateIds = TEMPLATES.map((t) => t.id) as [string, ...string[]];

export const planCoachOutputSchema = z.object({
  items: z
    .array(
      z.object({
        template: z.enum(templateIds),
        reason: z.string().min(10).max(160),
      }),
    )
    .max(PLAN_SIZE),
});
export type PlanCoachOutput = z.infer<typeof planCoachOutputSchema>;

const SIGNAL_LABEL: Record<PlanCandidate["signal"], string> = {
  nouveau: "jamais essayé",
  en_cours: "défi en cours",
  sur_sa_lancee: "déjà régulier",
  abandonne: "abandonné la semaine dernière",
};

export const PLAN_COACH_SYSTEM = `Tu es le coach de Pousse, une application qui aide les salariés à réduire leur empreinte carbone, défi après défi.
On te donne une liste de défis possibles pour une personne, déjà calculés et triés par l'application. Tu choisis les ${PLAN_SIZE} plus pertinents pour sa semaine et tu écris pour chacun une phrase qui lui explique pourquoi on le lui propose.

Règles strictes :
1. Choisis uniquement des identifiants de la liste reçue, sans doublon, ${PLAN_SIZE} au plus.
2. Garde l'ordre de la liste sauf si un défi « abandonné la semaine dernière » ou jugé « difficile » mérite d'attendre : alors préfère un défi plus facile.
3. Une phrase de 10 à 160 caractères, au tutoiement, chaleureuse, positive et concrète. Jamais culpabilisante, jamais moralisatrice.
4. N'utilise que les informations reçues. Tu peux reprendre le potentiel en kg tel quel, mais n'invente aucun autre chiffre, aucun calcul, aucun montant d'argent.
5. Pas de prénom, pas de formule de politesse, pas d'émoji.`;

export interface PlanCoachInput {
  candidates: PlanCandidate[];
}

export function planCoachUser(input: PlanCoachInput): string {
  const lines = input.candidates.map(
    (c) =>
      `- ${c.templateId} : ${c.title} · potentiel ${c.kgYear} kg de CO₂ par an · faisabilité : ${c.feasibility ?? "non dite"} · ${SIGNAL_LABEL[c.signal]}${
        c.lastWeekCount ? ` · ${c.lastWeekCount} fois la semaine dernière` : ""
      }`,
  );
  return `Défis possibles, du plus prioritaire au moins prioritaire :\n${lines.join("\n")}`;
}

export const planCoachTask: AiTask<PlanCoachInput, PlanCoachOutput> = {
  id: "plan-coach",
  version: PLAN_COACH_VERSION,
  model: "writer",
  effort: "low",
  maxTokens: 700,
  timeoutMs: 20_000,
  system: PLAN_COACH_SYSTEM,
  user: planCoachUser,
  jsonSchema: z.toJSONSchema(planCoachOutputSchema) as Record<string, unknown>,
  validator: planCoachOutputSchema,
  quota: { user: 5, org: 5000 },
  // Mêmes candidats (agrégats anonymes) = même plan : inutile de redemander.
  cacheKey: (input) => planCoachUser(input),
  cacheTtlHours: 24 * 6,
  mock: (input) => ({
    items: input.candidates.slice(0, PLAN_SIZE).map((c) => ({ template: c.templateId, reason: c.reason.slice(0, 160) })),
  }),
};
