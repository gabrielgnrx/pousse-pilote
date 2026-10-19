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
-- Fonctions : appartenance, calcul du CO₂, validation des défis, statistiques d'équipe.
-- Le calcul du CO₂ se fait ici, côté base : le navigateur n'envoie jamais de chiffre de CO₂.

create or replace function public.my_company_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select company_id from public.profiles where id = auth.uid() $$;

-- CO₂ évité (kg) pour une unité de défi, selon les habitudes déclarées.
-- Doit rester identique à src/lib/co2/challenges.ts (unitImpact) ; 0 = pas éligible.
create or replace function public.unit_kg(p_template text, p_variant text, h public.habits)
returns numeric
language plpgsql immutable
as $$
declare
  car_thermique constant numeric := 0.1106;
  car_electrique constant numeric := 0.0121;
  covoiturage constant numeric := 0.0553;
  transit constant numeric := (0.0042 + 0.0066) / 2;  -- moyenne métro / RER
  avion_court constant numeric := 0.2242;
  tgv constant numeric := 0.0023;
  boeuf constant numeric := 4.97;
  vegetarien constant numeric := 0.85;
  autre_viande constant numeric := (1.65 + 1.46 + 1.46) / 3;  -- porc, poulet, saumon
  commute_factor numeric;
  has_commute boolean := h.commute_km > 0 and h.commute_days > 0;
begin
  commute_factor := case h.commute_mode
    when 'voiture_seul' then car_thermique
    when 'voiture_electrique' then car_electrique
    when 'covoiturage' then covoiturage
    when 'transports_en_commun' then transit
    else 0 end;

  case p_template
    when 'velo' then
      if has_commute and commute_factor > 0 then
        return h.commute_km * commute_factor;
      end if;
    when 'transports' then
      if has_commute and commute_factor > transit then
        return h.commute_km * (commute_factor - transit);
      end if;
    when 'covoiturage' then
      if has_commute and h.commute_mode in ('voiture_seul', 'voiture_electrique') then
        return h.commute_km * commute_factor / 2;
      end if;
    when 'train' then
      if h.short_flights_year > 0 and p_variant in ('300', '500', '800') then
        return p_variant::numeric * (avion_court - tgv);
      end if;
    when 'vege' then
      if p_variant = 'boeuf' and h.beef_meals_week > 0 then
        return boeuf - vegetarien;
      elsif p_variant = 'autre' and h.other_meat_meals_week > 0 then
        return autre_viande - vegetarien;
      end if;
    when 'moins_boeuf' then
      if h.beef_meals_week > 0 then
        return boeuf - autre_viande;
      end if;
    when 'occasion' then
      if h.new_clothes_year > 0 then
        return case p_variant
          when 'tshirt' then 6.43
          when 'chemise' then 13.2
          when 'chaussures' then 15
          when 'jean' then 25.1
          when 'pull' then 56.7
          when 'manteau' then 101
          else 0 end;
      end if;
    when 'chauffage' then
      if h.heating_kg_year > 0 then
        return h.heating_kg_year * 0.07 / 30;
      end if;
    else
      null;
  end case;
  return 0;
end;
$$;

-- Rejoindre une entreprise --------------------------------------------------

-- Lisible sans être connecté : nom de l'entreprise et équipes pour un code donné.
create or replace function public.company_by_code(p_code text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'email_domain', c.email_domain,
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by t.name)
      from public.teams t where t.company_id = c.id), '[]'::jsonb))
  from public.companies c
  where c.join_code = upper(trim(p_code))
$$;

create or replace function public.join_company(
  p_code text,
  p_team uuid,
  p_display_name text,
  p_consent_team_stats boolean,
  p_consent_feedback boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  c public.companies;
  user_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select * into c from public.companies where join_code = upper(trim(p_code));
  if not found then
    raise exception 'unknown_code';
  end if;
  select email into user_email from auth.users where id = auth.uid();
  if c.email_domain is not null
     and lower(split_part(user_email, '@', 2)) <> lower(c.email_domain) then
    raise exception 'wrong_email_domain';
  end if;
  if p_team is not null
     and not exists (select 1 from public.teams where id = p_team and company_id = c.id) then
    raise exception 'unknown_team';
  end if;

  insert into public.profiles (id, company_id, team_id, display_name, consent_data,
                               consent_team_stats, consent_feedback)
  values (auth.uid(), c.id, p_team, trim(p_display_name), true,
          coalesce(p_consent_team_stats, true), coalesce(p_consent_feedback, true))
  on conflict (id) do update set
    team_id = excluded.team_id,
    display_name = excluded.display_name,
    consent_team_stats = excluded.consent_team_stats,
    consent_feedback = excluded.consent_feedback
  where public.profiles.company_id = excluded.company_id;
end;
$$;

-- Valider une journée de défi ------------------------------------------------

create or replace function public.validate_challenge_day(
  p_challenge uuid,
  p_units integer,
  p_photo_path text default null,
  p_witness uuid default null,
  p_caption text default null,
  p_visibility text default 'company')
returns public.validations
language plpgsql security definer
set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  c public.user_challenges;
  t public.challenge_templates;
  h public.habits;
  per_unit numeric;
  used integer;
  allowed integer;
  lvl smallint;
  v public.validations;
  done_units integer;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;

  select * into c from public.user_challenges
  where id = p_challenge and user_id = me.id
  for update;
  if not found then
    raise exception 'challenge_not_found';
  end if;
  if c.status <> 'active' or current_date not between c.starts_on and c.ends_on then
    raise exception 'challenge_closed';
  end if;
  if p_units is null or p_units < 1 then
    raise exception 'invalid_units';
  end if;

  select * into t from public.challenge_templates where id = c.template_id;
  select * into h from public.habits where user_id = me.id;
  if not found then
    raise exception 'no_habits';
  end if;

  per_unit := public.unit_kg(c.template_id, c.variant, h);
  if per_unit <= 0 then
    raise exception 'not_eligible';
  end if;

  -- Plafond partagé par groupe (ex. 2 trajets domicile-travail par jour, tous défis confondus).
  select coalesce(sum(val.units), 0) into used
  from public.validations val
  join public.challenge_templates tt on tt.id = val.template_id
  where val.user_id = me.id
    and val.status = 'valid'
    and tt.cap_group = t.cap_group
    and val.day > current_date - t.cap_window_days;
  allowed := least(p_units, t.cap_units - used);
  if allowed <= 0 then
    raise exception 'cap_reached';
  end if;

  if p_witness is not null and (
       p_witness = me.id
       or not exists (select 1 from public.profiles
                      where id = p_witness and company_id = me.company_id)) then
    raise exception 'invalid_witness';
  end if;
  if p_photo_path is not null and split_part(p_photo_path, '/', 1) <> me.id::text then
    raise exception 'invalid_photo';
  end if;

  lvl := (p_photo_path is not null)::int + (p_witness is not null)::int;

  insert into public.validations (
    challenge_id, user_id, company_id, team_id, template_id, variant, day, units,
    kg, points, proof_photo_path, witness_id, witness_status, proof_level, caption,
    visibility)
  values (
    c.id, me.id, me.company_id, me.team_id, c.template_id, c.variant, current_date, allowed,
    round(per_unit * allowed, 3),
    allowed * t.points_per_unit + case when lvl > 0 then 5 else 0 end,
    p_photo_path, p_witness,
    case when p_witness is null then 'none' else 'pending' end,
    lvl, nullif(trim(p_caption), ''),
    -- Sans preuve, rien n'est publié.
    case when lvl > 0 and p_visibility = 'company' then 'company' else 'private' end)
  returning * into v;

  select coalesce(sum(units), 0) into done_units
  from public.validations where challenge_id = c.id and status = 'valid';
  if done_units >= c.target then
    update public.user_challenges set status = 'done' where id = c.id;
  end if;

  return v;
end;
$$;

-- Réponse du collègue témoin : un refus annule la validation.
create or replace function public.respond_witness(p_validation uuid, p_confirm boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.validations set
    witness_status = case when p_confirm then 'confirmed' else 'denied' end,
    status = case when p_confirm then status else 'rejected' end,
    kg = case when p_confirm then kg else 0 end,
    points = case when p_confirm then points else 0 end,
    visibility = case when p_confirm then visibility else 'private' end
  where id = p_validation
    and witness_id = auth.uid()
    and witness_status = 'pending';
  if not found then
    raise exception 'nothing_to_confirm';
  end if;
end;
$$;

-- Classement des équipes : seulement les équipes d'au moins 5 participants,
-- les plus petites sont regroupées, et un groupe de moins de 5 n'est pas affiché.
create or replace function public.team_stats(p_since date default null)
returns table (team_name text, participants integer, kg numeric, kg_per_person numeric, is_mine boolean)
language sql stable security definer set search_path = public
as $$
  with me as (
    select company_id, team_id from public.profiles where id = auth.uid()
  ),
  members as (
    select p.id, p.team_id
    from public.profiles p, me
    where p.company_id = me.company_id and p.consent_team_stats
  ),
  per_team as (
    select coalesce(t.name, 'Sans équipe') as name, m.team_id,
           count(*) as participants,
           coalesce(sum(vs.kg), 0) as kg
    from members m
    left join public.teams t on t.id = m.team_id
    left join lateral (
      select sum(v.kg) as kg from public.validations v
      where v.user_id = m.id and v.status = 'valid'
        and (p_since is null or v.day >= p_since)
    ) vs on true
    group by 1, 2
  ),
  grouped as (
    select case when participants >= 5 then name else 'Autres équipes' end as name,
           case when participants >= 5 then team_id end as team_id,
           participants, kg
    from per_team
  )
  select g.name,
         sum(g.participants)::integer,
         round(sum(g.kg), 1),
         round(sum(g.kg) / sum(g.participants), 1),
         coalesce(bool_or(g.team_id = (select team_id from me)), false)
  from grouped g
  group by g.name
  having sum(g.participants) >= 5
  order by 4 desc;
$$;

-- Total de l'entreprise (agrégé, sans détail individuel).
create or replace function public.company_stats()
returns table (participants integer, kg numeric)
language sql stable security definer set search_path = public
as $$
  select
    (select count(*)::integer from public.profiles where company_id = public.my_company_id()),
    coalesce((select round(sum(kg), 1) from public.validations
              where company_id = public.my_company_id() and status = 'valid'), 0)
$$;

-- Suppression du compte : profil, bilans, défis et validations partent en cascade.
-- Les réponses au questionnaire restent, détachées de la personne (user_id à null).
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

-- Droits d'exécution ----------------------------------------------------------

revoke all on function public.my_company_id() from public;
revoke all on function public.company_by_code(text) from public;
revoke all on function public.join_company(text, uuid, text, boolean, boolean) from public;
revoke all on function public.validate_challenge_day(uuid, integer, text, uuid, text, text) from public;
revoke all on function public.respond_witness(uuid, boolean) from public;
revoke all on function public.team_stats(date) from public;
revoke all on function public.company_stats() from public;
revoke all on function public.delete_my_account() from public;

grant execute on function public.company_by_code(text) to anon, authenticated;
grant execute on function public.my_company_id() to authenticated;
grant execute on function public.join_company(text, uuid, text, boolean, boolean) to authenticated;
grant execute on function public.validate_challenge_day(uuid, integer, text, uuid, text, text) to authenticated;
grant execute on function public.respond_witness(uuid, boolean) to authenticated;
grant execute on function public.team_stats(date) to authenticated;
grant execute on function public.company_stats() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
-- Sécurité ligne à ligne : chacun ne voit que son entreprise, et n'écrit que ses propres données.
-- Les validations ne s'écrivent que par validate_challenge_day (pas de politique d'insertion).

alter table public.companies enable row level security;
alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.footprints enable row level security;
alter table public.habits enable row level security;
alter table public.challenge_templates enable row level security;
alter table public.user_challenges enable row level security;
alter table public.validations enable row level security;
alter table public.cheers enable row level security;
alter table public.reports enable row level security;
alter table public.feedback enable row level security;

-- Entreprise et équipes : lecture de la sienne uniquement.
create policy "companies: la mienne" on public.companies
  for select to authenticated using (id = public.my_company_id());
create policy "teams: de mon entreprise" on public.teams
  for select to authenticated using (company_id = public.my_company_id());

-- Profils : mes collègues voient mon nom et mon équipe ; je modifie le mien.
create policy "profiles: collègues" on public.profiles
  for select to authenticated using (company_id = public.my_company_id());
create policy "profiles: modifier le mien" on public.profiles
  for update to authenticated using (id = auth.uid())
  with check (id = auth.uid() and company_id = public.my_company_id());

-- Bilans et habitudes : strictement personnels.
create policy "footprints: les miens" on public.footprints
  for select to authenticated using (user_id = auth.uid());
create policy "footprints: ajouter" on public.footprints
  for insert to authenticated with check (user_id = auth.uid());
create policy "habits: les miennes" on public.habits
  for select to authenticated using (user_id = auth.uid());
create policy "habits: créer" on public.habits
  for insert to authenticated with check (user_id = auth.uid());
create policy "habits: modifier" on public.habits
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Catalogue : lisible par tous les connectés.
create policy "templates: lecture" on public.challenge_templates
  for select to authenticated using (active);

-- Défis : les miens.
create policy "challenges: les miens" on public.user_challenges
  for select to authenticated using (user_id = auth.uid());
create policy "challenges: créer" on public.user_challenges
  for insert to authenticated
  with check (user_id = auth.uid() and company_id = public.my_company_id() and status = 'active');
create policy "challenges: abandonner" on public.user_challenges
  for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid() and status in ('active', 'abandoned'));

-- Validations : les miennes, celles où je suis témoin, et le fil de mon entreprise.
create policy "validations: lecture" on public.validations
  for select to authenticated using (
    user_id = auth.uid()
    or witness_id = auth.uid()
    or (visibility = 'company' and status = 'valid' and company_id = public.my_company_id())
  );

-- Bravos : visibles dans l'entreprise, un par personne et par publication visible.
create policy "cheers: lecture" on public.cheers
  for select to authenticated using (
    exists (select 1 from public.validations v where v.id = validation_id)
  );
create policy "cheers: ajouter" on public.cheers
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.validations v
                where v.id = validation_id and v.visibility = 'company')
  );
create policy "cheers: retirer" on public.cheers
  for delete to authenticated using (user_id = auth.uid());

-- Signalements : je vois les miens ; l'équipe Pousse les traite avec la clé de service.
create policy "reports: les miens" on public.reports
  for select to authenticated using (user_id = auth.uid());
create policy "reports: ajouter" on public.reports
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.validations v
                where v.id = validation_id and v.visibility = 'company')
  );

-- Questionnaire : écriture seule, lu uniquement par l'équipe Pousse.
create policy "feedback: répondre" on public.feedback
  for insert to authenticated with check (
    user_id = auth.uid() and company_id = public.my_company_id()
  );

-- Photos de preuve ---------------------------------------------------------
-- Rangées sous proofs/<id utilisateur>/... ; lisibles par l'auteur, le témoin,
-- et les collègues quand la publication est visible dans le fil.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "proofs: déposer dans mon dossier" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "proofs: supprimer les miennes" on storage.objects
  for delete to authenticated using (
    bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "proofs: lecture" on storage.objects
  for select to authenticated using (
    bucket_id = 'proofs' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.validations v where v.proof_photo_path = name)
    )
  );
-- Catalogue des défis (doit correspondre à src/lib/co2/challenges.ts).
insert into public.challenge_templates (id, category, title, points_per_unit, cap_group, cap_units, cap_window_days) values
  ('velo',        'transport',    'Vélo au lieu de la voiture',               12, 'domicile_travail', 2, 1),
  ('transports',  'transport',    'Métro ou RER au lieu de la voiture',       10, 'domicile_travail', 2, 1),
  ('covoiturage', 'transport',    'Covoiturer à deux au lieu de rouler seul', 12, 'domicile_travail', 2, 1),
  ('train',       'transport',    'Train au lieu de l''avion',                40, 'train',            2, 1),
  ('vege',        'alimentation', 'Repas végétarien',                         10, 'repas',            2, 1),
  ('moins_boeuf', 'alimentation', 'Porc, poulet ou poisson au lieu du bœuf',   8, 'repas',            2, 1),
  ('occasion',    'consommation', 'Vêtement d''occasion au lieu de neuf',     30, 'vetements',        3, 1),
  ('chauffage',   'logement',     'Chauffage baissé de 1 °C',                 20, 'chauffage',        1, 7)
on conflict (id) do update set
  category = excluded.category,
  title = excluded.title,
  points_per_unit = excluded.points_per_unit,
  cap_group = excluded.cap_group,
  cap_units = excluded.cap_units,
  cap_window_days = excluded.cap_window_days;

-- Entreprise de démonstration (code DEMO-2026, tout domaine e-mail accepté).
with c as (
  insert into public.companies (name, join_code, email_domain)
  values ('Entreprise démo', 'DEMO-2026', null)
  on conflict (join_code) do update set name = excluded.name
  returning id
)
insert into public.teams (company_id, name)
select c.id, t.name from c,
  (values ('Data'), ('Produit'), ('Finance'), ('Ventes'), ('RH'), ('Opérations')) as t(name)
on conflict (company_id, name) do nothing;
-- Pousse · engagement des personnes déjà sobres
-- 1. Points Pousse, distincts du CO₂ évité (qui reste strict).
-- 2. Maintien : « garder le cap » chaque semaine sur ses habitudes déjà bas carbone.
-- 3. Influence : un collègue qui relève un défi grâce à ta publication te rapporte des points.
-- 4. Classement des équipes par progression rapportée au potentiel de chacun.
-- 5. Défis « expert » et bilan complété (appareils électroniques).
-- 6. Objectif collectif d'équipe.
-- Toutes les valeurs de calcul doivent rester identiques à src/lib/co2/ (challenges.ts, engagement.ts).

-- Schéma ---------------------------------------------------------------------

alter table public.habits
  add column if not exists new_devices_year smallint not null default 0
    check (new_devices_year between 0 and 10);

alter table public.challenge_templates
  add column if not exists level text not null default 'standard'
    check (level in ('standard', 'expert'));

alter table public.user_challenges
  add column if not exists inspired_by uuid references public.validations on delete set null;

alter table public.teams
  add column if not exists goal_kg numeric check (goal_kg > 0);

alter table public.companies
  add column if not exists pilot_weeks smallint not null default 8 check (pilot_weeks between 1 and 52);

-- Semaines où une habitude bas carbone a été confirmée (« je garde le cap »).
create table if not exists public.habit_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  company_id uuid not null references public.companies,
  habit text not null,
  week_start date not null,
  created_at timestamptz not null default now(),
  unique (user_id, habit, week_start)
);
create index if not exists habit_checkins_user_idx on public.habit_checkins (user_id, week_start);

-- Points hors défis (maintien, influence, témoin). Les points des défis restent dans validations.points.
create table if not exists public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  company_id uuid not null references public.companies,
  kind text not null check (kind in ('maintien', 'influence', 'temoin')),
  points integer not null check (points > 0),
  ref_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);
create index if not exists points_ledger_user_idx on public.points_ledger (user_id);

alter table public.habit_checkins enable row level security;
alter table public.points_ledger enable row level security;

drop policy if exists "checkins: les miens" on public.habit_checkins;
create policy "checkins: les miens" on public.habit_checkins
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "points: les miens" on public.points_ledger;
create policy "points: les miens" on public.points_ledger
  for select to authenticated using (user_id = auth.uid());

-- « Relever aussi » : seulement depuis une publication visible d'un collègue de mon entreprise.
drop policy if exists "challenges: créer" on public.user_challenges;
create policy "challenges: créer" on public.user_challenges
  for insert to authenticated
  with check (
    user_id = auth.uid() and company_id = public.my_company_id() and status = 'active'
    and (inspired_by is null or exists (
      select 1 from public.validations v
      where v.id = inspired_by and v.visibility = 'company' and v.status = 'valid'
        and v.company_id = public.my_company_id() and v.user_id <> auth.uid()))
  );

-- Défis expert -----------------------------------------------------------------

insert into public.challenge_templates (id, category, title, points_per_unit, cap_group, cap_units, cap_window_days, level) values
  ('vegetalien',     'alimentation', 'Repas végétalien au lieu de végétarien',      15, 'repas',     2, 1, 'expert'),
  ('vacances_train', 'transport',    'Vacances en train au lieu du long-courrier', 150, 'vacances',  1, 7, 'expert'),
  ('reparation',     'consommation', 'Réparer au lieu de racheter neuf',            60, 'appareils', 1, 7, 'expert')
on conflict (id) do update set
  category = excluded.category, title = excluded.title, points_per_unit = excluded.points_per_unit,
  cap_group = excluded.cap_group, cap_units = excluded.cap_units,
  cap_window_days = excluded.cap_window_days, level = excluded.level;

-- Calcul du CO₂ par unité : version complétée (identique à unitImpact dans challenges.ts).
create or replace function public.unit_kg(p_template text, p_variant text, h public.habits)
returns numeric
language plpgsql immutable
as $$
declare
  car_thermique constant numeric := 0.1106;
  car_electrique constant numeric := 0.0121;
  covoiturage constant numeric := 0.0553;
  transit constant numeric := (0.0042 + 0.0066) / 2;  -- moyenne métro / RER
  avion_court constant numeric := 0.2242;
  avion_long constant numeric := 0.1665;
  tgv constant numeric := 0.0023;
  boeuf constant numeric := 4.97;
  vegetarien constant numeric := 0.85;
  vegetalien constant numeric := 0.54;
  autre_viande constant numeric := (1.65 + 1.46 + 1.46) / 3;  -- porc, poulet, saumon
  commute_factor numeric;
  has_commute boolean := h.commute_km > 0 and h.commute_days > 0;
  veg_meals integer := 14 - h.beef_meals_week - h.other_meat_meals_week;
begin
  commute_factor := case h.commute_mode
    when 'voiture_seul' then car_thermique
    when 'voiture_electrique' then car_electrique
    when 'covoiturage' then covoiturage
    when 'transports_en_commun' then transit
    else 0 end;

  case p_template
    when 'velo' then
      if has_commute and commute_factor > 0 then
        return h.commute_km * commute_factor;
      end if;
    when 'transports' then
      if has_commute and commute_factor > transit then
        return h.commute_km * (commute_factor - transit);
      end if;
    when 'covoiturage' then
      if has_commute and h.commute_mode in ('voiture_seul', 'voiture_electrique') then
        return h.commute_km * commute_factor / 2;
      end if;
    when 'train' then
      if h.short_flights_year > 0 and p_variant in ('300', '500', '800') then
        return p_variant::numeric * (avion_court - tgv);
      end if;
    when 'vege' then
      if p_variant = 'boeuf' and h.beef_meals_week > 0 then
        return boeuf - vegetarien;
      elsif p_variant = 'autre' and h.other_meat_meals_week > 0 then
        return autre_viande - vegetarien;
      end if;
    when 'moins_boeuf' then
      if h.beef_meals_week > 0 then
        return boeuf - autre_viande;
      end if;
    when 'occasion' then
      if h.new_clothes_year > 0 then
        return case p_variant
          when 'tshirt' then 6.43
          when 'chemise' then 13.2
          when 'chaussures' then 15
          when 'jean' then 25.1
          when 'pull' then 56.7
          when 'manteau' then 101
          else 0 end;
      end if;
    when 'chauffage' then
      if h.heating_kg_year > 0 then
        return h.heating_kg_year * 0.07 / 30;
      end if;
    -- Défis expert
    when 'vegetalien' then
      if veg_meals > 0 then
        return vegetarien - vegetalien;
      end if;
    when 'vacances_train' then
      -- Un aller-retour long-courrier (12 000 km) remplacé par 2 000 km de train.
      if h.long_flights_year > 0 then
        return 12000 * avion_long - 2000 * tgv;
      end if;
    when 'reparation' then
      if p_variant = 'smartphone' and h.buys_new_phone then
        return 80.2;
      elsif p_variant = 'ordinateur' and h.new_devices_year > 0 then
        return 193;
      end if;
    else
      null;
  end case;
  return 0;
end;
$$;

-- Potentiel de réduction par semaine : ce que la personne éviterait en relevant tous les défis
-- possibles. Sert à comparer chacun à lui-même dans le classement (minimum 1 kg).
create or replace function public.weekly_potential_kg(h public.habits)
returns numeric
language sql immutable
as $$
  select greatest(1,
    -- tous les trajets domicile-travail à vélo
    case when h.commute_km > 0 and h.commute_days > 0 then
      h.commute_km * 2 * h.commute_days * case h.commute_mode
        when 'voiture_seul' then 0.1106 when 'voiture_electrique' then 0.0121
        when 'covoiturage' then 0.0553 when 'transports_en_commun' then (0.0042 + 0.0066) / 2
        else 0 end
    else 0 end
    -- repas : bœuf et autres viandes en végétarien, végétarien en végétalien
    + h.beef_meals_week * (4.97 - 0.85)
    + h.other_meat_meals_week * ((1.65 + 1.46 + 1.46) / 3 - 0.85)
    + (14 - h.beef_meals_week - h.other_meat_meals_week) * (0.85 - 0.54)
    -- avion remplacé par le train
    + (h.short_flights_year * 1400 * (0.2242 - 0.0023)
       + h.long_flights_year * (12000 * 0.1665 - 2000 * 0.0023)) / 52
    -- vêtements et appareils en seconde main ou réparés
    + h.new_clothes_year * 13.2 / 52
    + h.new_devices_year * 193.0 / 52
    -- chauffage à 1 °C de moins
    + h.heating_kg_year * 0.07 / 52)
$$;

-- Habitudes bas carbone qu'une personne peut confirmer chaque semaine.
create or replace function public.kept_habits(h public.habits)
returns text[]
language sql immutable
as $$
  select array_remove(array[
    case when h.commute_mode in ('velo', 'marche_teletravail', 'transports_en_commun', 'covoiturage')
         then 'trajet_doux' end,
    case when 14 - h.beef_meals_week - h.other_meat_meals_week >= 7 then 'repas_vege' end,
    case when h.short_flights_year + h.long_flights_year = 0 then 'sans_avion' end,
    case when h.new_clothes_year <= 5 then 'peu_de_neuf' end,
    case when not h.buys_new_phone then 'telephone_garde' end
  ], null)
$$;

-- Garder le cap : une confirmation par habitude et par semaine, 10 points.
create or replace function public.keep_habit(p_habit text)
returns public.habit_checkins
language plpgsql security definer
set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  h public.habits;
  r public.habit_checkins;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;
  select * into h from public.habits where user_id = me.id;
  if not found then
    raise exception 'no_habits';
  end if;
  if not (p_habit = any (public.kept_habits(h))) then
    raise exception 'not_kept_habit';
  end if;

  insert into public.habit_checkins (user_id, company_id, habit, week_start)
  values (me.id, me.company_id, p_habit, date_trunc('week', current_date)::date)
  on conflict (user_id, habit, week_start) do nothing
  returning * into r;
  if r.id is null then
    raise exception 'already_kept';
  end if;

  insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
  values (me.id, me.company_id, 'maintien', 10, r.id);
  return r;
end;
$$;

-- Validation d'une journée : version complétée, qui crédite aussi l'influence.
create or replace function public.validate_challenge_day(
  p_challenge uuid,
  p_units integer,
  p_photo_path text default null,
  p_witness uuid default null,
  p_caption text default null,
  p_visibility text default 'company')
returns public.validations
language plpgsql security definer
set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  c public.user_challenges;
  t public.challenge_templates;
  h public.habits;
  per_unit numeric;
  used integer;
  allowed integer;
  lvl smallint;
  v public.validations;
  done_units integer;
  inspirer uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;

  select * into c from public.user_challenges
  where id = p_challenge and user_id = me.id
  for update;
  if not found then
    raise exception 'challenge_not_found';
  end if;
  if c.status <> 'active' or current_date not between c.starts_on and c.ends_on then
    raise exception 'challenge_closed';
  end if;
  if p_units is null or p_units < 1 then
    raise exception 'invalid_units';
  end if;

  select * into t from public.challenge_templates where id = c.template_id;
  select * into h from public.habits where user_id = me.id;
  if not found then
    raise exception 'no_habits';
  end if;

  per_unit := public.unit_kg(c.template_id, c.variant, h);
  if per_unit <= 0 then
    raise exception 'not_eligible';
  end if;

  -- Plafond partagé par groupe (ex. 2 trajets domicile-travail par jour, tous défis confondus).
  select coalesce(sum(val.units), 0) into used
  from public.validations val
  join public.challenge_templates tt on tt.id = val.template_id
  where val.user_id = me.id
    and val.status = 'valid'
    and tt.cap_group = t.cap_group
    and val.day > current_date - t.cap_window_days;
  allowed := least(p_units, t.cap_units - used);
  if allowed <= 0 then
    raise exception 'cap_reached';
  end if;

  if p_witness is not null and (
       p_witness = me.id
       or not exists (select 1 from public.profiles
                      where id = p_witness and company_id = me.company_id)) then
    raise exception 'invalid_witness';
  end if;
  if p_photo_path is not null and split_part(p_photo_path, '/', 1) <> me.id::text then
    raise exception 'invalid_photo';
  end if;

  lvl := (p_photo_path is not null)::int + (p_witness is not null)::int;

  insert into public.validations (
    challenge_id, user_id, company_id, team_id, template_id, variant, day, units,
    kg, points, proof_photo_path, witness_id, witness_status, proof_level, caption,
    visibility)
  values (
    c.id, me.id, me.company_id, me.team_id, c.template_id, c.variant, current_date, allowed,
    round(per_unit * allowed, 3),
    allowed * t.points_per_unit + case when lvl > 0 then 5 else 0 end,
    p_photo_path, p_witness,
    case when p_witness is null then 'none' else 'pending' end,
    lvl, nullif(trim(p_caption), ''),
    -- Sans preuve, rien n'est publié.
    case when lvl > 0 and p_visibility = 'company' then 'company' else 'private' end)
  returning * into v;

  -- Influence : la première validation d'un défi relevé grâce à un collègue lui rapporte 15 points.
  if c.inspired_by is not null then
    select user_id into inspirer from public.validations
    where id = c.inspired_by and company_id = me.company_id and user_id <> me.id;
    if inspirer is not null then
      insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
      values (inspirer, me.company_id, 'influence', 15, c.id)
      on conflict (user_id, kind, ref_id) do nothing;
    end if;
  end if;

  select coalesce(sum(units), 0) into done_units
  from public.validations where challenge_id = c.id and status = 'valid';
  if done_units >= c.target then
    update public.user_challenges set status = 'done' where id = c.id;
  end if;

  return v;
end;
$$;

-- Réponse du témoin : confirmer rapporte 3 points ; un refus annule la validation
-- (et l'influence créditée si le défi n'a plus aucune validation valide).
create or replace function public.respond_witness(p_validation uuid, p_confirm boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v public.validations;
begin
  update public.validations set
    witness_status = case when p_confirm then 'confirmed' else 'denied' end,
    status = case when p_confirm then status else 'rejected' end,
    kg = case when p_confirm then kg else 0 end,
    points = case when p_confirm then points else 0 end,
    visibility = case when p_confirm then visibility else 'private' end
  where id = p_validation
    and witness_id = auth.uid()
    and witness_status = 'pending'
  returning * into v;
  if v.id is null then
    raise exception 'nothing_to_confirm';
  end if;

  if p_confirm then
    insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
    values (auth.uid(), v.company_id, 'temoin', 3, v.id)
    on conflict (user_id, kind, ref_id) do nothing;
  elsif not exists (select 1 from public.validations
                    where challenge_id = v.challenge_id and status = 'valid') then
    delete from public.points_ledger where kind = 'influence' and ref_id = v.challenge_id;
  end if;
end;
$$;

-- Influence d'une personne : défis relevés grâce à elle et CO₂ évité par ces collègues (agrégé).
create or replace function public.my_influence()
returns table (challenges integer, colleagues integer, kg numeric)
language sql stable security definer set search_path = public
as $$
  select count(distinct c.id)::integer,
         count(distinct c.user_id)::integer,
         coalesce(round(sum(v.kg), 1), 0)
  from public.user_challenges c
  join public.validations src on src.id = c.inspired_by and src.user_id = auth.uid()
  left join public.validations v on v.challenge_id = c.id and v.status = 'valid'
  where c.company_id = public.my_company_id()
$$;

-- Classement des équipes ----------------------------------------------------------
-- Chacun est comparé à son propre potentiel : score individuel = le meilleur de
--   progression = CO₂ évité / potentiel de la période (plafonné à 100 %)
--   constance  = semaines où il a gardé le cap / semaines de la période (plafonné à 100 %)
-- Score d'équipe = moyenne des scores individuels (un inactif compte 0 : la participation pèse).
-- Toujours : équipes d'au moins 5 participants, les plus petites regroupées ou masquées.
drop function if exists public.team_stats(date);
create function public.team_stats(p_since date default null)
returns table (team_name text, participants integer, active integer, kg numeric,
               kg_per_person numeric, score integer, is_mine boolean)
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  with me as (
    select p.company_id, p.team_id, c.pilot_start
    from public.profiles p join public.companies c on c.id = p.company_id
    where p.id = auth.uid()
  ),
  members as (
    select p.id, p.team_id,
           greatest(coalesce(p_since, me.pilot_start), p.created_at::date) as since
    from public.profiles p, me
    where p.company_id = me.company_id and p.consent_team_stats
  ),
  per_member as (
    select m.id, m.team_id,
           greatest(1, current_date - m.since + 1) as days,
           coalesce((select sum(v.kg) from public.validations v
                     where v.user_id = m.id and v.status = 'valid' and v.day >= m.since), 0) as kg,
           (select count(distinct k.week_start) from public.habit_checkins k
             where k.user_id = m.id and k.week_start >= date_trunc('week', m.since)::date) as kept_weeks,
           (select public.weekly_potential_kg(h) from public.habits h where h.user_id = m.id) as potential
    from members m
  ),
  scored as (
    select pm.*,
           100 * greatest(
             case when pm.potential is null then 0
                  else least(1, pm.kg / (pm.potential * pm.days / 7.0)) end,
             least(1, pm.kept_weeks / ceil(pm.days / 7.0))) as individual,
           (pm.kg > 0 or pm.kept_weeks > 0) as is_active
    from per_member pm
  ),
  per_team as (
    select coalesce(t.name, 'Sans équipe') as name, s.team_id,
           count(*) as participants,
           count(*) filter (where s.is_active) as active,
           sum(s.kg) as kg,
           sum(s.individual) as individual_sum
    from scored s
    left join public.teams t on t.id = s.team_id
    group by 1, 2
  ),
  grouped as (
    select case when participants >= 5 then name else 'Autres équipes' end as name,
           case when participants >= 5 then team_id end as team_id,
           participants, active, kg, individual_sum
    from per_team
  )
  select g.name,
         sum(g.participants)::integer,
         sum(g.active)::integer,
         round(sum(g.kg), 1),
         round(sum(g.kg) / sum(g.participants), 1),
         round(sum(g.individual_sum) / sum(g.participants))::integer,
         coalesce(bool_or(g.team_id = (select team_id from me)), false)
  from grouped g
  group by g.name
  having sum(g.participants) >= 5
  order by 6 desc, 5 desc;
$$;

-- Objectif collectif : celui de mon équipe si elle compte au moins 5 participants,
-- sinon celui de l'entreprise. Par défaut 30 kg par participant sur la durée du pilote.
create or replace function public.collective_goal()
returns table (scope text, name text, participants integer, kg numeric, goal_kg numeric,
               ends_on date)
language sql stable security definer set search_path = public
as $$
  with me as (
    select p.company_id, p.team_id, c.name as company_name, c.pilot_start, c.pilot_weeks
    from public.profiles p join public.companies c on c.id = p.company_id
    where p.id = auth.uid()
  ),
  team as (
    select t.name, t.goal_kg,
           (select count(*) from public.profiles p
             where p.team_id = t.id and p.consent_team_stats) as participants,
           (select coalesce(sum(v.kg), 0) from public.validations v
              join public.profiles p on p.id = v.user_id and p.consent_team_stats
             where v.team_id = t.id and v.status = 'valid' and v.day >= me.pilot_start) as kg
    from public.teams t, me where t.id = me.team_id
  ),
  company as (
    select me.company_name as name,
           (select count(*) from public.profiles p where p.company_id = me.company_id) as participants,
           (select coalesce(sum(v.kg), 0) from public.validations v
             where v.company_id = me.company_id and v.status = 'valid'
               and v.day >= me.pilot_start) as kg,
           (select sum(t.goal_kg) from public.teams t where t.company_id = me.company_id) as teams_goal
    from me
  )
  select 'team', team.name, team.participants::integer, round(team.kg, 1),
         coalesce(team.goal_kg, 30 * team.participants), (select pilot_start + 7 * pilot_weeks - 1 from me)
  from team where team.participants >= 5
  union all
  select 'company', company.name, company.participants::integer, round(company.kg, 1),
         greatest(30, 30 * company.participants), (select pilot_start + 7 * pilot_weeks - 1 from me)
  from company
  where not exists (select 1 from team where team.participants >= 5)
$$;

-- Droits -------------------------------------------------------------------------

revoke all on function public.keep_habit(text) from public;
revoke all on function public.my_influence() from public;
revoke all on function public.team_stats(date) from public;
revoke all on function public.collective_goal() from public;
revoke all on function public.respond_witness(uuid, boolean) from public;
revoke all on function public.validate_challenge_day(uuid, integer, text, uuid, text, text) from public;

grant execute on function public.keep_habit(text) to authenticated;
grant execute on function public.my_influence() to authenticated;
grant execute on function public.team_stats(date) to authenticated;
grant execute on function public.collective_goal() to authenticated;
grant execute on function public.respond_witness(uuid, boolean) to authenticated;
grant execute on function public.validate_challenge_day(uuid, integer, text, uuid, text, text) to authenticated;
grant execute on function public.weekly_potential_kg(public.habits) to authenticated;
grant execute on function public.kept_habits(public.habits) to authenticated;
-- Pousse · deux axes clairs
--   Le jeu = les points (classement individuel et par équipe).
--   L'impact = les kg de CO₂ évités (objectif collectif de l'entreprise), jamais utilisés pour gagner.
-- Remplace le score de progression de 0005 par un classement en points par participant.

-- Barème lisible : défi du quotidien 10, train 30, défis expert 15 à 150 (+5 avec une preuve).
update public.challenge_templates set points_per_unit = case id
  when 'velo' then 10
  when 'transports' then 10
  when 'covoiturage' then 10
  when 'vege' then 10
  when 'moins_boeuf' then 10
  when 'occasion' then 10
  when 'chauffage' then 10
  when 'train' then 30
  when 'vegetalien' then 15
  when 'reparation' then 60
  when 'vacances_train' then 150
  else points_per_unit end;

-- Le potentiel de réduction ne sert plus au classement.
drop function if exists public.weekly_potential_kg(public.habits);

-- Points d'une personne depuis une date : défis validés + garder le cap + influence + témoin.
create or replace function public.member_points(p_user uuid, p_since date)
returns integer
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select (
    coalesce((select sum(v.points) from public.validations v
              where v.user_id = p_user and v.status = 'valid'
                and (p_since is null or v.day >= p_since)), 0)
    + coalesce((select sum(l.points) from public.points_ledger l
                where l.user_id = p_user
                  and (p_since is null or l.created_at >= p_since::timestamptz)), 0)
  )::integer
$$;
revoke all on function public.member_points(uuid, date) from public;

-- Classement des équipes : points par participant (un inactif compte 0).
-- Toujours : équipes d'au moins 5 participants, les plus petites regroupées ou masquées.
drop function if exists public.team_stats(date);
create function public.team_stats(p_since date default null)
returns table (team_name text, participants integer, active integer, points integer,
               points_per_person numeric, kg numeric, is_mine boolean)
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  with me as (
    select company_id, team_id from public.profiles where id = auth.uid()
  ),
  per_member as (
    select p.id, p.team_id,
           public.member_points(p.id, p_since) as points,
           coalesce((select sum(v.kg) from public.validations v
                     where v.user_id = p.id and v.status = 'valid'
                       and (p_since is null or v.day >= p_since)), 0) as kg
    from public.profiles p, me
    where p.company_id = me.company_id and p.consent_team_stats
  ),
  per_team as (
    select coalesce(t.name, 'Sans équipe') as name, m.team_id,
           count(*) as participants,
           count(*) filter (where m.points > 0) as active,
           sum(m.points) as points,
           sum(m.kg) as kg
    from per_member m
    left join public.teams t on t.id = m.team_id
    group by 1, 2
  ),
  grouped as (
    select case when participants >= 5 then name else 'Autres équipes' end as name,
           case when participants >= 5 then team_id end as team_id,
           participants, active, points, kg
    from per_team
  )
  select g.name,
         sum(g.participants)::integer,
         sum(g.active)::integer,
         sum(g.points)::integer,
         round(sum(g.points)::numeric / sum(g.participants), 1),
         round(sum(g.kg), 1),
         coalesce(bool_or(g.team_id = (select team_id from me)), false)
  from grouped g
  group by g.name
  having sum(g.participants) >= 5
  order by 5 desc, 6 desc;
$$;

-- Objectif collectif : un seul, celui de l'entreprise, en kg de CO₂ évités depuis le début du pilote.
-- 30 kg par participant sur la durée du pilote (companies.pilot_weeks).
drop function if exists public.collective_goal();
create function public.collective_goal()
returns table (name text, participants integer, kg numeric, goal_kg numeric, ends_on date)
language sql stable security definer set search_path = public
as $$
  select c.name,
         (select count(*) from public.profiles p where p.company_id = c.id)::integer,
         coalesce((select round(sum(v.kg), 1) from public.validations v
                   where v.company_id = c.id and v.status = 'valid' and v.day >= c.pilot_start), 0),
         greatest(30, 30 * (select count(*) from public.profiles p where p.company_id = c.id)),
         c.pilot_start + 7 * c.pilot_weeks - 1
  from public.companies c
  where c.id = public.my_company_id()
$$;

revoke all on function public.team_stats(date) from public;
revoke all on function public.collective_goal() from public;
grant execute on function public.team_stats(date) to authenticated;
grant execute on function public.collective_goal() to authenticated;
-- Pousse · les points s'appellent des « pousses », et on en gagne aussi chaque jour :
--   - quêtes du jour : valider un défi, ajouter une preuve, encourager un collègue ou garder le cap
--     → +15 pousses quand les trois sont faites ;
--   - série de jours actifs : +10 à 3 jours, +25 à 7, +50 à 14, +100 à 30.
-- Ces bonus sont écrits par la base (claim_daily_rewards), jamais par l'application.

alter table public.points_ledger drop constraint if exists points_ledger_kind_check;
alter table public.points_ledger add constraint points_ledger_kind_check
  check (kind in ('maintien', 'influence', 'temoin', 'quete', 'serie'));

-- Jours (heure de Paris) où une personne a fait quelque chose : défi validé, habitude gardée, bravo donné.
create or replace function public.active_days(p_user uuid)
returns setof date
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select v.day from public.validations v where v.user_id = p_user and v.status = 'valid'
  union
  select k.created_at::date from public.habit_checkins k where k.user_id = p_user
  union
  select c.created_at::date from public.cheers c where c.user_id = p_user
$$;
revoke all on function public.active_days(uuid) from public;

-- Série en cours : jours consécutifs actifs, jusqu'à aujourd'hui (ou hier si rien encore aujourd'hui).
create or replace function public.day_streak(p_user uuid)
returns table (streak integer, started_on date)
language plpgsql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  d date := current_date;
  n integer := 0;
begin
  if not exists (select 1 from public.active_days(p_user) a where a = d) then
    d := d - 1;
  end if;
  while exists (select 1 from public.active_days(p_user) a where a = d) loop
    n := n + 1;
    d := d - 1;
  end loop;
  return query select n, d + 1;
end;
$$;
revoke all on function public.day_streak(uuid) from public;

-- Relève les quêtes du jour et la série, crédite les bonus dus (une seule fois), et renvoie l'état.
create or replace function public.claim_daily_rewards()
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  q_defi boolean;
  q_preuve boolean;
  q_lien boolean;
  s record;
  m record;
  gained integer := 0;
  n integer;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;

  q_defi := exists (select 1 from public.validations
                    where user_id = me.id and status = 'valid' and day = current_date);
  q_preuve := exists (select 1 from public.validations
                      where user_id = me.id and status = 'valid' and day = current_date and proof_level > 0);
  q_lien := exists (select 1 from public.cheers where user_id = me.id and created_at::date = current_date)
         or exists (select 1 from public.habit_checkins where user_id = me.id and created_at::date = current_date);

  if q_defi and q_preuve and q_lien then
    insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
    values (me.id, me.company_id, 'quete', 15, md5(me.id::text || ':quete:' || current_date)::uuid)
    on conflict (user_id, kind, ref_id) do nothing;
    get diagnostics n = row_count;
    gained := gained + n * 15;
  end if;

  select * into s from public.day_streak(me.id);
  for m in select * from (values (3, 10), (7, 25), (14, 50), (30, 100)) as t(days, pts) loop
    if s.streak >= m.days then
      insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
      values (me.id, me.company_id, 'serie', m.pts,
              md5(me.id::text || ':serie:' || m.days || ':' || s.started_on)::uuid)
      on conflict (user_id, kind, ref_id) do nothing;
      get diagnostics n = row_count;
      gained := gained + n * m.pts;
    end if;
  end loop;

  return jsonb_build_object(
    'quests', jsonb_build_object('defi', q_defi, 'preuve', q_preuve, 'lien', q_lien),
    'quest_done', exists (select 1 from public.points_ledger where user_id = me.id and kind = 'quete'
                          and ref_id = md5(me.id::text || ':quete:' || current_date)::uuid),
    'streak', s.streak,
    'gained', gained);
end;
$$;

revoke all on function public.claim_daily_rewards() from public;
grant execute on function public.claim_daily_rewards() to authenticated;
-- Pousse · scanner de produits (données Open Food Facts, licence ODbL).
-- Scanner ne rapporte rien en CO₂ évité. Choisir une alternative mieux notée rapporte +5 pousses,
-- au plus 3 fois par jour, et compte comme un jour actif pour la série.

create table if not exists public.product_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  company_id uuid not null references public.companies,
  code text not null check (code ~ '^[0-9]{8,14}$'),
  name text check (char_length(name) <= 200),
  grade text,
  co2_kg_per_kg numeric check (co2_kg_per_kg >= 0),
  created_at timestamptz not null default now()
);
create index if not exists product_scans_user_idx on public.product_scans (user_id, created_at desc);

create table if not exists public.product_swaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  company_id uuid not null references public.companies,
  from_code text not null check (from_code ~ '^[0-9]{8,14}$'),
  to_code text not null check (to_code ~ '^[0-9]{8,14}$' and to_code <> from_code),
  from_grade text,
  to_grade text,
  from_co2 numeric,
  to_co2 numeric,
  created_at timestamptz not null default now()
);
create index if not exists product_swaps_user_idx on public.product_swaps (user_id, created_at desc);

alter table public.product_scans enable row level security;
alter table public.product_swaps enable row level security;

drop policy if exists "scans: les miens" on public.product_scans;
create policy "scans: les miens" on public.product_scans
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "scans: ajouter" on public.product_scans;
create policy "scans: ajouter" on public.product_scans
  for insert to authenticated with check (user_id = auth.uid() and company_id = public.my_company_id());
drop policy if exists "swaps: les miens" on public.product_swaps;
create policy "swaps: les miens" on public.product_swaps
  for select to authenticated using (user_id = auth.uid());

alter table public.points_ledger drop constraint if exists points_ledger_kind_check;
alter table public.points_ledger add constraint points_ledger_kind_check
  check (kind in ('maintien', 'influence', 'temoin', 'quete', 'serie', 'scan'));

-- Rang du Green-Score : A+ = 7 … F = 1, inconnu = 0 (identique à gradeRank dans src/lib/off/product.ts).
create or replace function public.grade_rank(g text)
returns integer
language sql immutable
as $$
  select case g when 'a-plus' then 7 when 'a' then 6 when 'b' then 5 when 'c' then 4
                when 'd' then 3 when 'e' then 2 when 'f' then 1 else 0 end
$$;

-- Choisir une alternative : seulement si elle est meilleure (note, ou même note et 10 % de CO₂ en moins),
-- 3 fois par jour au plus. Les notes viennent de la fiche lue par le serveur de l'application.
create or replace function public.record_swap(
  p_from_code text, p_to_code text,
  p_from_grade text, p_to_grade text,
  p_from_co2 numeric, p_to_co2 numeric)
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  today_count integer;
  s public.product_swaps;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;
  -- Produit scanné non noté : seule une alternative A+, A ou B compte (identique à isBetter).
  if not (public.grade_rank(p_from_grade) = 0 and public.grade_rank(p_to_grade) >= 5
          or public.grade_rank(p_from_grade) > 0 and public.grade_rank(p_to_grade) > public.grade_rank(p_from_grade)
          or (public.grade_rank(p_from_grade) > 0 and public.grade_rank(p_to_grade) = public.grade_rank(p_from_grade)
              and p_to_co2 is not null and p_from_co2 is not null and p_to_co2 < p_from_co2 * 0.9)) then
    raise exception 'not_better';
  end if;
  if exists (select 1 from public.product_swaps where user_id = me.id and to_code = p_to_code
             and created_at::date = current_date) then
    raise exception 'already_swapped';
  end if;
  select count(*) into today_count from public.product_swaps
  where user_id = me.id and created_at::date = current_date;
  if today_count >= 3 then
    raise exception 'swap_cap';
  end if;

  insert into public.product_swaps (user_id, company_id, from_code, to_code, from_grade, to_grade, from_co2, to_co2)
  values (me.id, me.company_id, p_from_code, p_to_code, p_from_grade, p_to_grade, p_from_co2, p_to_co2)
  returning * into s;
  insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
  values (me.id, me.company_id, 'scan', 5, s.id);

  return jsonb_build_object('points', 5, 'remaining', 2 - today_count);
end;
$$;
revoke all on function public.record_swap(text, text, text, text, numeric, numeric) from public;
grant execute on function public.record_swap(text, text, text, text, numeric, numeric) to authenticated;

-- Un meilleur choix au supermarché compte comme un jour actif pour la série.
create or replace function public.active_days(p_user uuid)
returns setof date
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select v.day from public.validations v where v.user_id = p_user and v.status = 'valid'
  union
  select k.created_at::date from public.habit_checkins k where k.user_id = p_user
  union
  select c.created_at::date from public.cheers c where c.user_id = p_user
  union
  select s.created_at::date from public.product_swaps s where s.user_id = p_user
$$;
revoke all on function public.active_days(uuid) from public;
-- Pousse · rééquilibrage du jeu
--   1. Une seule série : les jours actifs (le scanner compte aussi).
--   2. Pas de pousses sans preuve : le CO₂ évité est compté, les pousses non.
--   3. Garder le cap : 20 pousses par semaine au plus (2 habitudes récompensées).
--   4. Quêtes du jour variées : 3 tirées chaque matin parmi celles qui ont du sens pour la personne,
--      figées pour la journée (table daily_quests).

-- 1. Série ----------------------------------------------------------------------

create or replace function public.active_days(p_user uuid)
returns setof date
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select v.day from public.validations v where v.user_id = p_user and v.status = 'valid'
  union
  select k.created_at::date from public.habit_checkins k where k.user_id = p_user
  union
  select c.created_at::date from public.cheers c where c.user_id = p_user
  union
  select s.created_at::date from public.product_swaps s where s.user_id = p_user
  union
  select s.created_at::date from public.product_scans s where s.user_id = p_user
$$;
revoke all on function public.active_days(uuid) from public;

-- Ma série, en lecture seule (pour l'en-tête et le profil).
create or replace function public.my_day_streak()
returns integer
language sql stable security definer set search_path = public
as $$ select streak from public.day_streak(auth.uid()) $$;
revoke all on function public.my_day_streak() from public;
grant execute on function public.my_day_streak() to authenticated;

-- 2. Pas de pousses sans preuve ------------------------------------------------------

create or replace function public.validate_challenge_day(
  p_challenge uuid,
  p_units integer,
  p_photo_path text default null,
  p_witness uuid default null,
  p_caption text default null,
  p_visibility text default 'company')
returns public.validations
language plpgsql security definer
set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  c public.user_challenges;
  t public.challenge_templates;
  h public.habits;
  per_unit numeric;
  used integer;
  allowed integer;
  lvl smallint;
  v public.validations;
  done_units integer;
  inspirer uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;

  select * into c from public.user_challenges
  where id = p_challenge and user_id = me.id
  for update;
  if not found then
    raise exception 'challenge_not_found';
  end if;
  if c.status <> 'active' or current_date not between c.starts_on and c.ends_on then
    raise exception 'challenge_closed';
  end if;
  if p_units is null or p_units < 1 then
    raise exception 'invalid_units';
  end if;

  select * into t from public.challenge_templates where id = c.template_id;
  select * into h from public.habits where user_id = me.id;
  if not found then
    raise exception 'no_habits';
  end if;

  per_unit := public.unit_kg(c.template_id, c.variant, h);
  if per_unit <= 0 then
    raise exception 'not_eligible';
  end if;

  select coalesce(sum(val.units), 0) into used
  from public.validations val
  join public.challenge_templates tt on tt.id = val.template_id
  where val.user_id = me.id
    and val.status = 'valid'
    and tt.cap_group = t.cap_group
    and val.day > current_date - t.cap_window_days;
  allowed := least(p_units, t.cap_units - used);
  if allowed <= 0 then
    raise exception 'cap_reached';
  end if;

  if p_witness is not null and (
       p_witness = me.id
       or not exists (select 1 from public.profiles
                      where id = p_witness and company_id = me.company_id)) then
    raise exception 'invalid_witness';
  end if;
  if p_photo_path is not null and split_part(p_photo_path, '/', 1) <> me.id::text then
    raise exception 'invalid_photo';
  end if;

  lvl := (p_photo_path is not null)::int + (p_witness is not null)::int;

  insert into public.validations (
    challenge_id, user_id, company_id, team_id, template_id, variant, day, units,
    kg, points, proof_photo_path, witness_id, witness_status, proof_level, caption,
    visibility)
  values (
    c.id, me.id, me.company_id, me.team_id, c.template_id, c.variant, current_date, allowed,
    round(per_unit * allowed, 3),
    -- Sans preuve : CO₂ compté, aucune pousse (le classement ne récompense que le vérifiable).
    case when lvl > 0 then allowed * t.points_per_unit + 5 else 0 end,
    p_photo_path, p_witness,
    case when p_witness is null then 'none' else 'pending' end,
    lvl, nullif(trim(p_caption), ''),
    case when lvl > 0 and p_visibility = 'company' then 'company' else 'private' end)
  returning * into v;

  if c.inspired_by is not null and lvl > 0 then
    select user_id into inspirer from public.validations
    where id = c.inspired_by and company_id = me.company_id and user_id <> me.id;
    if inspirer is not null then
      insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
      values (inspirer, me.company_id, 'influence', 15, c.id)
      on conflict (user_id, kind, ref_id) do nothing;
    end if;
  end if;

  select coalesce(sum(units), 0) into done_units
  from public.validations where challenge_id = c.id and status = 'valid';
  if done_units >= c.target then
    update public.user_challenges set status = 'done' where id = c.id;
  end if;

  return v;
end;
$$;
revoke all on function public.validate_challenge_day(uuid, integer, text, uuid, text, text) from public;
grant execute on function public.validate_challenge_day(uuid, integer, text, uuid, text, text) to authenticated;

-- 3. Garder le cap : 2 habitudes récompensées par semaine (20 pousses) ---------------------

create or replace function public.keep_habit(p_habit text)
returns public.habit_checkins
language plpgsql security definer
set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  h public.habits;
  r public.habit_checkins;
  rewarded integer;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;
  select * into h from public.habits where user_id = me.id;
  if not found then
    raise exception 'no_habits';
  end if;
  if not (p_habit = any (public.kept_habits(h))) then
    raise exception 'not_kept_habit';
  end if;

  insert into public.habit_checkins (user_id, company_id, habit, week_start)
  values (me.id, me.company_id, p_habit, date_trunc('week', current_date)::date)
  on conflict (user_id, habit, week_start) do nothing
  returning * into r;
  if r.id is null then
    raise exception 'already_kept';
  end if;

  select count(*) into rewarded
  from public.points_ledger l join public.habit_checkins k on k.id = l.ref_id
  where l.user_id = me.id and l.kind = 'maintien' and k.week_start = r.week_start;
  if rewarded < 2 then
    insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
    values (me.id, me.company_id, 'maintien', 10, r.id);
  end if;
  return r;
end;
$$;

-- 4. Quêtes du jour variées ----------------------------------------------------------------

create table if not exists public.daily_quests (
  user_id uuid not null references public.profiles on delete cascade,
  day date not null,
  quests text[] not null,
  primary key (user_id, day)
);
alter table public.daily_quests enable row level security;
drop policy if exists "quêtes: les miennes" on public.daily_quests;
create policy "quêtes: les miennes" on public.daily_quests
  for select to authenticated using (user_id = auth.uid());

-- Une quête est-elle faite aujourd'hui ?
create or replace function public.quest_done(p_user uuid, p_quest text)
returns boolean
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select case p_quest
    when 'preuve' then exists (select 1 from public.validations v where v.user_id = p_user
                               and v.status = 'valid' and v.day = current_date and v.proof_level > 0)
    when 'defi' then exists (select 1 from public.validations v where v.user_id = p_user
                             and v.status = 'valid' and v.day = current_date)
    when 'expert' then exists (select 1 from public.validations v
                               join public.challenge_templates t on t.id = v.template_id
                               where v.user_id = p_user and v.status = 'valid'
                                 and v.day = current_date and t.level = 'expert')
    when 'scan' then exists (select 1 from public.product_scans s where s.user_id = p_user
                             and s.created_at::date = current_date)
    when 'meilleur_choix' then exists (select 1 from public.product_swaps s where s.user_id = p_user
                                       and s.created_at::date = current_date)
    when 'bravo' then exists (select 1 from public.cheers c where c.user_id = p_user
                              and c.created_at::date = current_date)
    when 'cap' then exists (select 1 from public.habit_checkins k where k.user_id = p_user
                            and k.created_at::date = current_date)
    when 'lancer' then exists (select 1 from public.user_challenges u where u.user_id = p_user
                               and u.created_at::date = current_date)
    else false end
$$;
revoke all on function public.quest_done(uuid, text) from public;

-- Tire les 3 quêtes du jour parmi celles qui ont du sens, une seule fois par jour.
create or replace function public.todays_quests(p_user uuid)
returns text[]
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  q text[];
  me public.profiles;
  h public.habits;
  pool text[] := array[]::text[];
  has_active boolean;
begin
  select quests into q from public.daily_quests where user_id = p_user and day = current_date;
  if found then
    return q;
  end if;
  select * into me from public.profiles where id = p_user;
  select * into h from public.habits where user_id = p_user;
  has_active := exists (select 1 from public.user_challenges where user_id = p_user and status = 'active'
                        and current_date between starts_on and ends_on);

  -- Toujours possibles
  pool := pool || array['scan', 'meilleur_choix'];
  if has_active then
    pool := pool || array['preuve'];
  else
    pool := pool || array['lancer'];
  end if;
  -- Selon le profil
  if exists (select 1 from public.user_challenges u join public.challenge_templates t on t.id = u.template_id
             where u.user_id = p_user and u.status = 'active' and t.level = 'expert') then
    pool := pool || array['expert'];
  end if;
  if h.user_id is not null and exists (
       select 1 from unnest(public.kept_habits(h)) k
       where not exists (select 1 from public.habit_checkins c where c.user_id = p_user and c.habit = k
                         and c.week_start = date_trunc('week', current_date)::date)) then
    pool := pool || array['cap'];
  end if;
  if exists (select 1 from public.validations v where v.company_id = me.company_id and v.user_id <> p_user
             and v.visibility = 'company' and v.status = 'valid' and v.created_at > now() - interval '7 days') then
    pool := pool || array['bravo'];
  end if;

  -- La quête « défi » (preuve, expert ou lancer) est toujours tirée en premier ; les deux autres au hasard du jour.
  select array_agg(x order by md5(p_user::text || current_date || x)) into q
  from unnest(pool) x where x not in ('preuve', 'lancer', 'expert');
  q := array[case when has_active then 'preuve' else 'lancer' end] || q[1:2];
  if 'expert' = any (pool) and has_active and get_byte(decode(md5(p_user::text || current_date), 'hex'), 0) % 2 = 0 then
    q[1] := 'expert';
  end if;

  insert into public.daily_quests (user_id, day, quests) values (p_user, current_date, q)
  on conflict (user_id, day) do nothing;
  return q;
end;
$$;
revoke all on function public.todays_quests(uuid) from public;

create or replace function public.claim_daily_rewards()
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  q text[];
  done jsonb := '{}'::jsonb;
  all_done boolean := true;
  x text;
  ok boolean;
  s record;
  m record;
  gained integer := 0;
  n integer;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;

  q := public.todays_quests(me.id);
  foreach x in array q loop
    ok := public.quest_done(me.id, x);
    done := done || jsonb_build_object(x, ok);
    all_done := all_done and ok;
  end loop;

  if all_done then
    insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
    values (me.id, me.company_id, 'quete', 15, md5(me.id::text || ':quete:' || current_date)::uuid)
    on conflict (user_id, kind, ref_id) do nothing;
    get diagnostics n = row_count;
    gained := gained + n * 15;
  end if;

  select * into s from public.day_streak(me.id);
  for m in select * from (values (3, 10), (7, 25), (14, 50), (30, 100)) as t(days, pts) loop
    if s.streak >= m.days then
      insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
      values (me.id, me.company_id, 'serie', m.pts,
              md5(me.id::text || ':serie:' || m.days || ':' || s.started_on)::uuid)
      on conflict (user_id, kind, ref_id) do nothing;
      get diagnostics n = row_count;
      gained := gained + n * m.pts;
    end if;
  end loop;

  return jsonb_build_object(
    'order', to_jsonb(q),
    'quests', done,
    'quest_done', all_done,
    'streak', s.streak,
    'gained', gained);
end;
$$;
revoke all on function public.claim_daily_rewards() from public;
grant execute on function public.claim_daily_rewards() to authenticated;
-- Pousse · rappels sur le téléphone (notifications Web Push)
--   Chaque appareil qui accepte les rappels enregistre son abonnement push (navigateur → service de push).
--   Une fois par jour, en fin d'après-midi, le serveur demande la liste des personnes à relancer :
--   celles qui ont un abonnement et n'ont encore rien fait aujourd'hui. La notification ne contient
--   aucune donnée : le téléphone vient chercher le texte (« ta série de 4 jours s'arrête ce soir »).

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_sent_on date
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

drop policy if exists "rappels: les miens (lecture)" on public.push_subscriptions;
create policy "rappels: les miens (lecture)" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "rappels: les miens (ajout)" on public.push_subscriptions;
create policy "rappels: les miens (ajout)" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "rappels: les miens (modif)" on public.push_subscriptions;
create policy "rappels: les miens (modif)" on public.push_subscriptions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "rappels: les miens (retrait)" on public.push_subscriptions;
create policy "rappels: les miens (retrait)" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- Clé du cron : seule son empreinte SHA-256 est en base ; le texte clair reste dans Vercel (CRON_SECRET).
-- Aucune politique : personne ne lit cette table, seules les fonctions ci-dessous la consultent.
create table if not exists public.cron_keys (
  name text primary key,
  sha256 text not null
);
alter table public.cron_keys enable row level security;

create or replace function public.cron_key_ok(p_token text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_token is not null and length(p_token) >= 32 and exists (
    select 1 from public.cron_keys k
    where k.name = 'rappels' and k.sha256 = encode(sha256(convert_to(p_token, 'UTF8')), 'hex'))
$$;
revoke all on function public.cron_key_ok(text) from public;

-- Les abonnements à relancer aujourd'hui (une fois par jour au plus), avec la série en cours.
create or replace function public.reminders_due(p_token text)
returns table (endpoint text, streak integer)
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
begin
  if not public.cron_key_ok(p_token) then
    raise exception 'forbidden';
  end if;
  return query
    select s.endpoint, (select d.streak from public.day_streak(s.user_id) d)
    from public.push_subscriptions s
    where (s.last_sent_on is null or s.last_sent_on < current_date)
      and not exists (select 1 from public.active_days(s.user_id) a where a = current_date);
end;
$$;
revoke all on function public.reminders_due(text) from public;
grant execute on function public.reminders_due(text) to anon, authenticated;

-- Après l'envoi : marque les abonnements relancés et retire ceux que le service de push a refusés (404/410).
create or replace function public.reminders_sent(p_token text, p_sent text[], p_gone text[])
returns void
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
begin
  if not public.cron_key_ok(p_token) then
    raise exception 'forbidden';
  end if;
  update public.push_subscriptions set last_sent_on = current_date where endpoint = any (p_sent);
  delete from public.push_subscriptions where endpoint = any (p_gone);
end;
$$;
revoke all on function public.reminders_sent(text, text[], text[]) from public;
grant execute on function public.reminders_sent(text, text[], text[]) to anon, authenticated;

-- Le texte du rappel, lu par le téléphone à la réception (session de la personne).
create or replace function public.my_reminder()
returns jsonb
language plpgsql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  s integer;
  active_today boolean;
begin
  if auth.uid() is null then
    return null;
  end if;
  select d.streak into s from public.day_streak(auth.uid()) d;
  active_today := exists (select 1 from public.active_days(auth.uid()) a where a = current_date);
  return jsonb_build_object('streak', coalesce(s, 0), 'active_today', active_today);
end;
$$;
revoke all on function public.my_reminder() from public;
grant execute on function public.my_reminder() to authenticated;
-- Pousse · plus de jeu
--   1. Défi collectif de la semaine : un objectif commun à toute l'entreprise, +30 pour chaque contributeur.
--   2. Duels entre collègues : même action, 7 jours, preuves obligatoires. Personne ne perd de pousses.
--   3. Jardin à collectionner : calculé à partir de ce que chacun a fait (fonction garden).
--   4. Graine mystère : gagnée en finissant les quêtes du jour, elle révèle un bonus ou une plante rare.
--   5. Quiz du jour : une question par jour, la même pour toute l'entreprise, +5 si c'est juste.

alter table public.points_ledger drop constraint if exists points_ledger_kind_check;
alter table public.points_ledger add constraint points_ledger_kind_check
  check (kind in ('maintien', 'influence', 'temoin', 'quete', 'serie', 'scan', 'collectif', 'duel', 'graine', 'quiz'));

-- 5. Quiz du jour ------------------------------------------------------------------------------

create table if not exists public.quiz_questions (
  id integer primary key,
  question text not null,
  choices text[] not null check (array_length(choices, 1) between 2 and 4),
  answer smallint not null,
  explanation text not null,
  check (answer >= 0 and answer < array_length(choices, 1))
);
-- Personne ne lit la table directement (la bonne réponse y est) : tout passe par today_quiz().
alter table public.quiz_questions enable row level security;

create table if not exists public.quiz_answers (
  user_id uuid not null references public.profiles on delete cascade,
  day date not null,
  question_id integer not null references public.quiz_questions,
  choice smallint not null,
  correct boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.quiz_answers enable row level security;
drop policy if exists "quiz: mes réponses" on public.quiz_answers;
create policy "quiz: mes réponses" on public.quiz_answers
  for select to authenticated using (user_id = auth.uid());

-- La question du jour : la même pour tout le monde, elles tournent dans l'ordre.
create or replace function public.quiz_of_day(d date)
returns integer
language sql stable security definer set search_path = public
as $$
  select id from public.quiz_questions order by id
  offset ((d - date '2026-01-01') % greatest((select count(*) from public.quiz_questions), 1))
  limit 1
$$;
revoke all on function public.quiz_of_day(date) from public;

-- La question (sans la réponse tant qu'on n'a pas répondu), puis la correction et le score des collègues.
create or replace function public.today_quiz()
returns jsonb
language plpgsql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  q public.quiz_questions;
  a public.quiz_answers;
  total integer;
  good integer;
begin
  if auth.uid() is null then
    return null;
  end if;
  select * into q from public.quiz_questions where id = public.quiz_of_day(current_date);
  if not found then
    return null;
  end if;
  select * into a from public.quiz_answers where user_id = auth.uid() and day = current_date;
  if not found then
    return jsonb_build_object('id', q.id, 'question', q.question, 'choices', to_jsonb(q.choices), 'answered', false);
  end if;
  select count(*), count(*) filter (where qa.correct) into total, good
  from public.quiz_answers qa join public.profiles p on p.id = qa.user_id
  where p.company_id = public.my_company_id() and qa.day = current_date;
  return jsonb_build_object(
    'id', q.id, 'question', q.question, 'choices', to_jsonb(q.choices), 'answered', true,
    'choice', a.choice, 'answer', q.answer, 'correct', a.correct, 'explanation', q.explanation,
    'answers', total, 'good', good);
end;
$$;
revoke all on function public.today_quiz() from public;
grant execute on function public.today_quiz() to authenticated;

create or replace function public.answer_quiz(p_choice integer)
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  q public.quiz_questions;
  ok boolean;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;
  select * into q from public.quiz_questions where id = public.quiz_of_day(current_date);
  if not found then
    raise exception 'no_quiz';
  end if;
  if p_choice is null or p_choice < 0 or p_choice >= array_length(q.choices, 1) then
    raise exception 'invalid_choice';
  end if;
  ok := p_choice = q.answer;
  insert into public.quiz_answers (user_id, day, question_id, choice, correct)
  values (me.id, current_date, q.id, p_choice, ok)
  on conflict (user_id, day) do nothing;
  if not found then
    raise exception 'already_answered';
  end if;
  if ok then
    insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
    values (me.id, me.company_id, 'quiz', 5, md5(me.id::text || ':quiz:' || current_date)::uuid)
    on conflict (user_id, kind, ref_id) do nothing;
  end if;
  return public.today_quiz();
end;
$$;
revoke all on function public.answer_quiz(integer) from public;
grant execute on function public.answer_quiz(integer) to authenticated;

-- Le quiz compte pour la série.
create or replace function public.active_days(p_user uuid)
returns setof date
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select v.day from public.validations v where v.user_id = p_user and v.status = 'valid'
  union
  select k.created_at::date from public.habit_checkins k where k.user_id = p_user
  union
  select c.created_at::date from public.cheers c where c.user_id = p_user
  union
  select s.created_at::date from public.product_swaps s where s.user_id = p_user
  union
  select s.created_at::date from public.product_scans s where s.user_id = p_user
  union
  select q.day from public.quiz_answers q where q.user_id = p_user
$$;
revoke all on function public.active_days(uuid) from public;

-- Questions (chiffres cohérents avec ceux de l'application : ADEME, Base Empreinte, SDES, Météo-France).
insert into public.quiz_questions (id, question, choices, answer, explanation) values
(1, 'Un repas avec du bœuf émet environ combien de fois plus qu''un repas végétarien ?',
 array['2 fois plus', '6 fois plus', '20 fois plus', '100 fois plus'], 1,
 'Environ 5 kg de CO₂e pour un repas avec bœuf, contre 0,85 kg pour un repas végétarien (ADEME). C''est le geste alimentaire le plus efficace.'),
(2, 'Pour un Paris–Marseille, le TGV émet combien de fois moins que l''avion, par passager ?',
 array['2 fois moins', '10 fois moins', 'Près de 100 fois moins', 'Autant'], 2,
 'Environ 2 g de CO₂e par km en TGV contre plus de 200 g en avion court-courrier (ADEME). L''électricité française est très peu carbonée.'),
(3, 'Quelle est l''empreinte carbone moyenne d''un Français par an ?',
 array['Environ 2 tonnes', 'Environ 9 tonnes', 'Environ 20 tonnes', 'Environ 50 tonnes'], 1,
 'Environ 9 tonnes de CO₂e par personne et par an, importations comprises (SDES). L''objectif pour 2050 est autour de 2 tonnes.'),
(4, 'Quel est le premier secteur émetteur de gaz à effet de serre en France ?',
 array['L''industrie', 'Les transports', 'Le numérique', 'Les déchets'], 1,
 'Les transports représentent environ un tiers des émissions du territoire, surtout à cause de la voiture (Citepa).'),
(5, 'Dans l''empreinte carbone du numérique en France, quelle part vient de la fabrication des appareils ?',
 array['Environ 10 %', 'Environ 30 %', 'Environ 50 %', 'Près de 80 %'], 3,
 'La fabrication des terminaux (téléphones, ordinateurs, écrans) pèse près de 80 % (ADEME-Arcep). Garder son téléphone plus longtemps est le meilleur geste.'),
(6, 'Baisser le chauffage de 1 °C réduit la consommation de chauffage d''environ…',
 array['1 %', '7 %', '25 %', '50 %'], 1,
 'Environ 7 % d''énergie économisée par degré en moins (ADEME). 19 °C dans les pièces à vivre suffit le plus souvent.'),
(7, 'Quelle part de la nourriture produite dans le monde est perdue ou gaspillée ?',
 array['Environ 5 %', 'Environ un tiers', 'Environ deux tiers', 'Presque rien'], 1,
 'Près d''un tiers de la nourriture produite est perdue ou gaspillée (FAO), avec toutes les émissions de sa production.'),
(8, 'Un aller-retour Paris–New York en avion émet par passager environ…',
 array['100 kg de CO₂e', '500 kg de CO₂e', '1,5 tonne de CO₂e', '10 tonnes de CO₂e'], 2,
 'Environ 1,5 à 2 tonnes, traînées comprises (ADEME) : près d''une année de budget carbone compatible avec l''Accord de Paris.'),
(9, 'Le méthane réchauffe la planète combien de fois plus que le CO₂, sur 100 ans ?',
 array['Autant', 'Environ 2 fois', 'Environ 28 fois', 'Environ 1 000 fois'], 2,
 'Environ 28 fois plus (GIEC). Il vient surtout de l''élevage des ruminants, des décharges et des fuites de gaz.'),
(10, 'Quelle part de la France métropolitaine est couverte de forêt ?',
 array['Environ 5 %', 'Environ 15 %', 'Environ un tiers', 'Plus de la moitié'], 2,
 'Environ 31 % du territoire (IGN), et la surface forestière a presque doublé depuis le milieu du XIXe siècle.'),
(11, 'Depuis 1950, la France a perdu environ quelle part de ses haies ?',
 array['10 %', '30 %', '70 %', 'Aucune'], 2,
 'Environ 70 % des haies ont disparu (rapport CGAAER 2023). Elles abritent oiseaux et insectes et stockent du carbone : on en replante.'),
(12, 'Une pompe à chaleur produit environ combien de kWh de chaleur pour 1 kWh d''électricité ?',
 array['0,5 kWh', '1 kWh', '3 kWh', '20 kWh'], 2,
 'Environ 3 kWh de chaleur pour 1 kWh d''électricité : elle puise le reste dans l''air ou le sol.'),
(13, 'Un smartphone reconditionné plutôt que neuf évite environ quelle part de son impact ?',
 array['10 %', '30 %', '50 %', 'Près de 80 %'], 3,
 'Entre 77 et 91 % d''impact en moins selon l''ADEME (2022), puisqu''on évite la fabrication d''un appareil neuf.'),
(14, 'De combien la France s''est-elle déjà réchauffée depuis le début du XXe siècle ?',
 array['+0,5 °C', '+1 °C', 'Environ +1,7 °C', '+4 °C'], 2,
 'Environ +1,7 °C (Météo-France), un peu plus que la moyenne mondiale : les terres se réchauffent plus vite que les océans.'),
(15, 'Quelle part de l''empreinte carbone d''un Français vient de son alimentation ?',
 array['Environ 5 %', 'Environ un quart', 'Environ la moitié', 'Plus de 80 %'], 1,
 'Environ un quart de l''empreinte (ADEME), dont une grande partie liée à la viande et aux produits laitiers.'),
(16, 'Lequel de ces emballages se recycle à l''infini sans perdre en qualité ?',
 array['Le verre', 'Le carton', 'La bouteille plastique', 'Le papier'], 0,
 'Le verre (comme l''aluminium) se recycle sans fin. Le papier et le carton s''abîment à chaque cycle, le plastique aussi.'),
(17, 'Une ampoule LED consomme combien d''électricité de moins qu''une ampoule à incandescence ?',
 array['10 % de moins', '30 % de moins', 'Environ 80 % de moins', 'Autant'], 2,
 'Environ 80 à 90 % de moins pour la même lumière (ADEME), et elle dure bien plus longtemps.'),
(18, 'Quelle est la première source d''électricité en France ?',
 array['Le gaz', 'Le charbon', 'Le nucléaire', 'L''éolien'], 2,
 'Le nucléaire, autour de deux tiers de la production (RTE), puis l''hydraulique, l''éolien et le solaire : c''est pourquoi le train et la voiture électrique émettent si peu ici.'),
(19, 'Covoiturer à deux plutôt que rouler seul divise les émissions par personne par…',
 array['1,1', '2', '5', '10'], 1,
 'Par deux : la même voiture, partagée. C''est l''un des défis de Pousse.'),
(20, 'Quel vêtement a la plus grosse empreinte carbone à la fabrication ?',
 array['Un tee-shirt en coton', 'Un jean', 'Une paire de chaussettes', 'Une casquette'], 1,
 'Un jean neuf pèse environ 25 kg de CO₂e (ADEME), surtout à cause du coton et de la teinture. L''occasion évite presque tout.'),
(21, 'Que représente l''objectif de 2 tonnes de CO₂e par personne et par an ?',
 array['L''empreinte actuelle d''un Français', 'Le niveau compatible avec l''Accord de Paris en 2050', 'L''empreinte d''un vol Paris–Nice', 'La limite légale en France'], 1,
 'C''est l''ordre de grandeur visé pour 2050 pour tenir l''Accord de Paris : environ 4 fois moins qu''aujourd''hui.'),
(22, 'Un trajet domicile-travail de 10 km en métro ou RER, comparé à la voiture seul, émet environ…',
 array['Autant', '2 fois moins', 'Plus de 10 fois moins', '2 fois plus'], 2,
 'Quelques grammes par km en métro ou RER contre plus de 100 g en voiture thermique (ADEME) : plus de 10 fois moins.')
on conflict (id) do update set
  question = excluded.question, choices = excluded.choices, answer = excluded.answer, explanation = excluded.explanation;

-- 4. Graine mystère -------------------------------------------------------------------------------

create table if not exists public.mystery_seeds (
  user_id uuid not null references public.profiles on delete cascade,
  day date not null,
  opened_at timestamptz,
  reward text,
  points integer not null default 0,
  primary key (user_id, day)
);
alter table public.mystery_seeds enable row level security;
drop policy if exists "graines: les miennes" on public.mystery_seeds;
create policy "graines: les miennes" on public.mystery_seeds
  for select to authenticated using (user_id = auth.uid());

-- Plantes rares obtenues (graines mystère).
create table if not exists public.garden_rares (
  user_id uuid not null references public.profiles on delete cascade,
  plant text not null,
  obtained_at timestamptz not null default now(),
  primary key (user_id, plant)
);
alter table public.garden_rares enable row level security;
drop policy if exists "plantes rares: les miennes" on public.garden_rares;
create policy "plantes rares: les miennes" on public.garden_rares
  for select to authenticated using (user_id = auth.uid());

-- Ouvre la plus ancienne graine : 8 % plante rare (si une reste à trouver), puis +20, +10 ou +5.
create or replace function public.open_seed_roll(p_user uuid, p_roll numeric)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  s public.mystery_seeds;
  comp uuid;
  rare text;
  pts integer := 0;
begin
  select * into s from public.mystery_seeds
  where user_id = p_user and opened_at is null order by day limit 1 for update;
  if not found then
    raise exception 'no_seed';
  end if;
  if p_roll < 0.08 then
    select x into rare from unnest(array['orchidee', 'bonsai', 'edelweiss', 'lotus', 'nenuphar']) x
    where not exists (select 1 from public.garden_rares g where g.user_id = p_user and g.plant = x)
    order by md5(p_user::text || x || s.day) limit 1;
  end if;
  if rare is not null then
    insert into public.garden_rares (user_id, plant) values (p_user, rare);
  else
    pts := case when p_roll < 0.20 then 20 when p_roll < 0.50 then 10 else 5 end;
    select company_id into comp from public.profiles where id = p_user;
    insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
    values (p_user, comp, 'graine', pts, md5(p_user::text || ':graine:' || s.day)::uuid)
    on conflict (user_id, kind, ref_id) do nothing;
  end if;
  update public.mystery_seeds set opened_at = now(), reward = coalesce(rare, 'pousses'), points = pts
  where user_id = p_user and day = s.day;
  return jsonb_build_object('plant', rare, 'points', pts);
end;
$$;
revoke all on function public.open_seed_roll(uuid, numeric) from public;

create or replace function public.open_seed()
returns jsonb
language sql volatile security definer set search_path = public
as $$ select public.open_seed_roll(auth.uid(), random()::numeric) $$;
revoke all on function public.open_seed() from public;
grant execute on function public.open_seed() to authenticated;

-- 1. Défi collectif de la semaine ----------------------------------------------------------------

-- Un thème par semaine, différent de la semaine précédente, décalé d'une entreprise à l'autre.
create or replace function public.weekly_goal_kind(p_company uuid, p_week date)
returns text
language sql immutable
as $$
  select (array['repas', 'trajets', 'scan', 'quiz', 'bravo', 'preuve'])[
    1 + (((p_week - date '2000-01-03') / 7 + get_byte(decode(md5(p_company::text), 'hex'), 0)) % 6)]
$$;

-- Objectif : par participant, avec un plancher pour les petites entreprises (60 % des inscrits actifs en moyenne).
create or replace function public.weekly_goal_target(p_kind text, p_participants integer)
returns integer
language sql immutable
as $$
  select greatest(per * 5, ceil(per * p_participants * 0.6))::integer
  from (select case p_kind when 'scan' then 2 when 'bravo' then 4 else 3 end as per) x
$$;

-- Ce qui compte pour l'objectif, pour toute l'entreprise (p_user null) ou pour une personne.
create or replace function public.goal_count(p_kind text, p_company uuid, p_user uuid, p_from date, p_to date)
returns integer
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select (case p_kind
    when 'repas' then (select coalesce(sum(v.units), 0) from public.validations v
                       where v.company_id = p_company and (p_user is null or v.user_id = p_user) and v.status = 'valid'
                         and v.template_id in ('vege', 'vegetalien') and v.day between p_from and p_to)
    when 'trajets' then (select coalesce(sum(v.units), 0) from public.validations v
                         where v.company_id = p_company and (p_user is null or v.user_id = p_user) and v.status = 'valid'
                           and v.template_id in ('velo', 'transports', 'covoiturage') and v.day between p_from and p_to)
    when 'preuve' then (select count(*) from public.validations v
                        where v.company_id = p_company and (p_user is null or v.user_id = p_user) and v.status = 'valid'
                          and v.proof_level > 0 and v.day between p_from and p_to)
    when 'scan' then (select count(*) from public.product_swaps s
                      where s.company_id = p_company and (p_user is null or s.user_id = p_user)
                        and s.created_at::date between p_from and p_to)
    when 'quiz' then (select count(*) from public.quiz_answers q join public.profiles p on p.id = q.user_id
                      where p.company_id = p_company and (p_user is null or q.user_id = p_user)
                        and q.correct and q.day between p_from and p_to)
    when 'bravo' then (select count(*) from public.cheers c join public.profiles p on p.id = c.user_id
                       where p.company_id = p_company and (p_user is null or c.user_id = p_user)
                         and c.created_at::date between p_from and p_to)
    else 0 end)::integer
$$;
revoke all on function public.goal_count(text, uuid, uuid, date, date) from public;

-- L'objectif de la semaine et sa progression ; crédite +30 aux contributeurs quand il est atteint
-- (cette semaine, ou la semaine dernière si on ne s'était pas reconnecté depuis).
create or replace function public.my_weekly_goal()
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  n integer;
  wk date := date_trunc('week', current_date)::date;
  prev date := date_trunc('week', current_date)::date - 7;
  k text;
  tgt integer;
  prog integer;
  mine integer;
  pk text;
  p_reached boolean;
  r integer;
  gained integer := 0;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;
  select count(*) into n from public.profiles where company_id = me.company_id;

  -- Semaine dernière : récompense encore due si on ne s'était pas reconnecté depuis.
  pk := public.weekly_goal_kind(me.company_id, prev);
  p_reached := public.goal_count(pk, me.company_id, null, prev, prev + 6) >= public.weekly_goal_target(pk, n);
  if p_reached and public.goal_count(pk, me.company_id, me.id, prev, prev + 6) > 0 then
    insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
    values (me.id, me.company_id, 'collectif', 30, md5(me.id::text || ':collectif:' || prev)::uuid)
    on conflict (user_id, kind, ref_id) do nothing;
    get diagnostics r = row_count;
    gained := gained + r * 30;
  end if;

  -- Semaine en cours.
  k := public.weekly_goal_kind(me.company_id, wk);
  tgt := public.weekly_goal_target(k, n);
  prog := public.goal_count(k, me.company_id, null, wk, wk + 6);
  mine := public.goal_count(k, me.company_id, me.id, wk, wk + 6);
  if prog >= tgt and mine > 0 then
    insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
    values (me.id, me.company_id, 'collectif', 30, md5(me.id::text || ':collectif:' || wk)::uuid)
    on conflict (user_id, kind, ref_id) do nothing;
    get diagnostics r = row_count;
    gained := gained + r * 30;
  end if;

  return jsonb_build_object(
    'kind', k, 'target', tgt, 'progress', prog, 'mine', mine, 'ends_on', wk + 6,
    'reached', prog >= tgt, 'gained', gained,
    'last_week', jsonb_build_object('kind', pk, 'reached', p_reached));
end;
$$;
revoke all on function public.my_weekly_goal() from public;
grant execute on function public.my_weekly_goal() to authenticated;

-- 2. Duels ---------------------------------------------------------------------------------------

create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies,
  challenger uuid not null references public.profiles on delete cascade,
  opponent uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('trajets', 'repas', 'scan', 'defis')),
  target integer not null default 3 check (target between 1 and 10),
  status text not null default 'pending' check (status in ('pending', 'active', 'declined', 'done', 'expired')),
  winner text check (winner in ('both', 'challenger', 'opponent', 'none')),
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  check (challenger <> opponent)
);
create index if not exists duels_challenger_idx on public.duels (challenger, status);
create index if not exists duels_opponent_idx on public.duels (opponent, status);
alter table public.duels enable row level security;
drop policy if exists "duels: les miens" on public.duels;
create policy "duels: les miens" on public.duels
  for select to authenticated using (challenger = auth.uid() or opponent = auth.uid());

-- Ce qui compte dans un duel : seulement des actions vérifiables (avec preuve, ou scanner).
create or replace function public.duel_count(p_kind text, p_user uuid, p_from date, p_to date)
returns integer
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select (case p_kind
    when 'trajets' then (select coalesce(sum(v.units), 0) from public.validations v
                         where v.user_id = p_user and v.status = 'valid' and v.proof_level > 0
                           and v.template_id in ('velo', 'transports', 'covoiturage') and v.day between p_from and p_to)
    when 'repas' then (select coalesce(sum(v.units), 0) from public.validations v
                       where v.user_id = p_user and v.status = 'valid' and v.proof_level > 0
                         and v.template_id in ('vege', 'vegetalien') and v.day between p_from and p_to)
    when 'defis' then (select count(*) from public.validations v
                       where v.user_id = p_user and v.status = 'valid' and v.proof_level > 0
                         and v.day between p_from and p_to)
    when 'scan' then (select count(*) from public.product_swaps s
                      where s.user_id = p_user and s.created_at::date between p_from and p_to)
    else 0 end)::integer
$$;
revoke all on function public.duel_count(text, uuid, date, date) from public;

create or replace function public.challenge_duel(p_opponent uuid, p_kind text, p_target integer default 3)
returns public.duels
language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles;
  d public.duels;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;
  if p_opponent = me.id
     or not exists (select 1 from public.profiles where id = p_opponent and company_id = me.company_id) then
    raise exception 'invalid_opponent';
  end if;
  if p_kind not in ('trajets', 'repas', 'scan', 'defis') or p_target is null or p_target not between 1 and 10 then
    raise exception 'invalid_duel';
  end if;
  if (select count(*) from public.duels where me.id in (challenger, opponent) and status in ('pending', 'active')) >= 3 then
    raise exception 'too_many_duels';
  end if;
  if exists (select 1 from public.duels
             where status in ('pending', 'active')
               and ((challenger = me.id and opponent = p_opponent) or (challenger = p_opponent and opponent = me.id))) then
    raise exception 'duel_exists';
  end if;
  insert into public.duels (company_id, challenger, opponent, kind, target)
  values (me.company_id, me.id, p_opponent, p_kind, p_target)
  returning * into d;
  return d;
end;
$$;
revoke all on function public.challenge_duel(uuid, text, integer) from public;
grant execute on function public.challenge_duel(uuid, text, integer) to authenticated;

create or replace function public.answer_duel(p_duel uuid, p_accept boolean)
returns public.duels
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  d public.duels;
begin
  select * into d from public.duels where id = p_duel and opponent = auth.uid() and status = 'pending' for update;
  if not found then
    raise exception 'duel_not_found';
  end if;
  if p_accept then
    if (select count(*) from public.duels where auth.uid() in (challenger, opponent) and status = 'active') >= 3 then
      raise exception 'too_many_duels';
    end if;
    update public.duels set status = 'active', starts_on = current_date, ends_on = current_date + 6
    where id = d.id returning * into d;
  else
    update public.duels set status = 'declined' where id = d.id returning * into d;
  end if;
  return d;
end;
$$;
revoke all on function public.answer_duel(uuid, boolean) from public;
grant execute on function public.answer_duel(uuid, boolean) to authenticated;

-- Clôt les duels terminés (les deux ont atteint l'objectif, ou les 7 jours sont passés) et crédite :
-- les deux ont réussi → +25 chacun ; un seul → +40 pour lui. Invitations sans réponse : expirées après 3 jours.
create or replace function public.settle_duels(p_user uuid)
returns void
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  d public.duels;
  a integer;
  b integer;
  w text;
begin
  update public.duels set status = 'expired'
  where status = 'pending' and p_user in (challenger, opponent) and created_at < now() - interval '3 days';

  for d in select * from public.duels where status = 'active' and p_user in (challenger, opponent) for update loop
    a := public.duel_count(d.kind, d.challenger, d.starts_on, least(d.ends_on, current_date));
    b := public.duel_count(d.kind, d.opponent, d.starts_on, least(d.ends_on, current_date));
    if (a >= d.target and b >= d.target) or current_date > d.ends_on then
      w := case when a >= d.target and b >= d.target then 'both'
                when a >= d.target then 'challenger'
                when b >= d.target then 'opponent'
                else 'none' end;
      update public.duels set status = 'done', winner = w where id = d.id;
      if w in ('both', 'challenger') then
        insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
        values (d.challenger, d.company_id, 'duel', case when w = 'both' then 25 else 40 end, d.id)
        on conflict (user_id, kind, ref_id) do nothing;
      end if;
      if w in ('both', 'opponent') then
        insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
        values (d.opponent, d.company_id, 'duel', case when w = 'both' then 25 else 40 end, d.id)
        on conflict (user_id, kind, ref_id) do nothing;
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function public.settle_duels(uuid) from public;

-- Mes duels (en attente, en cours, terminés depuis moins de 14 jours), avec la progression des deux côtés.
create or replace function public.my_duels()
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return '[]'::jsonb;
  end if;
  perform public.settle_duels(me);
  return coalesce((
    select jsonb_agg(x order by x.rank, x.created_at desc)
    from (
      select d.id, d.kind, d.target, d.status, d.winner, d.starts_on, d.ends_on, d.created_at,
             case when d.challenger = me then 'challenger' else 'opponent' end as role,
             o.id as other_id, o.display_name as other_name,
             case when d.starts_on is null then 0
                  else public.duel_count(d.kind, me, d.starts_on, least(d.ends_on, current_date)) end as mine,
             case when d.starts_on is null then 0
                  else public.duel_count(d.kind, o.id, d.starts_on, least(d.ends_on, current_date)) end as theirs,
             case d.status when 'pending' then 0 when 'active' then 1 else 2 end as rank
      from public.duels d
      join public.profiles o on o.id = case when d.challenger = me then d.opponent else d.challenger end
      where me in (d.challenger, d.opponent)
        and (d.status in ('pending', 'active') or d.created_at > now() - interval '14 days')
    ) x), '[]'::jsonb);
end;
$$;
revoke all on function public.my_duels() from public;
grant execute on function public.my_duels() to authenticated;

-- 3. Jardin ---------------------------------------------------------------------------------------

-- Ce qui fait pousser le jardin d'une personne (moi ou un collègue de la même entreprise).
create or replace function public.garden(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  who public.profiles;
begin
  select * into who from public.profiles where id = p_user and company_id = public.my_company_id();
  if not found then
    raise exception 'not_found';
  end if;
  return jsonb_build_object(
    'name', who.display_name,
    'counts', jsonb_build_object(
      'transport', (select coalesce(sum(v.units), 0) from public.validations v join public.challenge_templates t on t.id = v.template_id
                    where v.user_id = p_user and v.status = 'valid' and t.category = 'transport'),
      'alimentation', (select coalesce(sum(v.units), 0) from public.validations v join public.challenge_templates t on t.id = v.template_id
                       where v.user_id = p_user and v.status = 'valid' and t.category = 'alimentation'),
      'consommation', (select coalesce(sum(v.units), 0) from public.validations v join public.challenge_templates t on t.id = v.template_id
                       where v.user_id = p_user and v.status = 'valid' and t.category = 'consommation'),
      'logement', (select coalesce(sum(v.units), 0) from public.validations v join public.challenge_templates t on t.id = v.template_id
                   where v.user_id = p_user and v.status = 'valid' and t.category = 'logement'),
      'scan', (select count(*) from public.product_swaps where user_id = p_user),
      'cap', (select count(*) from public.habit_checkins where user_id = p_user),
      'bravo', (select count(*) from public.cheers where user_id = p_user),
      'quiz', (select count(*) from public.quiz_answers where user_id = p_user and correct)),
    'exploits', jsonb_build_object(
      'serie30', exists (select 1 from public.points_ledger where user_id = p_user and kind = 'serie' and points = 100),
      'expert', exists (select 1 from public.user_challenges u join public.challenge_templates t on t.id = u.template_id
                        where u.user_id = p_user and u.status = 'done' and t.level = 'expert'),
      'collectif', exists (select 1 from public.points_ledger where user_id = p_user and kind = 'collectif'),
      'duel', exists (select 1 from public.points_ledger where user_id = p_user and kind = 'duel'),
      'inspire', exists (select 1 from public.points_ledger where user_id = p_user and kind = 'influence')),
    'rares', coalesce((select jsonb_agg(plant order by obtained_at) from public.garden_rares where user_id = p_user), '[]'::jsonb));
end;
$$;
revoke all on function public.garden(uuid) from public;
grant execute on function public.garden(uuid) to authenticated;

-- Quêtes : le quiz rejoint la pioche ; la graine mystère et les duels se règlent au passage -------------

create or replace function public.quest_done(p_user uuid, p_quest text)
returns boolean
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select case p_quest
    when 'preuve' then exists (select 1 from public.validations v where v.user_id = p_user
                               and v.status = 'valid' and v.day = current_date and v.proof_level > 0)
    when 'defi' then exists (select 1 from public.validations v where v.user_id = p_user
                             and v.status = 'valid' and v.day = current_date)
    when 'expert' then exists (select 1 from public.validations v
                               join public.challenge_templates t on t.id = v.template_id
                               where v.user_id = p_user and v.status = 'valid'
                                 and v.day = current_date and t.level = 'expert')
    when 'scan' then exists (select 1 from public.product_scans s where s.user_id = p_user
                             and s.created_at::date = current_date)
    when 'meilleur_choix' then exists (select 1 from public.product_swaps s where s.user_id = p_user
                                       and s.created_at::date = current_date)
    when 'bravo' then exists (select 1 from public.cheers c where c.user_id = p_user
                              and c.created_at::date = current_date)
    when 'cap' then exists (select 1 from public.habit_checkins k where k.user_id = p_user
                            and k.created_at::date = current_date)
    when 'lancer' then exists (select 1 from public.user_challenges u where u.user_id = p_user
                               and u.created_at::date = current_date)
    when 'quiz' then exists (select 1 from public.quiz_answers q where q.user_id = p_user and q.day = current_date)
    else false end
$$;
revoke all on function public.quest_done(uuid, text) from public;

create or replace function public.todays_quests(p_user uuid)
returns text[]
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  q text[];
  me public.profiles;
  h public.habits;
  pool text[] := array[]::text[];
  has_active boolean;
begin
  select quests into q from public.daily_quests where user_id = p_user and day = current_date;
  if found then
    return q;
  end if;
  select * into me from public.profiles where id = p_user;
  select * into h from public.habits where user_id = p_user;
  has_active := exists (select 1 from public.user_challenges where user_id = p_user and status = 'active'
                        and current_date between starts_on and ends_on);

  -- Toujours possibles
  pool := pool || array['scan', 'meilleur_choix'];
  if exists (select 1 from public.quiz_questions) then
    pool := pool || array['quiz'];
  end if;
  if has_active then
    pool := pool || array['preuve'];
  else
    pool := pool || array['lancer'];
  end if;
  -- Selon le profil
  if exists (select 1 from public.user_challenges u join public.challenge_templates t on t.id = u.template_id
             where u.user_id = p_user and u.status = 'active' and t.level = 'expert') then
    pool := pool || array['expert'];
  end if;
  if h.user_id is not null and exists (
       select 1 from unnest(public.kept_habits(h)) k
       where not exists (select 1 from public.habit_checkins c where c.user_id = p_user and c.habit = k
                         and c.week_start = date_trunc('week', current_date)::date)) then
    pool := pool || array['cap'];
  end if;
  if exists (select 1 from public.validations v where v.company_id = me.company_id and v.user_id <> p_user
             and v.visibility = 'company' and v.status = 'valid' and v.created_at > now() - interval '7 days') then
    pool := pool || array['bravo'];
  end if;

  -- La quête « défi » (preuve, expert ou lancer) est toujours tirée en premier ; les deux autres au hasard du jour.
  select array_agg(x order by md5(p_user::text || current_date || x)) into q
  from unnest(pool) x where x not in ('preuve', 'lancer', 'expert');
  q := array[case when has_active then 'preuve' else 'lancer' end] || q[1:2];
  if 'expert' = any (pool) and has_active and get_byte(decode(md5(p_user::text || current_date), 'hex'), 0) % 2 = 0 then
    q[1] := 'expert';
  end if;

  insert into public.daily_quests (user_id, day, quests) values (p_user, current_date, q)
  on conflict (user_id, day) do nothing;
  return q;
end;
$$;
revoke all on function public.todays_quests(uuid) from public;

create or replace function public.claim_daily_rewards()
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  q text[];
  done jsonb := '{}'::jsonb;
  all_done boolean := true;
  x text;
  ok boolean;
  s record;
  m record;
  gained integer := 0;
  n integer;
  seed jsonb;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;

  perform public.settle_duels(me.id);

  q := public.todays_quests(me.id);
  foreach x in array q loop
    ok := public.quest_done(me.id, x);
    done := done || jsonb_build_object(x, ok);
    all_done := all_done and ok;
  end loop;

  if all_done then
    insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
    values (me.id, me.company_id, 'quete', 15, md5(me.id::text || ':quete:' || current_date)::uuid)
    on conflict (user_id, kind, ref_id) do nothing;
    get diagnostics n = row_count;
    gained := gained + n * 15;
    -- La graine mystère du jour.
    insert into public.mystery_seeds (user_id, day) values (me.id, current_date)
    on conflict (user_id, day) do nothing;
  end if;

  select * into s from public.day_streak(me.id);
  for m in select * from (values (3, 10), (7, 25), (14, 50), (30, 100)) as t(days, pts) loop
    if s.streak >= m.days then
      insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
      values (me.id, me.company_id, 'serie', m.pts,
              md5(me.id::text || ':serie:' || m.days || ':' || s.started_on)::uuid)
      on conflict (user_id, kind, ref_id) do nothing;
      get diagnostics n = row_count;
      gained := gained + n * m.pts;
    end if;
  end loop;

  select case
           when exists (select 1 from public.mystery_seeds where user_id = me.id and opened_at is null)
             then jsonb_build_object('state', 'ready')
           when ms.day is not null
             then jsonb_build_object('state', 'opened', 'plant', case when ms.reward = 'pousses' then null else ms.reward end,
                                     'points', ms.points)
           else null end
  into seed
  from (select 1) one
  left join public.mystery_seeds ms on ms.user_id = me.id and ms.day = current_date;

  return jsonb_build_object(
    'order', to_jsonb(q),
    'quests', done,
    'quest_done', all_done,
    'streak', s.streak,
    'gained', gained,
    'seed', seed);
end;
$$;
revoke all on function public.claim_daily_rewards() from public;
grant execute on function public.claim_daily_rewards() to authenticated;
