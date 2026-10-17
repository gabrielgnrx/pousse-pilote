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
