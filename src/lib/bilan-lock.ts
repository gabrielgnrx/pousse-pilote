/**
 * Le bilan se refait une fois tous les 30 jours au plus, avec 24 h de corrections libres après le
 * premier (même règle que check_bilan_frequency, migration 0025). Renvoie la date à partir de
 * laquelle un nouveau bilan est possible, ou null s'il l'est déjà.
 */
export const BILAN_EVERY_DAYS = 30;

export function nextBilanAllowed(firstAt: string | null, lastAt: string | null, now = new Date()): Date | null {
  if (!firstAt || !lastAt) return null;
  const first = new Date(firstAt);
  if (now.getTime() < first.getTime() + 24 * 3600 * 1000) return null;
  const next = new Date(new Date(lastAt).getTime() + BILAN_EVERY_DAYS * 24 * 3600 * 1000);
  return next.getTime() > now.getTime() ? next : null;
}
