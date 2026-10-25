/**
 * Prépare une salariée de test : compte créé avec l'API d'administration de la pile Supabase locale,
 * session ouverte avec @supabase/ssr (mêmes cookies que l'application), entreprise de démonstration
 * rejointe, bilan enregistré. La session est gardée dans e2e/.auth/salarie.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !anon || !service) throw new Error("Variables de la pile Supabase locale manquantes (supabase status -o env).");

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const email = `camille.e2e.${Date.now()}@demo.fr`;
  const password = `Pousse-${crypto.randomUUID()}`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user) throw createError ?? new Error("Compte de test non créé");

  // Session : on laisse @supabase/ssr écrire ses cookies, comme dans l'application.
  const jar = new Map<string, string>();
  const ssr = createServerClient(url, anon, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error: signInError } = await ssr.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  // Entreprise de démonstration, puis bilan : 12 km en voiture, 3 jours de bureau.
  const { data: team } = await admin.from("teams").select("id, companies!inner(join_code)").eq("companies.join_code", "DEMO-2026").limit(1).single();
  const { error: joinError } = await ssr.rpc("join_company", {
    p_code: "DEMO-2026",
    p_team: team?.id ?? null,
    p_display_name: "Camille",
    p_consent_team_stats: true,
    p_consent_feedback: true,
  });
  if (joinError) throw joinError;
  const userId = created.user.id;
  const { error: footprintError } = await admin.from("footprints").insert({
    user_id: userId,
    answers: {},
    total_kg: 6000,
    by_category: { transport: 2000, alimentation: 2000, logement: 1000, consommation: 500, services: 500 },
  });
  if (footprintError) throw footprintError;
  const { error: habitsError } = await admin.from("habits").insert({
    user_id: userId,
    commute_mode: "voiture_seul",
    commute_km: 12,
    commute_days: 3,
    beef_meals_week: 3,
    other_meat_meals_week: 4,
    short_flights_year: 1,
    long_flights_year: 0,
    new_clothes_year: 10,
    buys_new_phone: false,
    heating: "gaz",
    heating_kg_year: 1200,
  });
  if (habitsError) throw habitsError;

  mkdirSync("e2e/.auth", { recursive: true });
  writeFileSync(
    "e2e/.auth/salarie.json",
    JSON.stringify({
      cookies: [
        ...[...jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" as const })),
        // L'écran d'introduction du fil est déjà vu.
        { name: "pousse_intro_vue", value: "1", domain: "localhost", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" as const },
      ],
      origins: [],
    }),
  );
}
