/**
 * Génère supabase/tests/v2_0028_calcul.sql : le moteur TypeScript et la base doivent donner exactement
 * les mêmes kg (au gramme) pour chaque action du catalogue, sur plusieurs profils de bilan.
 *
 *   node scripts/generate-parity.ts          écrit le scénario
 *   node scripts/generate-parity.ts --check  vérifie qu'il est à jour (utilisé par les tests)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ACTION_TYPES } from "../src/lib/co2/action-types.data.ts";
import { computeAvoided, roundKg } from "../src/lib/co2/engine.ts";
import { APP_TEMPLATES, GESTES, TEMPLATES, unitImpact } from "../src/lib/co2/challenges.ts";
import type { Habits } from "../src/lib/co2/footprint.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "supabase/tests/v2_0028_calcul.sql");

export const PROFILES: Record<string, Habits> = {
  voiture: {
    commuteMode: "voiture_seul", commuteKm: 12, commuteDaysPerWeek: 4, beefMealsWeek: 3, otherMeatMealsWeek: 5,
    shortFlightsYear: 2, longFlightsYear: 1, newClothesYear: 15, buysNewPhone: true, newDevicesYear: 1,
    heating: "gaz", heatingKgYear: 1400, bottledWaterLDay: 1.5,
  },
  transports: {
    commuteMode: "transports_en_commun", commuteKm: 18.5, commuteDaysPerWeek: 3, beefMealsWeek: 1, otherMeatMealsWeek: 3,
    shortFlightsYear: 0, longFlightsYear: 0, newClothesYear: 5, buysNewPhone: false, newDevicesYear: 0,
    heating: "electrique", heatingKgYear: 120, bottledWaterLDay: 0,
  },
  electrique: {
    commuteMode: "voiture_electrique", commuteKm: 30, commuteDaysPerWeek: 2, beefMealsWeek: 0, otherMeatMealsWeek: 7,
    shortFlightsYear: 4, longFlightsYear: 2, newClothesYear: 0, buysNewPhone: true, newDevicesYear: 2,
    heating: "fioul", heatingKgYear: 3000, bottledWaterLDay: 0.5,
  },
  sobre: {
    commuteMode: "velo", commuteKm: 4, commuteDaysPerWeek: 5, beefMealsWeek: 0, otherMeatMealsWeek: 0,
    shortFlightsYear: 0, longFlightsYear: 0, newClothesYear: 2, buysNewPhone: false, newDevicesYear: 0,
    heating: "pompe_a_chaleur", heatingKgYear: 60, bottledWaterLDay: 0,
  },
};

const sqlHabits = (h: Habits) =>
  `jsonb_populate_record(null::public.habits, '${JSON.stringify({
    commute_mode: h.commuteMode,
    commute_km: h.commuteKm,
    commute_days: h.commuteDaysPerWeek,
    beef_meals_week: h.beefMealsWeek,
    other_meat_meals_week: h.otherMeatMealsWeek,
    short_flights_year: h.shortFlightsYear,
    long_flights_year: h.longFlightsYear,
    new_clothes_year: h.newClothesYear,
    buys_new_phone: h.buysNewPhone,
    new_devices_year: h.newDevicesYear,
    heating: h.heating,
    heating_kg_year: h.heatingKgYear,
    bottled_water_l_day: h.bottledWaterLDay,
  })}'::jsonb)`;

export function render(): string {
  const lines: string[] = [];
  for (const [name, h] of Object.entries(PROFILES)) {
    lines.push(`insert into parity_habits values ('${name}', ${sqlHabits(h)});`);
  }
  const checks: string[] = [];
  for (const [name, h] of Object.entries(PROFILES)) {
    // 1. Non-régression : unit_kg (désormais lu dans emission_factors) = unitImpact TypeScript.
    for (const t of [...TEMPLATES, ...GESTES, ...APP_TEMPLATES]) {
      for (const v of t.variants) {
        const u = unitImpact(t.id, v.key, h);
        checks.push(`  ('${name}', 'unit_kg', '${t.id}', '${v.key}', null, ${roundKg(u.eligible ? u.kg : 0)})`);
      }
    }
    // 2. avoided_kg pour chaque action du catalogue, à la quantité minimale, maximale et par défaut.
    for (const a of ACTION_TYPES) {
      const qs = new Set<number | null>([a.min, a.max]);
      if (!(a.template === "train" && a.variant === "km")) qs.add(null);
      if (a.kind === "distance" && a.template !== "train") qs.add(7.5);
      for (const q of qs) {
        const r = computeAvoided(a.slug, q, h);
        if (!r.ok) continue;
        checks.push(`  ('${name}', 'avoided_kg', '${a.template}', '${a.variant}', ${q === null ? "null" : q}, ${r.kg})`);
      }
    }
  }
  return `-- Scénario v2 (migration 0028) : parité au gramme entre le moteur TypeScript et la base.
-- Fichier généré par scripts/generate-parity.ts : ne pas modifier à la main.
\\set ON_ERROR_STOP 1
set client_min_messages = warning;

create temp table parity_habits (name text primary key, h public.habits);
${lines.join("\n")}

create temp table parity_cases (profile text, fn text, template text, variant text, quantity numeric, expected numeric);
insert into parity_cases values
${checks.join(",\n")};

do $$
declare
  bad text;
  n integer;
begin
  select count(*) into n from parity_cases;
  select string_agg(format('%s/%s %s:%s q=%s attendu %s, obtenu %s', c.profile, c.fn, c.template, c.variant,
                           c.quantity, c.expected, got), E'\\n')
    into bad
  from parity_cases c
  join parity_habits p on p.name = c.profile
  cross join lateral (select round(case c.fn
      when 'unit_kg' then public.unit_kg(c.template, c.variant, p.h)
      else public.avoided_kg(c.template, c.variant, c.quantity, p.h) end, 3) as got) g
  where got <> c.expected;
  if bad is not null then
    raise exception E'ÉCHEC : parité TypeScript / SQL\\n%', bad;
  end if;
  raise notice 'ok : parité TypeScript / SQL sur % cas', n;
end;
$$;
`;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const content = render();
  if (process.argv.includes("--check")) {
    let current = "";
    try {
      current = readFileSync(out, "utf8");
    } catch {
      /* absent */
    }
    if (current !== content) {
      console.error("supabase/tests/v2_0028_calcul.sql à régénérer : node scripts/generate-parity.ts");
      process.exit(1);
    }
  } else {
    writeFileSync(out, content);
    console.log("supabase/tests/v2_0028_calcul.sql écrit");
  }
}
