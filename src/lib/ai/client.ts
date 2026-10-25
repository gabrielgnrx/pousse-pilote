import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { MessagesClient } from "./types.ts";
import { supabaseStore } from "./store.ts";

/**
 * Le seul endroit qui lit ANTHROPIC_API_KEY. « server-only » fait échouer la compilation si ce module
 * est importé depuis un composant client : la clé ne peut pas atteindre le navigateur.
 *
 * Sans clé, l'IA est désactivée (null) et l'application propose ses replis non-IA.
 * AI_MOCK=1 : réponses simulées des tâches (tests de bout en bout, démo), aucune requête réseau.
 */

let cached: MessagesClient | null | undefined;

export function aiMockEnabled(): boolean {
  return process.env.AI_MOCK === "1";
}

export function getAiClient(): MessagesClient | null {
  if (cached !== undefined) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  // Le SDK est appelé avec nos propres types (types.ts) : on ne dépend que des paramètres documentés.
  cached = apiKey ? (new Anthropic({ apiKey, maxRetries: 1 }) as unknown as MessagesClient) : null;
  return cached;
}

/** Dépendances d'une tâche IA lancée pour la personne connectée (journal, quotas, cache sur sa session). */
export function aiDepsFor(db: Parameters<typeof supabaseStore>[0]) {
  return { client: getAiClient(), store: supabaseStore(db), mock: aiMockEnabled() };
}

/** Dépendances d'une tâche planifiée (animateur, plans, quiz) : journal signé par la clé « ia ». */
export function aiDepsForCron(db: Parameters<typeof supabaseStore>[0], token: string, companyId: string | null) {
  return { client: getAiClient(), store: supabaseStore(db, { token, companyId }), mock: aiMockEnabled() };
}
