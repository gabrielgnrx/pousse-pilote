/**
 * Bonus gros leviers (0053_clarte_jeu.sql, décision du 04/11/2026) : chaque action garde ses pousses de
 * base, plus +5 au-delà de 1 kg de CO₂ évité et +10 au-delà de 3 kg. Le calcul officiel est dans
 * log_action() ; cette fonction sert l'aperçu à l'écran et suit la même règle.
 */
export const BONUS_STEPS = [
  { kg: 3, points: 10 },
  { kg: 1, points: 5 },
] as const;

export function co2Bonus(kg: number): number {
  const rounded = Math.round(kg * 1000) / 1000;
  return BONUS_STEPS.find((s) => rounded >= s.kg)?.points ?? 0;
}
