-- 0025 — Moins de triche, un bilan stable (22 octobre 2026).
--
-- 1. Un défi ne se modifie plus après sa création : un salarié peut seulement l'annuler.
--    (Avant, on pouvait passer l'objectif à 1 et allonger la durée pour toucher le bonus à volonté.)
-- 2. Plafonds de la semaine calés sur le bilan : trajets domicile-travail ≤ 2 × jours de bureau
--    déclarés, télétravail ≤ 5 jours, achats d'occasion ≤ 3.
-- 3. Le bilan se refait une fois tous les 30 jours au plus (corrections libres pendant 24 h après
--    le premier). Les habitudes ne changent qu'avec un nouveau bilan.
-- 4. « Garder le cap » disparaît : une bonne habitude rapporte déjà ses pousses à chaque action.
-- 5. Fonctions de l'ancien parcours (validation avec photo ou témoin) fermées : elles permettaient
--    encore de contourner les justificatifs et les plafonds en appelant la base directement.
-- 6. « Un collègue relève ton défi » rapporte de nouveau +15 (une fois par personne et par action),
--    et la quête « Lance un défi » ne se valide plus avec un défi aussitôt annulé.

-- 1. Défis verrouillés.
create or replace function public.guard_challenge_update()
returns trigger
language plpgsql
as $$
begin
  -- Les fonctions de la base (security definer) passent ; un salarié, lui, peut seulement annuler.
  if current_user <> 'authenticated' then
    return new;
  end if;
  if old.status = 'active' and new.status = 'abandoned'
     and (new.user_id, new.company_id, new.template_id, new.variant, new.target, new.starts_on, new.ends_on, new.inspired_by)
         is not distinct from
         (old.user_id, old.company_id, old.template_id, old.variant, old.target, old.starts_on, old.ends_on, old.inspired_by) then
    return new;
  end if;
  raise exception 'challenge_locked';
end;
$$;
drop trigger if exists user_challenges_guard on public.user_challenges;
create trigger user_challenges_guard
  before update on public.user_challenges
  for each row execute function public.guard_challenge_update();

-- 2. Plafonds de la semaine.
create or replace function public.weekly_cap(p_template text, h public.habits)
returns integer
language sql immutable
as $$
  select case
    when p_template in ('velo', 'transports', 'covoiturage') then 2 * greatest(coalesce(h.commute_days, 0), 1)
    when p_template = 'teletravail' then 5
    when p_template = 'occasion' then 3
    else null end
$$;

-- 3. Bilan : une fois tous les 30 jours.
create or replace function public.check_bilan_frequency()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  first_at timestamptz;
  last_at timestamptz;
begin
  if auth.uid() is null then
    return new;
  end if;
  select min(created_at), max(created_at) into first_at, last_at
  from public.footprints where user_id = new.user_id;
  if last_at is null or now() < first_at + interval '24 hours' then
    return new;
  end if;
  if last_at > now() - interval '30 days' then
    raise exception 'bilan_locked';
  end if;
  return new;
end;
$$;
revoke all on function public.check_bilan_frequency() from public;
drop trigger if exists footprints_frequency on public.footprints;
create trigger footprints_frequency
  before insert on public.footprints
  for each row execute function public.check_bilan_frequency();

-- Les habitudes ne changent qu'avec un bilan tout juste enregistré.
create or replace function public.check_habits_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if not exists (select 1 from public.footprints
                 where user_id = new.user_id and created_at > now() - interval '10 minutes') then
    raise exception 'bilan_locked';
  end if;
  return new;
end;
$$;
revoke all on function public.check_habits_change() from public;
drop trigger if exists habits_change on public.habits;
create trigger habits_change
  before insert or update on public.habits
  for each row execute function public.check_habits_change();

-- 4 et 5. Fonctions retirées de l'appli.
revoke execute on function public.keep_habit(text) from authenticated;
revoke execute on function public.validate_challenge_day(uuid, integer, text, uuid, text, text) from authenticated;
revoke execute on function public.respond_witness(uuid, boolean) from authenticated;
-- Les quêtes du jour déjà tirées ne demandent plus « Garde le cap ».
update public.daily_quests set quests = array_replace(quests, 'cap', 'defi') where 'cap' = any (quests);

-- Quêtes du jour sans « Garder le cap ».
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

-- 6. « Lance un défi » : un défi gardé.
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
                               and u.created_at::date = current_date and u.status <> 'abandoned')
    when 'quiz' then (select count(*) from public.quiz_answers q where q.user_id = p_user and q.day = current_date
                      and q.question_id = any (public.quiz_day_ids(current_date))) >= 10
    else false end
$$;
revoke all on function public.goal_count(text, uuid, uuid, date, date) from public;
revoke all on function public.team_kind_count(text, uuid, uuid, date, date) from public;
revoke all on function public.quest_done(uuid, text) from public;
revoke all on function public.garden(uuid) from public;
grant execute on function public.garden(uuid) to authenticated;

-- 2 et 6. Les plafonds de la semaine et l'influence dans log_action.
create or replace function public.log_action(p_template text, p_variant text default 'base', p_receipt text default null)
returns jsonb
language plpgsql security definer
set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  t public.challenge_templates;
  h public.habits;
  c public.user_challenges;
  d public.duels;
  w public.team_weeks;
  wk date := date_trunc('week', current_date)::date;
  per_unit numeric := 0;
  used integer;
  pts integer;
  mult numeric := 1;
  boost text := null;
  team_before integer;
  v public.validations;
  done_units integer;
  challenge jsonb := null;
  duel jsonb := null;
  wcap integer;
  used_week integer;
  inspirer uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;

  select * into t from public.challenge_templates where id = p_template and active;
  if not found then
    raise exception 'unknown_action';
  end if;
  p_variant := coalesce(nullif(trim(p_variant), ''), 'base');
  if t.requires_receipt and p_receipt is null then
    raise exception 'receipt_required';
  end if;
  if p_receipt is not null and split_part(p_receipt, '/', 1) <> me.id::text then
    raise exception 'invalid_photo';
  end if;

  -- Plafond partagé du groupe, comme pour les défis.
  select coalesce(sum(val.units), 0) into used
  from public.validations val
  join public.challenge_templates tt on tt.id = val.template_id
  where val.user_id = me.id
    and val.status = 'valid'
    and tt.cap_group = t.cap_group
    and val.day > current_date - t.cap_window_days;
  if used >= t.cap_units then
    raise exception 'cap_reached';
  end if;

  -- Le CO₂ vient du bilan : 0 kg si l'action ne remplace aucune habitude déclarée.
  select * into h from public.habits where user_id = me.id;
  if found then
    per_unit := public.unit_kg(t.id, p_variant, h);
  end if;

  -- Plafond de la semaine, calé sur le bilan : pas plus de trajets que de jours de bureau déclarés,
  -- 5 jours de télétravail, 3 achats d'occasion.
  wcap := public.weekly_cap(t.id, h);
  if wcap is not null then
    select coalesce(sum(val.units), 0) into used_week
    from public.validations val
    join public.challenge_templates tt on tt.id = val.template_id
    where val.user_id = me.id and val.status = 'valid' and tt.cap_group = t.cap_group and val.day >= wk;
    if used_week >= wcap then
      raise exception 'week_cap_reached';
    end if;
  end if;

  -- Une bonne habitude rapporte autant qu'un changement : vélo, transports, repas végé… gardent leurs
  -- pousses même à 0 kg (la personne le fait déjà). Les autres actions à 0 kg (petits gestes, ou une
  -- action qui ne remplace rien) : 5 pousses par jour au plus, tous confondus. Un achat via une appli,
  -- avec son reçu, n'est pas plafonné.
  pts := t.points_per_unit;
  if round(per_unit, 3) = 0 and not public.is_habit_action(t.id) and t.id not like 'appli\_%' then
    pts := least(pts, greatest(0, 5 - (
      select coalesce(sum(z.points), 0) from public.validations z
      where z.user_id = me.id and z.status = 'valid' and z.day = current_date and z.kg = 0
        and not public.is_habit_action(z.template_id) and z.template_id not like 'appli\_%')));
  end if;

  -- Un défi perso en cours sur la même action ? L'action y compte.
  select * into c from public.user_challenges
  where user_id = me.id and template_id = t.id and variant = p_variant
    and status = 'active' and current_date between starts_on and ends_on
  order by created_at
  limit 1
  for update;

  -- Défi relevé depuis la publication d'un collègue : +15 pour lui, une seule fois par personne et par action.
  if c.id is not null and c.inspired_by is not null then
    select user_id into inspirer from public.validations
    where id = c.inspired_by and company_id = me.company_id and user_id <> me.id;
    if inspirer is not null then
      insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
      values (inspirer, me.company_id, 'influence', 15, md5(inspirer::text || ':' || me.id::text || ':' || t.id)::uuid)
      on conflict (user_id, kind, ref_id) do nothing;
    end if;
  end if;

  -- Le défi d'équipe de la semaine, pour voir si l'action le fait avancer.
  if me.team_id is not null then
    select * into w from public.team_weeks where team_id = me.team_id and week_start = wk and chosen is not null;
    if found then
      team_before := public.team_kind_count(w.chosen, me.team_id, me.id, wk, wk + 6);
    end if;
  end if;

  insert into public.validations (
    challenge_id, user_id, company_id, team_id, template_id, variant, day, units,
    kg, points, proof_photo_path, receipt_path, witness_id, witness_status, proof_level, caption, visibility)
  values (
    c.id, me.id, me.company_id, me.team_id, t.id, p_variant, current_date, 1,
    round(per_unit, 3), pts, null, p_receipt, null, 'none', case when p_receipt is null then 0 else 1 end, null, 'private')
  returning * into v;

  -- À plusieurs, ça rapporte plus : ×2 pour le défi d'équipe, sinon ×1,5 pour un duel en cours.
  if team_before is not null and public.team_kind_count(w.chosen, me.team_id, me.id, wk, wk + 6) > team_before then
    mult := 2;
    boost := 'equipe';
  end if;
  select * into d from public.duels
  where me.id in (challenger, opponent) and status = 'active'
    and ((kind = 'action' and template_id = t.id)
      or (kind = 'trajets' and t.id in ('velo', 'transports', 'covoiturage'))
      or (kind = 'repas' and t.id in ('vege', 'vegetalien'))
      or kind = 'defis')
    and current_date between starts_on and ends_on
  order by created_at
  limit 1;
  if found then
    if boost is null then
      mult := 1.5;
      boost := 'duel';
    end if;
    duel := jsonb_build_object(
      'other_name', (select display_name from public.profiles
                     where id = case when d.challenger = me.id then d.opponent else d.challenger end),
      'mine', public.duel_progress(d, me.id),
      'theirs', public.duel_progress(d, case when d.challenger = me.id then d.opponent else d.challenger end),
      'target', d.target,
      'ends_on', d.ends_on,
      'stakes', d.stakes);
  end if;
  if mult > 1 and pts > 0 then
    update public.validations set points = round(pts * mult)::integer where id = v.id returning * into v;
  end if;

  if c.id is not null then
    select coalesce(sum(units), 0) into done_units
    from public.validations where challenge_id = c.id and status = 'valid';
    if done_units >= c.target then
      update public.user_challenges set status = 'done' where id = c.id;
    end if;
    challenge := jsonb_build_object(
      'id', c.id,
      'target', c.target,
      'done', done_units,
      'starts_on', c.starts_on,
      'ends_on', c.ends_on,
      'days', (select coalesce(jsonb_agg(distinct dd.day), '[]'::jsonb)
               from public.validations dd where dd.challenge_id = c.id and dd.status = 'valid'));
  end if;

  return jsonb_build_object(
    'id', v.id,
    'template_id', v.template_id,
    'variant', v.variant,
    'kg', v.kg,
    'points', v.points,
    'base_points', pts,
    'multiplier', mult,
    'boost', boost,
    'duel', duel,
    'receipt', p_receipt is not null,
    'challenge', challenge,
    'month_count', (select count(*) from public.validations m
                    where m.user_id = me.id and m.status = 'valid' and m.template_id = t.id
                      and m.day >= date_trunc('month', current_date)::date),
    'month_kg', (select coalesce(sum(m.kg), 0) from public.validations m
                 where m.user_id = me.id and m.status = 'valid' and m.template_id = t.id
                   and m.day >= date_trunc('month', current_date)::date));
end;
$$;
revoke all on function public.log_action(text, text, text) from public;
grant execute on function public.log_action(text, text, text) to authenticated;
