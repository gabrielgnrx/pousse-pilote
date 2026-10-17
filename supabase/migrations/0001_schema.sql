-- Pousse · version pilote entreprise
-- Schéma principal : entreprises, profils, bilans, habitudes, défis, validations.

create extension if not exists pgcrypto;

-- Entreprises et équipes ---------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique check (join_code = upper(join_code)),
  -- Domaine e-mail obligatoire pour rejoindre (ex. 'entreprise.fr'). Null = tout domaine.
  email_domain text,
  pilot_start date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  name text not null,
  unique (company_id, name)
);

-- Profils ------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  company_id uuid not null references public.companies,
  team_id uuid references public.teams on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 40),
  consent_data boolean not null check (consent_data),
  consent_team_stats boolean not null default true,
  consent_feedback boolean not null default true,
  created_at timestamptz not null default now()
);

-- Bilans et habitudes de référence -------------------------------------------

create table public.footprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  answers jsonb not null,
  total_kg integer not null check (total_kg >= 0),
  by_category jsonb not null,
  created_at timestamptz not null default now()
);
create index footprints_user_idx on public.footprints (user_id, created_at desc);

-- Habitudes tirées du dernier bilan : elles décident des défis proposés et du CO₂ compté.
create table public.habits (
  user_id uuid primary key references public.profiles on delete cascade,
  commute_mode text not null check (commute_mode in (
    'voiture_seul', 'voiture_electrique', 'covoiturage',
    'transports_en_commun', 'velo', 'marche_teletravail')),
  commute_km numeric not null check (commute_km between 0 and 80),
  commute_days smallint not null check (commute_days between 0 and 5),
  beef_meals_week smallint not null check (beef_meals_week between 0 and 14),
  other_meat_meals_week smallint not null check (other_meat_meals_week between 0 and 14),
  short_flights_year smallint not null check (short_flights_year between 0 and 20),
  long_flights_year smallint not null check (long_flights_year between 0 and 10),
  new_clothes_year smallint not null check (new_clothes_year between 0 and 200),
  buys_new_phone boolean not null,
  heating text not null,
  heating_kg_year numeric not null check (heating_kg_year between 0 and 20000),
  updated_at timestamptz not null default now()
);

-- Catalogue des défis ------------------------------------------------------
-- Le calcul du CO₂ par unité est dans la fonction unit_kg (0002_functions.sql).

create table public.challenge_templates (
  id text primary key,
  category text not null check (category in ('transport', 'alimentation', 'consommation', 'logement')),
  title text not null,
  points_per_unit integer not null check (points_per_unit > 0),
  -- Plafond partagé : les défis du même groupe se partagent le plafond.
  cap_group text not null,
  cap_units integer not null check (cap_units > 0),
  cap_window_days integer not null default 1 check (cap_window_days in (1, 7)),
  active boolean not null default true
);

create table public.user_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  company_id uuid not null references public.companies,
  template_id text not null references public.challenge_templates,
  variant text not null default 'base',
  target integer not null check (target between 1 and 100),
  starts_on date not null default current_date,
  ends_on date not null,
  status text not null default 'active' check (status in ('active', 'done', 'abandoned')),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on <= starts_on + 92)
);
create index user_challenges_user_idx on public.user_challenges (user_id, status);

-- Validations (une par action réalisée) ---------------------------------------

create table public.validations (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.user_challenges on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  company_id uuid not null references public.companies,
  team_id uuid references public.teams on delete set null,
  template_id text not null references public.challenge_templates,
  variant text not null,
  day date not null default current_date,
  units integer not null check (units > 0),
  kg numeric not null check (kg >= 0),
  points integer not null check (points >= 0),
  proof_photo_path text,
  witness_id uuid references public.profiles on delete set null,
  witness_status text not null default 'none'
    check (witness_status in ('none', 'pending', 'confirmed', 'denied')),
  proof_level smallint not null check (proof_level between 0 and 2),
  caption text check (char_length(caption) <= 280),
  visibility text not null check (visibility in ('company', 'private')),
  status text not null default 'valid' check (status in ('valid', 'rejected')),
  created_at timestamptz not null default now()
);
create index validations_company_idx on public.validations (company_id, created_at desc);
create index validations_user_day_idx on public.validations (user_id, day);
create index validations_witness_idx on public.validations (witness_id) where witness_status = 'pending';

-- Interactions --------------------------------------------------------------

create table public.cheers (
  validation_id uuid not null references public.validations on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (validation_id, user_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  validation_id uuid not null references public.validations on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  reason text check (char_length(reason) <= 280),
  created_at timestamptz not null default now(),
  unique (validation_id, user_id)
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete set null,
  company_id uuid not null references public.companies,
  motivation smallint not null check (motivation between 1 and 5),
  brakes text[] not null default '{}',
  recommend smallint not null check (recommend between 0 and 10),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);
