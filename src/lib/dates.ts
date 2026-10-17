/**
 * Dates à l'heure de Paris, quel que soit le fuseau du serveur (Vercel tourne en UTC).
 * Même fuseau que la base de données (set timezone = 'Europe/Paris').
 */
const TZ = "Europe/Paris";

/** Date du jour à Paris, au format AAAA-MM-JJ. */
export function todayParis(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Décalage de Paris par rapport à UTC à une date donnée, ex. « +02:00 » (heure d'été). */
export function parisOffset(at = new Date()): string {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = name?.match(/GMT([+-]\d{2}:\d{2})/);
  return m ? m[1] : "+00:00";
}

/** Instant de minuit (heure de Paris) du jour donné, en ISO : pour filtrer « aujourd'hui ». */
export function parisMidnightISO(isoDate = todayParis()): string {
  return new Date(`${isoDate}T00:00:00${parisOffset(new Date(`${isoDate}T12:00:00Z`))}`).toISOString();
}

/** Nombre de jours entre aujourd'hui (Paris) et une date AAAA-MM-JJ. */
export function daysUntil(isoDate: string): number {
  const a = new Date(`${todayParis()}T12:00:00Z`).getTime();
  const b = new Date(`${isoDate}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Date seule (AAAA-MM-JJ) en français, sans glissement de fuseau : « 17 octobre ». */
export function formatDay(isoDate: string, month: "long" | "short" = "long"): string {
  return new Date(`${isoDate.slice(0, 10)}T12:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month,
    timeZone: "UTC",
  });
}

/** Instant (horodatage) affiché à l'heure de Paris. */
export function formatInstant(iso: string | Date, month: "long" | "short" = "long"): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month, timeZone: TZ });
}

export function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return "hier";
  return formatInstant(iso, "short");
}
