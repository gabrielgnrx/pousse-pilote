/**
 * Génère, depuis supabase/data/emission_factors.json et supabase/data/action_types.json (sources uniques) :
 *   - src/lib/co2/factors.data.ts et src/lib/co2/action-types.data.ts : pour le moteur TypeScript ;
 *   - supabase/migrations/0026_emission_factors.sql : la table versionnée des facteurs et ef() ;
 *   - supabase/migrations/<migration>.sql : le catalogue des actions du + (numéro dans action_types.json ;
 *     0027 en était la première version, figée depuis).
 *
 *   node scripts/generate-factors.ts          écrit les deux fichiers
 *   node scripts/generate-factors.ts --check  vérifie qu'ils sont à jour (utilisé par les tests)
 *
 * Une nouvelle version des facteurs = un nouveau fichier JSON de version et une nouvelle migration :
 * une migration déjà appliquée ne se réécrit pas.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const SOURCES = ["base_empreinte", "agribalyse", "nos_gestes_climat"] as const;
export const CATEGORIES = ["transport", "alimentation", "consommation", "energie"] as const;

export interface FactorRow {
  slug: string;
  label: string;
  category: (typeof CATEGORIES)[number];
  unit: string;
  kgco2e_per_unit: number | null;
  source: (typeof SOURCES)[number];
  source_ref: string;
  todo: string | null;
}

interface FactorFile {
  version: string;
  factors: FactorRow[];
}

export function loadFactors(): FactorFile {
  const file = JSON.parse(readFileSync(join(root, "supabase/data/emission_factors.json"), "utf8")) as FactorFile;
  const seen = new Set<string>();
  for (const f of file.factors) {
    if (!/^[a-z0-9_]+$/.test(f.slug)) throw new Error(`slug invalide : ${f.slug}`);
    if (seen.has(f.slug)) throw new Error(`slug en double : ${f.slug}`);
    seen.add(f.slug);
    if (!SOURCES.includes(f.source)) throw new Error(`source inconnue pour ${f.slug} : ${f.source}`);
    if (!CATEGORIES.includes(f.category)) throw new Error(`catégorie inconnue pour ${f.slug} : ${f.category}`);
    if (!f.source_ref) throw new Error(`source_ref manquant pour ${f.slug}`);
    // Une valeur absente est permise seulement avec un TODO explicite : on n'invente rien.
    if (f.kgco2e_per_unit === null && !f.todo) throw new Error(`valeur manquante sans TODO pour ${f.slug}`);
    if (f.kgco2e_per_unit !== null && !(f.kgco2e_per_unit >= 0)) throw new Error(`valeur négative pour ${f.slug}`);
  }
  return file;
}

const q = (s: string | null) => (s === null ? "null" : `'${s.replace(/'/g, "''")}'`);

export function renderTs(file: FactorFile): string {
  const rows = file.factors
    .map(
      (f) =>
        `  ${f.slug}: { label: ${JSON.stringify(f.label)}, category: ${JSON.stringify(f.category)}, unit: ${JSON.stringify(f.unit)}, kg: ${f.kgco2e_per_unit === null ? "null" : f.kgco2e_per_unit}, source: ${JSON.stringify(f.source)} },`,
    )
    .join("\n");
  return `// Fichier généré par scripts/generate-factors.ts depuis supabase/data/emission_factors.json.
// Ne pas modifier à la main : modifier le JSON, puis lancer node scripts/generate-factors.ts.

export const FACTORS_VERSION = ${JSON.stringify(file.version)};

export const FACTOR_DATA = {
${rows}
} as const;

export type FactorSlug = keyof typeof FACTOR_DATA;
`;
}

export function renderSql(file: FactorFile): string {
  const values = file.factors
    .map(
      (f) =>
        `  (${q(f.slug)}, ${q(f.label)}, ${q(f.category)}, ${q(f.unit)}, ${f.kgco2e_per_unit === null ? "null" : f.kgco2e_per_unit}, ${q(f.source)}, ${q(f.source_ref)}, ${q(file.version)}, ${q(f.todo)})`,
    )
    .join(",\n");
  return `-- 0026 — Facteurs d'émission versionnés (v2, octobre 2026).
-- Fichier généré par scripts/generate-factors.ts depuis supabase/data/emission_factors.json : ne pas
-- modifier à la main. Une nouvelle version des facteurs s'ajoute dans une nouvelle migration (mêmes
-- slugs, autre version) ; ef() lit toujours la version la plus récente.
--
-- Règle d'or : le CO₂ est calculé par la base à partir de cette table, jamais par l'IA ni par le
-- navigateur. Une valeur inconnue reste nulle avec un TODO explicite, et ef() refuse de la servir.

create table if not exists public.emission_factors (
  id bigint generated always as identity primary key,
  slug text not null check (slug ~ '^[a-z0-9_]+$'),
  label text not null,
  category text not null check (category in ('transport', 'alimentation', 'consommation', 'energie')),
  unit text not null,
  kgco2e_per_unit numeric check (kgco2e_per_unit >= 0),
  source text not null check (source in ('base_empreinte', 'agribalyse', 'nos_gestes_climat')),
  source_ref text not null,
  version text not null,
  todo text,
  created_at timestamptz not null default now(),
  unique (slug, version),
  check (kgco2e_per_unit is not null or todo is not null)
);

alter table public.emission_factors enable row level security;
drop policy if exists "facteurs: lecture" on public.emission_factors;
create policy "facteurs: lecture" on public.emission_factors for select to authenticated, anon using (true);
-- Aucune écriture hors migration.

insert into public.emission_factors (slug, label, category, unit, kgco2e_per_unit, source, source_ref, version, todo)
values
${values}
on conflict (slug, version) do update set
  label = excluded.label, category = excluded.category, unit = excluded.unit,
  kgco2e_per_unit = excluded.kgco2e_per_unit, source = excluded.source,
  source_ref = excluded.source_ref, todo = excluded.todo;

-- La valeur en vigueur d'un facteur (version la plus récente). Erreur si inconnu ou sans valeur.
create or replace function public.ef(p_slug text)
returns numeric
language plpgsql stable
set search_path = public
as $$
declare
  v numeric;
  found_row boolean;
begin
  select true, f.kgco2e_per_unit into found_row, v
  from public.emission_factors f
  where f.slug = p_slug
  order by f.version desc
  limit 1;
  if found_row is null then
    raise exception 'unknown_factor:%', p_slug;
  end if;
  if v is null then
    raise exception 'factor_without_value:%', p_slug;
  end if;
  return v;
end;
$$;
grant execute on function public.ef(text) to authenticated;
`;
}

export interface ActionTypeRow {
  slug: string;
  template: string;
  variant: string;
  label: string;
  kind: "count" | "distance";
  unit: string;
  min: number;
  max: number;
  reference_rule: string;
  factors: string[];
  aliases: string[];
}

interface ActionFile {
  /** La migration où écrire le catalogue (ex. « 0046_catalogue_actions ») : nouveau numéro à chaque changement. */
  migration: string;
  reference_rules: Record<string, string>;
  actions: ActionTypeRow[];
}

export function loadActions(factorSlugs: Set<string>): ActionFile {
  const file = JSON.parse(readFileSync(join(root, "supabase/data/action_types.json"), "utf8")) as ActionFile;
  if (!/^\d{4}_[a-z0-9_]+$/.test(file.migration ?? "")) throw new Error("migration du catalogue invalide (ex. 0046_catalogue_actions)");
  const seen = new Set<string>();
  for (const a of file.actions) {
    if (!/^[a-z0-9_]+$/.test(a.slug)) throw new Error(`slug d'action invalide : ${a.slug}`);
    if (seen.has(a.slug)) throw new Error(`slug d'action en double : ${a.slug}`);
    seen.add(a.slug);
    if (!["count", "distance"].includes(a.kind)) throw new Error(`kind inconnu pour ${a.slug}`);
    if (!(a.min > 0 && a.max >= a.min)) throw new Error(`bornes invalides pour ${a.slug}`);
    if (a.kind === "count" && (!Number.isInteger(a.min) || !Number.isInteger(a.max))) throw new Error(`bornes entières attendues pour ${a.slug}`);
    if (!file.reference_rules[a.reference_rule]) throw new Error(`règle de référence inconnue pour ${a.slug}`);
    if (a.reference_rule !== "aucun" && a.factors.length === 0) throw new Error(`action sans facteur : ${a.slug}`);
    for (const f of a.factors) if (!factorSlugs.has(f)) throw new Error(`facteur inconnu ${f} pour ${a.slug}`);
  }
  return file;
}

export function renderActionsTs(file: ActionFile): string {
  return `// Fichier généré par scripts/generate-factors.ts depuis supabase/data/action_types.json.
// Ne pas modifier à la main : modifier le JSON, puis lancer node scripts/generate-factors.ts.

export interface ActionType {
  slug: string;
  template: string;
  variant: string;
  label: string;
  kind: "count" | "distance";
  unit: string;
  min: number;
  max: number;
  referenceRule: string;
  factors: readonly string[];
  aliases: readonly string[];
}

export const REFERENCE_RULES: Record<string, string> = ${JSON.stringify(file.reference_rules, null, 2)};

export const ACTION_TYPES: readonly ActionType[] = ${JSON.stringify(
    file.actions.map((a) => ({
      slug: a.slug,
      template: a.template,
      variant: a.variant,
      label: a.label,
      kind: a.kind,
      unit: a.unit,
      min: a.min,
      max: a.max,
      referenceRule: a.reference_rule,
      factors: a.factors,
      aliases: a.aliases,
    })),
    null,
    2,
  )};

export const ACTION_SLUGS = ACTION_TYPES.map((a) => a.slug);
`;
}

export function renderActionsSql(file: ActionFile): string {
  const arr = (xs: string[]) => (xs.length ? `array[${xs.map(q).join(", ")}]` : "'{}'::text[]");
  const values = file.actions
    .map(
      (a) =>
        `  (${q(a.slug)}, ${q(a.template)}, ${q(a.variant)}, ${q(a.label)}, ${q(a.kind)}, ${q(a.unit)}, ${a.min}, ${a.max}, ${q(a.reference_rule)}, ${arr(a.factors)})`,
    )
    .join(",\n");
  return `-- ${file.migration.slice(0, 4)} — Catalogue des actions du + (octobre 2026).
-- Fichier généré par scripts/generate-factors.ts depuis supabase/data/action_types.json : ne pas
-- modifier à la main. La saisie libre ne renvoie qu'un slug de cette table et une quantité ; la base
-- calcule le CO₂ avec avoided_kg, d'après la règle de référence et les facteurs listés. Les actions
-- retirées du catalogue restent en base, désactivées : l'historique garde son sens.

create table if not exists public.action_types (
  slug text primary key check (slug ~ '^[a-z0-9_]+$'),
  template_id text not null references public.challenge_templates,
  variant text not null,
  label text not null,
  kind text not null check (kind in ('count', 'distance')),
  unit text not null,
  min_quantity numeric not null check (min_quantity > 0),
  max_quantity numeric not null,
  reference_rule text not null,
  factors text[] not null default '{}',
  active boolean not null default true,
  check (max_quantity >= min_quantity)
);
alter table public.action_types enable row level security;
drop policy if exists "actions: lecture" on public.action_types;
create policy "actions: lecture" on public.action_types for select to authenticated using (true);

-- Le train se saisit en km (variante « km »), en plus des variantes 300, 500 et 800 km des raccourcis.
insert into public.action_types (slug, template_id, variant, label, kind, unit, min_quantity, max_quantity, reference_rule, factors)
values
${values}
on conflict (slug) do update set
  template_id = excluded.template_id, variant = excluded.variant, label = excluded.label, kind = excluded.kind,
  unit = excluded.unit, min_quantity = excluded.min_quantity, max_quantity = excluded.max_quantity,
  reference_rule = excluded.reference_rule, factors = excluded.factors, active = true;

update public.action_types set active = false
where slug not in (${file.actions.map((a) => q(a.slug)).join(", ")});

-- Chaque facteur cité doit exister dans emission_factors.
do $$
declare
  missing text;
begin
  select string_agg(distinct f, ', ') into missing
  from public.action_types a, unnest(a.factors) f
  where not exists (select 1 from public.emission_factors e where e.slug = f);
  if missing is not null then
    raise exception 'facteurs inconnus dans action_types : %', missing;
  end if;
end;
$$;
`;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const file = loadFactors();
  const actions = loadActions(new Set(file.factors.map((f) => f.slug)));
  const outputs: [string, string][] = [
    [join(root, "src/lib/co2/factors.data.ts"), renderTs(file)],
    [join(root, "src/lib/co2/action-types.data.ts"), renderActionsTs(actions)],
    [join(root, "supabase/migrations/0026_emission_factors.sql"), renderSql(file)],
    [join(root, `supabase/migrations/${actions.migration}.sql`), renderActionsSql(actions)],
  ];
  if (process.argv.includes("--check")) {
    const stale = outputs.filter(([path, content]) => {
      try {
        return readFileSync(path, "utf8") !== content;
      } catch {
        return true;
      }
    });
    if (stale.length) {
      console.error(`Fichiers à régénérer (node scripts/generate-factors.ts) : ${stale.map(([p]) => p).join(", ")}`);
      process.exit(1);
    }
  } else {
    for (const [path, content] of outputs) writeFileSync(path, content);
    console.log(`${file.factors.length} facteurs (version ${file.version}), ${actions.actions.length} actions`);
  }
}
