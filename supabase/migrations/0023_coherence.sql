-- 0023 — Cohérence des règles (21 octobre 2026).
--
-- 1. Duels : toutes les actions enregistrées comptent, avec ou sans photo, comme partout ailleurs.
--    Les duels « trajets », « repas » et « défis » (lancés depuis le fil) ne comptaient que les
--    actions publiées avec une photo : un duel pouvait rester à 0 sans qu'on comprenne pourquoi.
-- 2. Ces mêmes duels font valoir le ×1,5 sur les actions qui y comptent, comme les duels sur une action.
-- 3. Le défi collectif de l'entreprise (chaque semaine, +30) disparaît de l'appli : l'exploit
--    « Baobab » du jardin s'obtient désormais avec un défi d'équipe réussi.

-- 1. Comptage des duels.
create or replace function public.duel_count(p_kind text, p_user uuid, p_from date, p_to date)
returns integer
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select (case p_kind
    when 'trajets' then (select coalesce(sum(v.units), 0) from public.validations v
                         where v.user_id = p_user and v.status = 'valid'
                           and v.template_id in ('velo', 'transports', 'covoiturage') and v.day between p_from and p_to)
    when 'repas' then (select coalesce(sum(v.units), 0) from public.validations v
                       where v.user_id = p_user and v.status = 'valid'
                         and v.template_id in ('vege', 'vegetalien') and v.day between p_from and p_to)
    when 'defis' then (select count(*) from public.validations v
                       where v.user_id = p_user and v.status = 'valid'
                         and v.day between p_from and p_to)
    when 'scan' then (select count(*) from public.product_swaps s
                      where s.user_id = p_user and s.created_at::date between p_from and p_to)
    else 0 end)::integer
$$;
revoke all on function public.duel_count(text, uuid, date, date) from public;

-- 2. Le ×1,5 pour tous les duels en cours.
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

  -- Gestes à 0 kg : 5 pousses par jour au plus, tous confondus. Un achat avec reçu n'est pas plafonné.
  pts := t.points_per_unit;
  if round(per_unit, 3) = 0 and not t.requires_receipt then
    pts := least(pts, greatest(0, 5 - (
      select coalesce(sum(z.points), 0) from public.validations z
      join public.challenge_templates zt on zt.id = z.template_id
      where z.user_id = me.id and z.status = 'valid' and z.day = current_date and z.kg = 0
        and not zt.requires_receipt)));
  end if;

  -- Un défi perso en cours sur la même action ? L'action y compte.
  select * into c from public.user_challenges
  where user_id = me.id and template_id = t.id and variant = p_variant
    and status = 'active' and current_date between starts_on and ends_on
  order by created_at
  limit 1
  for update;

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

-- 3. L'exploit Baobab.
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
      'collectif', exists (select 1 from public.points_ledger where user_id = p_user and kind in ('collectif', 'equipe')),
      'duel', exists (select 1 from public.points_ledger where user_id = p_user and kind = 'duel'),
      'inspire', exists (select 1 from public.points_ledger where user_id = p_user and kind = 'influence')),
    'rares', coalesce((select jsonb_agg(plant order by obtained_at) from public.garden_rares where user_id = p_user), '[]'::jsonb));
end;
$$;
