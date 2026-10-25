/**
 * Météo de demain (Open-Meteo, gratuit et sans clé : https://open-meteo.com). Paris par défaut,
 * l'ICP de Pousse étant en Île-de-France. Règle simple et testée, sans IA.
 */
export interface Tomorrow {
  date: string;
  tempMax: number;
  precipitationProbability: number;
  weatherCode: number;
}

/** Codes WMO : 0 à 3 ciel clair à couvert, 45-48 brouillard, 51 et plus précipitations. */
export function goodForBike(t: Tomorrow): boolean {
  return t.weatherCode <= 3 && t.precipitationProbability <= 20 && t.tempMax >= 10 && t.tempMax <= 28;
}

export const PARIS = { latitude: 48.8566, longitude: 2.3522 };

export function parseForecast(json: unknown, date: string): Tomorrow | null {
  const d = (json as { daily?: Record<string, unknown[]> })?.daily;
  if (!d || !Array.isArray(d.time)) return null;
  const i = d.time.indexOf(date);
  if (i < 0) return null;
  const n = (k: string) => Number((d[k] as unknown[] | undefined)?.[i]);
  const t = { date, tempMax: n("temperature_2m_max"), precipitationProbability: n("precipitation_probability_max"), weatherCode: n("weather_code") };
  return Object.values(t).every((v) => v !== null && (typeof v === "string" || Number.isFinite(v))) ? t : null;
}

export async function fetchTomorrow(date: string, where = PARIS, fetcher: typeof fetch = fetch): Promise<Tomorrow | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${where.latitude}&longitude=${where.longitude}` +
    `&daily=weather_code,temperature_2m_max,precipitation_probability_max&timezone=Europe%2FParis&forecast_days=3`;
  try {
    const res = await fetcher(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return parseForecast(await res.json(), date);
  } catch {
    return null;
  }
}
