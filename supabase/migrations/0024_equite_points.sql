-- 0024 — Des pousses et un classement équitables (21 octobre 2026).
--
-- 1. Une bonne habitude rapporte autant qu'un changement. Vélo, transports, covoiturage, télétravail,
--    repas végé, occasion, chauffage baissé : mêmes pousses que l'on parte de loin ou que l'on
--    le fasse déjà (0 kg évité en plus, toujours). Le plafond de 5 pousses par jour reste pour les
--    petits gestes et pour les actions qui ne remplacent rien.
-- 2. Les actions qui rapportent le plus demandent un justificatif privé : train au lieu de l'avion
--    (billet), vacances en train (réservation), réparation (facture).
-- 3. Défis : un objectif d'au moins 3 (1 pour les actions qui se font une fois par semaine), et un
--    seul défi en cours par action. Le bonus de +20 récompense un vrai objectif.
-- 4. Classement des équipes :
--    - l'effectif compte tous les membres de l'équipe, qu'ils partagent leurs pousses ou non : une
--      équipe ne peut plus monter en faisant sortir ses inactifs du calcul ;
--    - les pousses par personne sont lissées vers la moyenne de l'entreprise (comme si l'équipe
--      comptait 3 personnes « moyennes » de plus) : une petite équipe ne gagne plus sur un coup de
--      chance, une grande n'est plus noyée par ses inactifs ;
--    - les équipes de moins de 5 membres ne sont plus classées (ni regroupées en « Autres équipes »).
-- 5. La relance d'un duel ne promet plus une pénalité qui n'existe pas.

-- 1. Les actions « habitude ».
create or replace function public.is_habit_action(p_template text)
returns boolean
language sql immutable
as $$
  select p_template in ('velo', 'transports', 'covoiturage', 'teletravail',
                        'vege', 'moins_boeuf', 'vegetalien', 'occasion', 'chauffage')
$$;

-- 2. Justificatif pour les grosses actions.
update public.challenge_templates set requires_receipt = true
where id in ('train', 'vacances_train', 'reparation');

-- 3. Défis : objectif minimum, un seul défi en cours par action.
create or replace function public.check_new_challenge()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  win integer;
begin
  select cap_window_days into win from public.challenge_templates where id = new.template_id;
  if new.target < (case when coalesce(win, 1) >= 7 then 1 else 3 end) then
    raise exception 'target_too_small';
  end if;
  if exists (select 1 from public.user_challenges c
             where c.user_id = new.user_id and c.template_id = new.template_id
               and c.status = 'active' and c.ends_on >= current_date) then
    raise exception 'challenge_exists';
  end if;
  return new;
end;
$$;
revoke all on function public.check_new_challenge() from public;
drop trigger if exists user_challenges_check_new on public.user_challenges;
create trigger user_challenges_check_new
  before insert on public.user_challenges
  for each row execute function public.check_new_challenge();

-- 4. Le score des équipes, partagé par le classement et par l'alerte « vous passe devant ».
create or replace function public.team_scores(p_company uuid, p_since date)
returns table (team_id uuid, team_name text, members integer, active integer,
               points integer, kg numeric, score numeric)
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  with m as (
    select p.id, p.team_id, p.consent_team_stats as shared,
           case when p.consent_team_stats then public.member_points(p.id, p_since) else 0 end as points,
           case when p.consent_team_stats then
             coalesce((select sum(v.kg) from public.validations v
                       where v.user_id = p.id and v.status = 'valid'
                         and (p_since is null or v.day >= p_since)), 0)
           else 0 end as kg
    from public.profiles p
    where p.company_id = p_company and p.team_id is not null
  ),
  avg_all as (
    select coalesce(sum(points)::numeric / nullif(count(*), 0), 0) as a from m
  ),
  t as (
    select m.team_id, count(*)::integer as members,
           count(*) filter (where m.points > 0)::integer as active,
           sum(m.points)::integer as points, sum(m.kg) as kg
    from m group by m.team_id
  )
  select t.team_id, tm.name, t.members, t.active, t.points, round(t.kg, 1),
         round((t.points + 3 * (select a from avg_all)) / (t.members + 3), 1)
  from t join public.teams tm on tm.id = t.team_id
  where t.members >= 5
$$;
revoke all on function public.team_scores(uuid, date) from public;

drop function if exists public.team_stats(date);
create function public.team_stats(p_since date default null)
returns table (team_name text, participants integer, active integer, points integer,
               points_per_person numeric, kg numeric, is_mine boolean)
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select s.team_name, s.members, s.active, s.points, s.score, s.kg,
         s.team_id = (select team_id from public.profiles where id = auth.uid())
  from public.team_scores(public.my_company_id(), p_since) s
  order by s.score desc, s.points desc
$$;
revoke all on function public.team_stats(date) from public;
grant execute on function public.team_stats(date) to authenticated;

-- 1 (suite). Les pousses d'une action.
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

-- 4 et 5. Le passage quotidien : alerte de classement sur le même score, relance de duel corrigée.
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
      'Accepte ou refuse avant demain : sans réponse, le duel est annulé, sans rien perdre.',
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
      select c.id as company_id, s.team_id, s.score as points
      from public.companies c, lateral public.team_scores(c.id, wk) s
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
