import { createClient } from "@supabase/supabase-js";

/**
 * Client des tâches planifiées : la clé publique seulement. Les fonctions de la base vérifient
 * elles-mêmes la clé de la tâche (cron_keys) : aucune clé secrète Supabase côté application.
 */
export function cronDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}

export function bearer(request: Request): string {
  return request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
}

/** Exécute des tâches avec au plus `n` en parallèle (pour ne pas saturer l'API). */
export async function mapLimit<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}
