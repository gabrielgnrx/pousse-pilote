-- Pousse · télétravail, eau du robinet, anti-gaspi et nature
--   1. Télétravail : un aller-retour domicile-travail évité (2 × le trajet du bilan). Un jour de
--      télétravail exclut les trajets domicile-travail le même jour, et inversement.
--   2. Eau du robinet : l'eau en bouteille déclarée dans le bilan, à 0,32 kg par litre (Agribalyse).
--      Nouvelle question du bilan : habits.bottled_water_l_day.
--   3. Anti-gaspi et gestes « Nature » (compost, ramassage, sciences participatives, plantation) :
--      0 kg mesurable, des pousses, une fois par jour. Nouvelle espèce du jardin, nouveau défi d'équipe.

alter table public.habits add column if not exists bottled_water_l_day numeric not null default 0
  check (bottled_water_l_day between 0 and 3);

alter table public.challenge_templates drop constraint if exists challenge_templates_category_check;
alter table public.challenge_templates add constraint challenge_templates_category_check
  check (category in ('transport', 'alimentation', 'consommation', 'logement', 'quotidien', 'nature'));

insert into public.challenge_templates (id, category, title, points_per_unit, cap_group, cap_units, cap_window_days, level) values
  ('teletravail', 'transport',    'Télétravail au lieu du trajet',                      10, 'teletravail', 1, 1, 'standard'),
  ('eau_robinet', 'alimentation', 'Eau du robinet au lieu d''eau en bouteille',         5, 'eau',         1, 1, 'standard'),
  ('antigaspi',   'alimentation', 'Repas anti-gaspi (restes ou panier d''invendus)',    3, 'antigaspi',   1, 1, 'standard'),
  ('compost',     'nature',       'Déchets alimentaires au compost',                     3, 'compost',     1, 1, 'standard'),
  ('ramassage',   'nature',       'Ramassage de déchets dans la nature ou la rue',       5, 'ramassage',   1, 1, 'standard'),
  ('sciences',    'nature',       'Comptage pour un programme de sciences participatives', 5, 'sciences', 1, 1, 'standard'),
  ('plantation',  'nature',       'Plantation, nichoir ou coin de nature aménagé',       5, 'plantation',  1, 1, 'standard')
on conflict (id) do update set
  category = excluded.category, title = excluded.title, points_per_unit = excluded.points_per_unit,
  cap_group = excluded.cap_group, cap_units = excluded.cap_units,
  cap_window_days = excluded.cap_window_days, level = excluded.level;

-- Un même jour ne peut pas être à la fois en télétravail et sur la route du bureau.
create or replace function public.check_teletravail()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status <> 'valid' then
    return new;
  end if;
  if new.template_id = 'teletravail' and exists (
       select 1 from public.validations v join public.challenge_templates t on t.id = v.template_id
       where v.user_id = new.user_id and v.day = new.day and v.status = 'valid' and t.cap_group = 'domicile_travail') then
    raise exception 'teletravail_conflict';
  end if;
  if new.template_id <> 'teletravail'
     and (select cap_group from public.challenge_templates where id = new.template_id) = 'domicile_travail'
     and exists (select 1 from public.validations v
                 where v.user_id = new.user_id and v.day = new.day and v.status = 'valid' and v.template_id = 'teletravail') then
    raise exception 'teletravail_conflict';
  end if;
  return new;
end;
$$;
drop trigger if exists validations_teletravail on public.validations;
create trigger validations_teletravail before insert on public.validations
  for each row execute function public.check_teletravail();

create or replace function public.team_kind_per_member(p_kind text)
returns integer
language sql immutable
as $$
  select case p_kind
    when 'repas' then 2
    when 'actions' then 4
    when 'preuve' then 1
    when 'quiz' then 2
    when 'scan' then 1
    when 'bravo' then 3
    when 'nature' then 1
    else null end
$$;

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
    -- 0017 : télétravail (aller-retour évité) et eau du robinet (eau en bouteille du jour évitée).
    when 'teletravail' then
      if has_commute and commute_factor > 0 then
        return 2 * h.commute_km * commute_factor;
      end if;
    when 'eau_robinet' then
      if coalesce(h.bottled_water_l_day, 0) > 0 then
        return h.bottled_water_l_day * 0.32;
      end if;
    else
      null;
  end case;
  return 0;
end;
$$;

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
      'nature', (select coalesce(sum(v.units), 0) from public.validations v join public.challenge_templates t on t.id = v.template_id
                 where v.user_id = p_user and v.status = 'valid' and t.category = 'nature'),
      'scan', (select count(*) from public.product_swaps where user_id = p_user),
      'cap', (select count(*) from public.habit_checkins where user_id = p_user),
      'bravo', (select count(*) from public.cheers where user_id = p_user),
      'quiz', (select count(*) from (select day from public.quiz_answers where user_id = p_user and correct group by day having count(*) >= 7) x)),
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

create or replace function public.team_kind_count(p_kind text, p_team uuid, p_user uuid, p_from date, p_to date)
returns integer
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  with members as (
    select id from public.profiles where team_id = p_team and (p_user is null or id = p_user)
  )
  select (case p_kind
    when 'repas' then (select coalesce(sum(v.units), 0) from public.validations v
                       where v.user_id in (select id from members) and v.status = 'valid'
                         and v.template_id in ('vege', 'vegetalien') and v.day between p_from and p_to)
    when 'actions' then (select coalesce(sum(v.units), 0) from public.validations v
                         where v.user_id in (select id from members) and v.status = 'valid'
                           and v.day between p_from and p_to)
    when 'preuve' then (select count(*) from public.validations v
                        where v.user_id in (select id from members) and v.status = 'valid'
                          and v.proof_level > 0 and v.day between p_from and p_to)
    when 'quiz' then (select count(*) from (select q.user_id, q.day from public.quiz_answers q
                      where q.user_id in (select id from members) and q.correct and q.day between p_from and p_to
                      group by q.user_id, q.day having count(*) >= 7) x)
    when 'scan' then (select count(*) from public.product_swaps s
                      where s.user_id in (select id from members) and s.created_at::date between p_from and p_to)
    when 'bravo' then (select count(*) from public.cheers c
                       where c.user_id in (select id from members) and c.created_at::date between p_from and p_to)
    when 'nature' then (select coalesce(sum(v.units), 0) from public.validations v
                        join public.challenge_templates t on t.id = v.template_id
                        where v.user_id in (select id from members) and v.status = 'valid'
                          and t.category = 'nature' and v.day between p_from and p_to)
    else 0 end)::integer
$$;

create or replace function public.settle_team_week(p_team uuid, p_week date, p_now timestamp)
returns public.team_weeks
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  w public.team_weeks;
  pool text[] := array['repas', 'actions', 'preuve', 'quiz', 'scan', 'bravo', 'nature'];
  previous text;
  members integer;
  done integer;
  t_company uuid;
  label text;
begin
  select company_id into t_company from public.teams where id = p_team;
  select * into w from public.team_weeks where team_id = p_team and week_start = p_week;
  if not found and p_week < date_trunc('week', p_now)::date then
    return null;  -- semaine passée jamais ouverte : rien à régler
  end if;
  if not found then
    select chosen into previous from public.team_weeks where team_id = p_team and week_start = p_week - 7;
    insert into public.team_weeks (team_id, week_start, options)
    select p_team, p_week, array(
      select k from unnest(pool) k
      where k is distinct from previous
      order by md5(p_team::text || p_week::text || k)
      limit 3)
    on conflict do nothing;
    select * into w from public.team_weeks where team_id = p_team and week_start = p_week;
  end if;

  -- Le vote se termine le lundi à 14 h (heure de Paris).
  if w.chosen is null and p_now >= p_week + time '14:00' then
    select o into w.chosen
    from unnest(w.options) with ordinality as x(o, i)
    order by (select count(*) from public.team_week_votes b
              where b.team_id = p_team and b.week_start = p_week and b.choice = x.o) desc, x.i
    limit 1;
    select count(*) into members from public.profiles where team_id = p_team;
    w.target := greatest(1, public.team_kind_per_member(w.chosen) * members);
    update public.team_weeks set chosen = w.chosen, target = w.target
    where team_id = p_team and week_start = p_week and chosen is null;
    if found and p_now < p_week + 7 then
      label := case w.chosen
        when 'repas' then 'repas végé'
        when 'actions' then 'actions enregistrées'
        when 'preuve' then 'actions publiées avec photo'
        when 'quiz' then 'quiz réussis (7/10 ou plus)'
        when 'scan' then 'meilleurs choix au scanner'
        when 'bravo' then 'bravos dans le fil'
        when 'nature' then 'actions nature (compost, ramassage, comptage, plantation)' end;
      insert into public.team_messages (company_id, team_id, user_id, body, created_at)
      values (t_company, p_team, null,
              'Le vote est clos ! Défi de la semaine : ' || w.target || ' ' || label
              || ' pour toute l''équipe. Objectif atteint = +30 pousses pour chaque contributeur.',
              (p_week + time '14:00') at time zone 'Europe/Paris');
    end if;
  end if;

  -- Objectif atteint : +30 à chaque membre qui a contribué (une seule fois par semaine).
  if w.chosen is not null and w.target is not null then
    done := public.team_kind_count(w.chosen, p_team, null, p_week, p_week + 6);
    if done >= w.target then
      insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
      select p.id, p.company_id, 'equipe', 30, md5(p_team::text || ':equipe:' || p_week)::uuid
      from public.profiles p
      where p.team_id = p_team
        and public.team_kind_count(w.chosen, p_team, p.id, p_week, p_week + 6) > 0
      on conflict (user_id, kind, ref_id) do nothing;
    end if;
  end if;
  return w;
end;
$$;

revoke all on function public.garden(uuid) from public;
grant execute on function public.garden(uuid) to authenticated;
revoke all on function public.team_kind_count(text, uuid, uuid, date, date) from public;
revoke all on function public.settle_team_week(uuid, date, timestamp) from public;
