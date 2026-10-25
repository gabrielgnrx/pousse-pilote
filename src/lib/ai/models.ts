/**
 * Modèles Claude utilisés par Pousse et prix publics (vérifiés dans la doc Anthropic le 25/10/2026) :
 * https://platform.claude.com/docs/en/models/haiku-5-5/overview
 * https://platform.claude.com/docs/en/models/sonnet-5-5/overview
 */

export const MODELS = {
  /** Classification, extraction, vision rapide (parsing des actions, justificatifs, scanner). */
  fast: "claude-haiku-5-5",
  /** Rédaction (coach du plan, animateur, rapports). */
  writer: "claude-sonnet-5-5",
} as const;

export type ModelKey = keyof typeof MODELS;
export type ModelId = (typeof MODELS)[ModelKey];

interface Price {
  /** $ par million de tokens d'entrée, de sortie et de lecture du cache. */
  input: number;
  output: number;
  cacheRead: number;
}

/** Haiku 5.5 : tarif sous 100 000 tokens d'entrée (nos prompts restent bien en dessous). */
const PRICES: Record<ModelId, { base: Price; long?: Price }> = {
  "claude-haiku-5-5": {
    base: { input: 0.1, output: 0.5, cacheRead: 0.01 },
    long: { input: 0.5, output: 2.5, cacheRead: 0.05 },
  },
  "claude-sonnet-5-5": { base: { input: 2, output: 10, cacheRead: 0.1 } },
};

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

/** Coût estimé d'un appel, en dollars, arrondi au millionième (le journal ai_calls garde 6 décimales). */
export function estimateCostUsd(model: ModelId, u: Usage): number {
  const p = PRICES[model];
  const promptTokens = u.inputTokens + u.cacheReadTokens;
  const price = p.long && promptTokens > 100_000 ? p.long : p.base;
  const cost = (u.inputTokens * price.input + u.outputTokens * price.output + u.cacheReadTokens * price.cacheRead) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
