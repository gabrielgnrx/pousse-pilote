/**
 * Le message de l'animateur : rédigé par l'IA à partir des faits, ou gabarit si l'IA est indisponible,
 * si sa réponse est invalide, ou si elle maltraite les marqueurs de prénoms.
 */
import { runTask, type AiStore } from "../ai/run.ts";
import type { MessagesClient } from "../ai/types.ts";
import { animateurTask, placeholdersOk } from "../ai/prompts/animateur.ts";
import { fallbackMessage, fillNames, type Facts } from "./facts.ts";

export async function composeMessage(
  facts: Facts,
  deps: { client: MessagesClient | null; store: AiStore; mock?: boolean },
): Promise<{ text: string; source: "ia" | "gabarit" }> {
  const r = await runTask(animateurTask, facts, deps);
  if (r.ok && placeholdersOk(r.data.message, facts.names) && !/[@#]/.test(r.data.message)) {
    return { text: fillNames(r.data.message, facts.names).slice(0, 500), source: "ia" };
  }
  return { text: fallbackMessage(facts), source: "gabarit" };
}
