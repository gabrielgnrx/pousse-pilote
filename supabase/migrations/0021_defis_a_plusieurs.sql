-- Pousse · des actions perso, des défis à plusieurs, des achats via des applis durables
--   1. Une action (bouton +) rapporte plus quand elle compte dans un défi à plusieurs :
--      ×1,5 dans un duel en cours, ×2 si elle fait avancer le défi d'équipe de la semaine.
--   2. Bonus de défi réussi : seul +20, duel +40 (ou +30 chacun à deux), équipe +50 par contributeur.
--   3. On peut proposer un défi d'équipe au vote du lundi suivant.
--   4. Achats via une appli durable (occasion, anti-gaspi) : 30 pousses, reçu obligatoire (privé).

-- 1. Registre et catalogue ------------------------------------------------------------------------

alter table public.points_ledger drop constraint if exists points_ledger_kind_check;
alter table public.points_ledger add constraint points_ledger_kind_check
  check (kind in ('maintien', 'influence', 'temoin', 'quete', 'serie', 'scan', 'collectif', 'duel', 'graine', 'quiz',
                  'equipe', 'penalite', 'defi'));

alter table public.challenge_templates add column if not exists requires_receipt boolean not null default false;

insert into public.challenge_templates (id, category, title, points_per_unit, cap_group, cap_units, cap_window_days, level, requires_receipt) values
  ('appli_occasion',  'consommation', 'Achat d''occasion sur une appli (Vinted, Leboncoin, Back Market…)', 30, 'appli_occasion',  2, 1, 'standard', true),
  ('appli_antigaspi', 'alimentation', 'Panier anti-gaspi via une appli (Too Good To Go, Phenix…)',         30, 'appli_antigaspi', 1, 1, 'standard', true)
on conflict (id) do update set
  category = excluded.category, title = excluded.title, points_per_unit = excluded.points_per_unit,
  cap_group = excluded.cap_group, cap_units = excluded.cap_units, cap_window_days = excluded.cap_window_days,
  level = excluded.level, requires_receipt = excluded.requires_receipt;

-- Le reçu est obligatoire pour ces achats, quel que soit le chemin d'enregistrement (action ou défi).
create or replace function public.check_receipt()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if exists (select 1 from public.challenge_templates t where t.id = new.template_id and t.requires_receipt) then
    if new.proof_photo_path is null then
      raise exception 'receipt_required';
    end if;
    if split_part(new.proof_photo_path, '/', 1) <> new.user_id::text then
      raise exception 'invalid_photo';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists validations_receipt on public.validations;
create trigger validations_receipt
  before insert or update of proof_photo_path on public.validations
  for each row execute function public.check_receipt();


-- unit_kg : achats via appli
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
    -- 0021 : achat d'occasion via une appli, même calcul que l'occasion ou la réparation.
    when 'appli_occasion' then
      return public.unit_kg(case when p_variant in ('smartphone', 'ordinateur') then 'reparation' else 'occasion' end,
                            p_variant, h);
    else
      null;
  end case;
  return 0;
end;
$$;


-- 2. Enregistrer une action : multiplicateur duel ou équipe, reçu pour les achats via appli --------

drop function if exists public.log_action(text, text);
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
    kg, points, proof_photo_path, witness_id, witness_status, proof_level, caption, visibility)
  values (
    c.id, me.id, me.company_id, me.team_id, t.id, p_variant, current_date, 1,
    round(per_unit, 3), pts, p_receipt, null, 'none', case when p_receipt is null then 0 else 1 end, null, 'private')
  returning * into v;

  -- À plusieurs, ça rapporte plus : ×2 pour le défi d'équipe, sinon ×1,5 pour un duel en cours.
  if team_before is not null and public.team_kind_count(w.chosen, me.team_id, me.id, wk, wk + 6) > team_before then
    mult := 2;
    boost := 'equipe';
  end if;
  select * into d from public.duels
  where me.id in (challenger, opponent) and status = 'active' and kind = 'action' and template_id = t.id
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

-- 3. Défi perso réussi : +20 (un défi lancé en duel a son propre bonus) -----------------------------

create or replace function public.challenge_done_bonus()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'done' and old.status is distinct from 'done'
     and not exists (select 1 from public.duels d where d.challenge_id = new.id) then
    insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
    values (new.user_id, new.company_id, 'defi', 20, new.id)
    on conflict (user_id, kind, ref_id) do nothing;
    perform public.notify(new.user_id, 'defi_reussi', new.id::text,
      'Défi réussi : +20 pousses',
      'Tu as atteint ton objectif. En duel ou en équipe, le même défi rapporte plus.', '/defis');
  end if;
  return new;
end;
$$;
revoke all on function public.challenge_done_bonus() from public;
drop trigger if exists user_challenges_done_bonus on public.user_challenges;
create trigger user_challenges_done_bonus
  after update of status on public.user_challenges
  for each row execute function public.challenge_done_bonus();

-- 4. Proposer un défi d'équipe pour la semaine prochaine -------------------------------------------

create table if not exists public.team_week_proposals (
  team_id uuid not null references public.teams on delete cascade,
  week_start date not null,
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null,
  created_at timestamptz not null default now(),
  primary key (team_id, week_start, user_id)
);
alter table public.team_week_proposals enable row level security;
drop policy if exists "propositions: mon équipe" on public.team_week_proposals;
create policy "propositions: mon équipe" on public.team_week_proposals
  for select to authenticated
  using (team_id = (select p.team_id from public.profiles p where p.id = auth.uid()));

create or replace function public.propose_team_challenge(p_kind text)
returns date
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  nxt date := date_trunc('week', current_date)::date + 7;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found or me.team_id is null then
    raise exception 'no_team';
  end if;
  if p_kind not in ('repas', 'actions', 'preuve', 'quiz', 'scan', 'bravo', 'nature') then
    raise exception 'unknown_kind';
  end if;
  insert into public.team_week_proposals (team_id, week_start, user_id, kind)
  values (me.team_id, nxt, me.id, p_kind)
  on conflict (team_id, week_start, user_id) do update set kind = excluded.kind, created_at = now();
  return nxt;
end;
$$;
revoke all on function public.propose_team_challenge(text) from public;
grant execute on function public.propose_team_challenge(text) to authenticated;

-- 5. Bonus revus : équipe +50, duel réussi à deux +30 chacun ---------------------------------------

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
    -- Les défis proposés par l'équipe d'abord (les plus demandés), complétés au hasard.
    insert into public.team_weeks (team_id, week_start, options)
    select p_team, p_week, array(
      select k from (
        select k,
               (select count(*) from public.team_week_proposals pr
                where pr.team_id = p_team and pr.week_start = p_week and pr.kind = k) as votes
        from unnest(pool) k
      ) x
      where x.votes > 0 or k is distinct from previous
      order by x.votes desc, md5(p_team::text || p_week::text || k)
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
              || ' pour toute l''équipe. Objectif atteint = +50 pousses pour chaque contributeur, et chaque action qui y compte rapporte double.',
              (p_week + time '14:00') at time zone 'Europe/Paris');
    end if;
  end if;

  -- Objectif atteint : +50 à chaque membre qui a contribué (une seule fois par semaine).
  if w.chosen is not null and w.target is not null then
    done := public.team_kind_count(w.chosen, p_team, null, p_week, p_week + 6);
    if done >= w.target then
      insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
      select p.id, p.company_id, 'equipe', 50, md5(p_team::text || ':equipe:' || p_week)::uuid
      from public.profiles p
      where p.team_id = p_team
        and public.team_kind_count(w.chosen, p_team, p.id, p_week, p_week + 6) > 0
      on conflict (user_id, kind, ref_id) do nothing;
    end if;
  end if;
  return w;
end;
$$;
revoke all on function public.settle_team_week(uuid, date, timestamp) from public;

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
  for d in select * from public.duels
           where status = 'pending' and p_user in (challenger, opponent) and created_at < now() - interval '3 days'
           for update loop
    update public.duels set status = 'expired' where id = d.id;
  end loop;

  for d in select * from public.duels where status = 'active' and p_user in (challenger, opponent) for update loop
    a := public.duel_progress(d, d.challenger);
    b := public.duel_progress(d, d.opponent);
    if (a >= d.target and b >= d.target) or current_date > d.ends_on then
      w := case when a >= d.target and b >= d.target then 'both'
                when a >= d.target then 'challenger'
                when b >= d.target then 'opponent'
                else 'none' end;
      update public.duels set status = 'done', winner = w where id = d.id;
      if w in ('both', 'challenger') then
        insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
        values (d.challenger, d.company_id, 'duel', case when w = 'both' then 30 else 40 end, d.id)
        on conflict (user_id, kind, ref_id) do nothing;
      elsif d.stakes then
        perform public.apply_penalty(d.challenger, d.company_id, 10, md5(d.id::text || ':echec:' || d.challenger)::uuid);
      end if;
      if w in ('both', 'opponent') then
        insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
        values (d.opponent, d.company_id, 'duel', case when w = 'both' then 30 else 40 end, d.id)
        on conflict (user_id, kind, ref_id) do nothing;
      elsif d.stakes then
        perform public.apply_penalty(d.opponent, d.company_id, 10, md5(d.id::text || ':echec:' || d.opponent)::uuid);
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function public.settle_duels(uuid) from public;

create or replace function public.duel_alerts()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  c_name text;
  o_name text;
begin
  select display_name into c_name from public.profiles where id = new.challenger;
  select display_name into o_name from public.profiles where id = new.opponent;
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      perform public.notify(new.opponent, 'duel_invite', new.id::text,
        c_name || ' te défie en duel',
        case when new.stakes then 'Tu as 3 jours pour répondre. Mise : 10 pousses, perdues seulement si tu acceptes et échoues.'
             else 'Tu as 3 jours pour répondre.' end,
        '/duels');
    end if;
    return new;
  end if;
  if new.status is not distinct from old.status then
    return new;
  end if;
  if old.status = 'pending' and new.status = 'active' then
    perform public.notify(new.challenger, 'duel_accepte', new.id::text,
      o_name || ' accepte ton duel', 'C''est parti jusqu''au ' || to_char(new.ends_on, 'DD/MM') || '.', '/duels');
  elsif old.status = 'pending' and new.status = 'declined' then
    perform public.notify(new.challenger, 'duel_refuse', new.id::text,
      o_name || ' refuse ton duel', 'Lance un autre duel, ou continue ton défi en solo.', '/duels');
  elsif old.status = 'pending' and new.status = 'expired' then
    perform public.notify(new.challenger, 'duel_expire', new.id::text,
      o_name || ' n''a pas répondu', 'Ton invitation en duel a expiré.', '/duels');
    perform public.notify(new.opponent, 'duel_expire', new.id::text,
      'Invitation en duel expirée',
      'Tu n''as pas répondu à ' || c_name || '. Ça ne te coûte rien.',
      '/duels');
  elsif new.status = 'done' then
    perform public.notify(new.challenger, 'duel_fin', new.id::text,
      case new.winner when 'both' then 'Duel réussi à deux contre ' || o_name
                      when 'challenger' then 'Duel gagné contre ' || o_name
                      else 'Duel perdu contre ' || o_name end,
      case new.winner when 'both' then '+30 pousses chacun.'
                      when 'challenger' then '+40 pousses.'
                      else case when new.stakes then 'Objectif manqué : tu perds ta mise de 10 pousses.' else 'Objectif manqué cette fois.' end end,
      '/duels');
    perform public.notify(new.opponent, 'duel_fin', new.id::text,
      case new.winner when 'both' then 'Duel réussi à deux contre ' || c_name
                      when 'opponent' then 'Duel gagné contre ' || c_name
                      else 'Duel perdu contre ' || c_name end,
      case new.winner when 'both' then '+30 pousses chacun.'
                      when 'opponent' then '+40 pousses.'
                      else case when new.stakes then 'Objectif manqué : tu perds ta mise de 10 pousses.' else 'Objectif manqué cette fois.' end end,
      '/duels');
  end if;
  return new;
end;
$$;
revoke all on function public.duel_alerts() from public;

create or replace function public.tick_at(p_now timestamp)
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  wk date := date_trunc('week', p_now)::date;
  today date := p_now::date;
  u uuid;
  t record;
  w public.team_weeks;
  r record;
  n_duels integer := 0;
  n_teams integer := 0;
begin
  -- Duels : invitations expirées, duels terminés (avec bonus et pénalités).
  for u in select distinct x from public.duels d, unnest(array[d.challenger, d.opponent]) x
           where d.status in ('pending', 'active') loop
    perform public.settle_duels(u);
    n_duels := n_duels + 1;
  end loop;
  -- Relance : plus que 24 h pour répondre.
  for r in select d.id, d.opponent, d.stakes, p.display_name
           from public.duels d join public.profiles p on p.id = d.challenger
           where d.status = 'pending' and d.created_at < now() - interval '2 days' loop
    perform public.notify(r.opponent, 'duel_relance', r.id::text,
      'Plus que 24 h pour le duel de ' || r.display_name,
      case when r.stakes then 'Accepte ou refuse : sans réponse, −10 pousses.' else 'Accepte ou refuse avant demain.' end,
      '/duels');
  end loop;

  -- Défi de la semaine de chaque équipe : ouverture du vote, clôture à 14 h, bonus de la semaine passée.
  for t in select tm.id from public.teams tm where exists (select 1 from public.profiles p where p.team_id = tm.id) loop
    perform public.settle_team_week(t.id, wk - 7, p_now);
    w := public.settle_team_week(t.id, wk, p_now);
    n_teams := n_teams + 1;
    if w.chosen is null and p_now >= wk + time '09:00' and p_now < wk + time '14:00' then
      insert into public.alerts (user_id, kind, ref, title, body, url)
      select p.id, 'vote_ouvert', wk::text, 'Le vote du défi de la semaine est ouvert',
             'Choisis le défi de ton équipe avant 14 h, directement dans le chat.', '/equipes'
      from public.profiles p where p.team_id = t.id
      on conflict (user_id, kind, ref) do nothing;
    elsif w.chosen is not null and today = wk then
      insert into public.alerts (user_id, kind, ref, title, body, url)
      select p.id, 'vote_resultat', wk::text, 'Défi de la semaine : ' || public.team_kind_label(w.chosen),
             'Objectif : ' || w.target || ' pour toute l''équipe. Chaque action qui y compte rapporte double, +50 si c''est réussi.', '/fil'
      from public.profiles p where p.team_id = t.id
      on conflict (user_id, kind, ref) do nothing;
    end if;
  end loop;

  -- Défis perso : dernier jour (à partir de midi), s'il reste quelque chose à faire.
  if p_now::time >= time '12:00' then
    for r in select c.id, c.user_id, c.target, ct.title,
                    coalesce((select sum(v.units) from public.validations v
                              where v.challenge_id = c.id and v.status = 'valid'), 0) as done
             from public.user_challenges c
             join public.challenge_templates ct on ct.id = c.template_id
             where c.status = 'active' and c.ends_on = today and c.ends_on > c.starts_on loop
      if r.done < r.target then
        perform public.notify(r.user_id, 'defi_fin', r.id::text, 'Dernier jour : ' || r.title,
          r.done || ' sur ' || r.target || ' pour l''instant. Encore ' || (r.target - r.done) || ' et c''est gagné.', '/fil');
      end if;
    end loop;
  end if;

  -- Classement de la semaine (pousses par participant) : prévenir une équipe qu'une autre vient de
  -- lui passer devant. Mêmes règles que le classement affiché : équipes d'au moins 5 participants.
  for r in
    with per_team as (
      select p.company_id, p.team_id, count(*) as participants,
             round(sum(public.member_points(p.id, wk))::numeric / count(*), 1) as points
      from public.profiles p
      where p.team_id is not null and p.consent_team_stats
      group by 1, 2
      having count(*) >= 5
    ), ranked as (
      select pt.*, rank() over (partition by pt.company_id order by pt.points desc) as rnk,
             lag(pt.team_id) over (partition by pt.company_id order by pt.points desc, pt.team_id) as ahead_id,
             lag(pt.points) over (partition by pt.company_id order by pt.points desc, pt.team_id) as ahead_points
      from per_team pt
    )
    select rk.*, s.rank as old_rank, s.week_start as old_week, tm.name as ahead_name
    from ranked rk
    left join public.team_rank_state s on s.team_id = rk.team_id
    left join public.teams tm on tm.id = rk.ahead_id
  loop
    if r.old_week = wk and r.rnk > r.old_rank and r.ahead_id is not null and r.points > 0 then
      insert into public.alerts (user_id, kind, ref, title, body, url)
      select p.id, 'equipe_depassee', r.team_id::text || ':' || today,
             r.ahead_name || ' vous passe devant',
             'Il manque ' || ceil(r.ahead_points - r.points + 0.1)::integer || ' pousse' || case when ceil(r.ahead_points - r.points + 0.1) > 1 then 's' else '' end
             || ' par personne à ton équipe pour reprendre la place.',
             '/equipes'
      from public.profiles p where p.team_id = r.team_id
      on conflict (user_id, kind, ref) do nothing;
    end if;
    insert into public.team_rank_state (team_id, week_start, rank) values (r.team_id, wk, r.rnk)
    on conflict (team_id) do update set week_start = excluded.week_start, rank = excluded.rank;
  end loop;

  return jsonb_build_object('duel_users', n_duels, 'teams', n_teams);
end;
$$;
revoke all on function public.tick_at(timestamp) from public;
