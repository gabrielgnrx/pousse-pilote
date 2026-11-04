-- Clarté du jeu (audit du 04/11/2026), décisions de Gabriel :
--
-- 1. Bonus gros leviers : chaque action garde ses pousses de base (une bonne habitude rapporte autant
--    qu'un changement), plus +5 au-delà de 1 kg de CO₂ évité et +10 au-delà de 3 kg. Le CO₂ affiché
--    compte donc aussi dans le jeu. Même règle que co2Bonus() dans src/lib/co2/bonus.ts.
-- 2. On ne se félicite pas soi-même : un bravo sur sa propre publication n'est plus possible, et les
--    anciens ne comptent plus (défi d'équipe « bravos », coquelicot de l'île, quêtes, série).

-- 2. Bravos : seulement sur la publication d'un collègue.
delete from public.cheers c
using public.validations v
where v.id = c.validation_id and v.user_id = c.user_id;

drop policy if exists "cheers: ajouter" on public.cheers;
create policy "cheers: ajouter" on public.cheers
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.validations v
                where v.id = cheers.validation_id and v.visibility = 'company' and v.user_id <> auth.uid())
  );

-- 1. Bonus gros leviers dans le calcul officiel des pousses.
create or replace function public.log_action(p_template text, p_variant text default 'base', p_receipt text default null,
                                             p_quantity numeric default null)
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
  bonus integer := 0;
  -- v2 : quantité saisie (km ou nombre d'unités) et unités comptées dans les plafonds.
  a public.action_types;
  v_units integer := 1;
  v_quantity numeric;
  v_capped boolean := false;
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

  -- Quantité : bornée par le catalogue. Une action « count » compte autant d'unités que la quantité
  -- (2 repas = 2 unités), une action « distance » compte une seule unité (un trajet).
  select * into a from public.action_types where template_id = t.id and variant = p_variant and active;
  if p_quantity is not null then
    -- Les variantes des raccourcis (train 300, 500 ou 800 km) ont une quantité fixe.
    if not found then
      raise exception 'quantity_not_allowed';
    end if;
    if p_quantity < a.min_quantity or p_quantity > a.max_quantity then
      raise exception 'quantity_out_of_range';
    end if;
    if a.kind = 'count' then
      if p_quantity <> trunc(p_quantity) then
        raise exception 'quantity_out_of_range';
      end if;
      v_units := p_quantity::integer;
    end if;
  elsif t.id = 'train' and p_variant = 'km' then
    raise exception 'quantity_required';
  end if;
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
  if used + v_units > t.cap_units then
    raise exception 'cap_reached';
  end if;

  -- Le CO₂ vient du bilan : 0 kg si l'action ne remplace aucune habitude déclarée.
  -- per_unit est ici le CO₂ de l'action entière (toutes ses unités), calculé par avoided_kg.
  select * into h from public.habits where user_id = me.id;
  if found then
    per_unit := public.avoided_kg(t.id, p_variant, p_quantity, h);
    v_quantity := public.effective_quantity(t.id, p_variant, p_quantity, h);
    v_capped := p_quantity is not null and v_quantity < p_quantity;
  end if;

  -- Plafond de la semaine, calé sur le bilan : pas plus de trajets que de jours de bureau déclarés,
  -- 5 jours de télétravail, 3 achats d'occasion.
  wcap := public.weekly_cap(t.id, h);
  if wcap is not null then
    select coalesce(sum(val.units), 0) into used_week
    from public.validations val
    join public.challenge_templates tt on tt.id = val.template_id
    where val.user_id = me.id and val.status = 'valid' and tt.cap_group = t.cap_group and val.day >= wk;
    if used_week + v_units > wcap then
      raise exception 'week_cap_reached';
    end if;
  end if;

  -- Une bonne habitude rapporte autant qu'un changement : vélo, transports, repas végé… gardent leurs
  -- pousses même à 0 kg (la personne le fait déjà). Les autres actions à 0 kg (petits gestes, ou une
  -- action qui ne remplace rien) : 5 pousses par jour au plus, tous confondus. Un achat via une appli,
  -- avec son reçu, n'est pas plafonné.
  pts := t.points_per_unit * v_units;
  if round(per_unit, 3) = 0 and not public.is_habit_action(t.id) and t.id not like 'appli\_%' then
    pts := least(pts, greatest(0, 5 - (
      select coalesce(sum(z.points), 0) from public.validations z
      where z.user_id = me.id and z.status = 'valid' and z.day = current_date and z.kg = 0
        and not public.is_habit_action(z.template_id) and z.template_id not like 'appli\_%')));
  end if;

  -- Bonus gros leviers (04/11/2026) : +5 au-delà de 1 kg de CO₂ évité, +10 au-delà de 3 kg. Une bonne
  -- habitude déjà acquise garde ses pousses de base (équité), le bonus récompense le CO₂ réellement évité.
  bonus := case when round(per_unit, 3) >= 3 then 10 when round(per_unit, 3) >= 1 then 5 else 0 end;
  pts := pts + bonus;

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
    c.id, me.id, me.company_id, me.team_id, t.id, p_variant, current_date, v_units,
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
    'bonus', bonus,
    'multiplier', mult,
    'boost', boost,
    'duel', duel,
    'receipt', p_receipt is not null,
    'units', v_units,
    'quantity', v_quantity,
    'capped', v_capped,
    'challenge', challenge,
    'month_count', (select count(*) from public.validations m
                    where m.user_id = me.id and m.status = 'valid' and m.template_id = t.id
                      and m.day >= date_trunc('month', current_date)::date),
    'month_kg', (select coalesce(sum(m.kg), 0) from public.validations m
                 where m.user_id = me.id and m.status = 'valid' and m.template_id = t.id
                   and m.day >= date_trunc('month', current_date)::date));
end;
$$;
revoke all on function public.log_action(text, text, text, numeric) from public;
grant execute on function public.log_action(text, text, text, numeric) to authenticated;
