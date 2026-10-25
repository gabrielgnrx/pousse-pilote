-- 0028 — Le calcul officiel lit la table des facteurs, et l'action du + accepte une quantité (v2).
--
-- 1. unit_kg lit emission_factors (ef) au lieu de valeurs recopiées : mêmes règles, mêmes résultats.
--    Les hypothèses de calcul (12 000 km pour un long-courrier, 7 % par degré…) restent écrites ici,
--    comme dans src/lib/co2 : ce ne sont pas des facteurs d'émission.
-- 2. avoided_kg : le CO₂ évité pour une quantité saisie (km ou nombre d'unités). Les trajets
--    domicile-travail sont plafonnés aux km déclarés dans le bilan ; le train compte les km saisis.
-- 3. log_action prend une quantité (facultative, bornée par action_types) ; log_action_slug sert la
--    saisie en langage naturel : un slug du catalogue et une quantité, rien d'autre.
-- 4. Plus de publication automatique dans le fil : publier est toujours proposé, jamais imposé.

-- 1. unit_kg ------------------------------------------------------------------------------------------
create or replace function public.unit_kg(p_template text, p_variant text, h public.habits)
returns numeric
language plpgsql stable
set search_path = public
as $$
declare
  car_thermique constant numeric := public.ef('voiture_thermique');
  car_electrique constant numeric := public.ef('voiture_electrique');
  covoiturage constant numeric := public.ef('covoiturage_2');
  transit constant numeric := (public.ef('metro') + public.ef('rer')) / 2;  -- moyenne métro / RER
  avion_court constant numeric := public.ef('avion_court');
  avion_long constant numeric := public.ef('avion_moyen_long');
  tgv constant numeric := public.ef('tgv');
  boeuf constant numeric := public.ef('repas_boeuf');
  vegetarien constant numeric := public.ef('repas_vegetarien');
  vegetalien constant numeric := public.ef('repas_vegetalien');
  autre_viande constant numeric := (public.ef('repas_porc') + public.ef('repas_poulet') + public.ef('repas_poisson')) / 3;
  -- Hypothèses de calcul (voir PLAN.md, § 4).
  long_courrier_km constant numeric := 12000;   -- aller-retour long-courrier
  vacances_train_km constant numeric := 2000;   -- trajet en train qui le remplace
  baisse_par_degre constant numeric := 0.07;
  semaines_de_chauffe constant numeric := 30;
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
          when 'tshirt' then public.ef('tshirt_neuf')
          when 'chemise' then public.ef('chemise_neuve')
          when 'chaussures' then public.ef('chaussures_cuir_neuves')
          when 'jean' then public.ef('jean_neuf')
          when 'pull' then public.ef('pull_laine_neuf')
          when 'manteau' then public.ef('manteau_neuf')
          else 0 end;
      end if;
    when 'chauffage' then
      if h.heating_kg_year > 0 then
        return h.heating_kg_year * baisse_par_degre / semaines_de_chauffe;
      end if;
    when 'vegetalien' then
      if veg_meals > 0 then
        return vegetarien - vegetalien;
      end if;
    when 'vacances_train' then
      if h.long_flights_year > 0 then
        return long_courrier_km * avion_long - vacances_train_km * tgv;
      end if;
    when 'reparation' then
      if p_variant = 'smartphone' and h.buys_new_phone then
        return public.ef('smartphone_neuf');
      elsif p_variant = 'ordinateur' and h.new_devices_year > 0 then
        return public.ef('ordinateur_portable_neuf');
      end if;
    when 'teletravail' then
      if has_commute and commute_factor > 0 then
        return 2 * h.commute_km * commute_factor;
      end if;
    when 'eau_robinet' then
      if coalesce(h.bottled_water_l_day, 0) > 0 then
        return h.bottled_water_l_day * (public.ef('eau_bouteille') - public.ef('eau_robinet'));
      end if;
    when 'appli_occasion' then
      return public.unit_kg(case when p_variant in ('smartphone', 'ordinateur') then 'reparation' else 'occasion' end,
                            p_variant, h);
    else
      null;
  end case;
  return 0;
end;
$$;

-- 2. Quantités --------------------------------------------------------------------------------------
-- La quantité retenue pour le calcul : trajets domicile-travail plafonnés aux km déclarés, train en km
-- saisis (ou distance de la variante), et pour le reste le nombre d'unités (1 par défaut).
create or replace function public.effective_quantity(p_template text, p_variant text, p_quantity numeric, h public.habits)
returns numeric
language sql stable
set search_path = public
as $$
  select case
    when p_template in ('velo', 'transports', 'covoiturage') then
      least(coalesce(p_quantity, h.commute_km), h.commute_km)
    when p_template = 'train' and p_variant in ('300', '500', '800') then p_variant::numeric
    else coalesce(p_quantity, 1)
  end
$$;

-- Le CO₂ évité par une action entière. Calcul déterministe, aucune valeur ne vient du client ni de l'IA.
create or replace function public.avoided_kg(p_template text, p_variant text, p_quantity numeric, h public.habits)
returns numeric
language plpgsql stable
set search_path = public
as $$
declare
  q numeric := public.effective_quantity(p_template, p_variant, p_quantity, h);
begin
  if q is null or q <= 0 then
    return 0;
  end if;
  -- Trajet domicile-travail : la règle d'unit_kg pour le trajet déclaré, au prorata des km parcourus.
  if p_template in ('velo', 'transports', 'covoiturage') then
    if h.commute_km <= 0 then
      return 0;
    end if;
    return public.unit_kg(p_template, p_variant, h) * q / h.commute_km;
  end if;
  -- Train au lieu de l'avion : avion court-courrier moins TGV, sur les km saisis.
  if p_template = 'train' and p_variant = 'km' then
    if h.short_flights_year <= 0 then
      return 0;
    end if;
    return q * (public.ef('avion_court') - public.ef('tgv'));
  end if;
  return public.unit_kg(p_template, p_variant, h) * q;
end;
$$;

-- La variante « km » du train rejoint le plafond du train (2 par jour, justificatif obligatoire).

-- 3. log_action avec quantité --------------------------------------------------------------------------
drop function if exists public.log_action(text, text, text);
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

-- Saisie en langage naturel : un slug du catalogue et une quantité. La base retrouve l'action,
-- contrôle les bornes, calcule le CO₂ et les pousses : l'IA n'a fourni que la classification.
create or replace function public.log_action_slug(p_action text, p_quantity numeric default null, p_receipt text default null)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  a public.action_types;
begin
  select * into a from public.action_types where slug = p_action and active;
  if not found then
    raise exception 'unknown_action';
  end if;
  return public.log_action(a.template_id, a.variant, p_receipt, p_quantity);
end;
$$;
revoke all on function public.log_action_slug(text, numeric, text) from public;
grant execute on function public.log_action_slug(text, numeric, text) to authenticated;

-- 4. Le fil : publier reste un choix, action par action ------------------------------------------------
drop trigger if exists validations_share_to_feed on public.validations;
drop function if exists public.share_to_feed();
