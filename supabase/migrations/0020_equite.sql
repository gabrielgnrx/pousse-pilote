-- Pousse · un jeu plus juste
--   1. Classement des équipes : pousses par participant (une grosse équipe ne gagne plus mécaniquement).
--   2. Gestes à 0 kg (rien de remplacé dans le bilan) : 5 pousses par jour au plus, tous gestes confondus.
--   3. Duels : refuser ou laisser expirer ne coûte plus rien ; échouer coûte la mise, 10 pousses.

-- 1. Classement --------------------------------------------------------------------------------

create or replace function public.team_stats(p_since date default null)
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
  order by 5 desc, 4 desc;
$$;
revoke all on function public.team_stats(date) from public;
grant execute on function public.team_stats(date) to authenticated;

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
             'Objectif : ' || w.target || ' pour toute l''équipe. +30 pousses pour chaque contributeur.', '/fil'
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

-- 2. Gestes sans CO₂ compté ----------------------------------------------------------------------

create or replace function public.log_action(p_template text, p_variant text default 'base')
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
  per_unit numeric := 0;
  used integer;
  pts integer;
  v public.validations;
  done_units integer;
  challenge jsonb := null;
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

  -- Un défi en cours sur la même action ? L'action y compte.
  select * into c from public.user_challenges
  where user_id = me.id and template_id = t.id and variant = p_variant
    and status = 'active' and current_date between starts_on and ends_on
  order by created_at
  limit 1
  for update;

  -- Les pousses suivent l'impact : les gestes à 0 kg (rien de remplacé dans le bilan) se partagent
  -- 5 pousses par jour au plus. Ils restent comptés dans les séries, les quêtes et les défis.
  pts := t.points_per_unit;
  if round(per_unit, 3) = 0 then
    pts := least(pts, greatest(0, 5 - (
      select coalesce(sum(z.points), 0) from public.validations z
      where z.user_id = me.id and z.status = 'valid' and z.day = current_date and z.kg = 0)));
  end if;

  insert into public.validations (
    challenge_id, user_id, company_id, team_id, template_id, variant, day, units,
    kg, points, proof_photo_path, witness_id, witness_status, proof_level, caption, visibility)
  values (
    c.id, me.id, me.company_id, me.team_id, t.id, p_variant, current_date, 1,
    round(per_unit, 3), pts, null, null, 'none', 0, null, 'private')
  returning * into v;

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
      'days', (select coalesce(jsonb_agg(distinct d.day), '[]'::jsonb)
               from public.validations d where d.challenge_id = c.id and d.status = 'valid'));
  end if;

  return jsonb_build_object(
    'id', v.id,
    'template_id', v.template_id,
    'variant', v.variant,
    'kg', v.kg,
    'points', v.points,
    'challenge', challenge,
    -- Combien de fois ce mois-ci, et le CO₂ cumulé de cette action.
    'month_count', (select count(*) from public.validations m
                    where m.user_id = me.id and m.status = 'valid' and m.template_id = t.id
                      and m.day >= date_trunc('month', current_date)::date),
    'month_kg', (select coalesce(sum(m.kg), 0) from public.validations m
                 where m.user_id = me.id and m.status = 'valid' and m.template_id = t.id
                   and m.day >= date_trunc('month', current_date)::date));
end;
$$;
revoke all on function public.log_action(text, text) from public;
grant execute on function public.log_action(text, text) to authenticated;

-- 3. Duels -----------------------------------------------------------------------------------------

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
    -- Refuser ne coûte rien : on ne punit pas celui qui n'a pas envie de jouer.
    update public.duels set status = 'declined' where id = d.id returning * into d;
  end if;
  return d;
end;
$$;
revoke all on function public.answer_duel(uuid, boolean) from public;
grant execute on function public.answer_duel(uuid, boolean) to authenticated;

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
        values (d.challenger, d.company_id, 'duel', case when w = 'both' then 25 else 40 end, d.id)
        on conflict (user_id, kind, ref_id) do nothing;
      elsif d.stakes then
        perform public.apply_penalty(d.challenger, d.company_id, 10, md5(d.id::text || ':echec:' || d.challenger)::uuid);
      end if;
      if w in ('both', 'opponent') then
        insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
        values (d.opponent, d.company_id, 'duel', case when w = 'both' then 25 else 40 end, d.id)
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
      case new.winner when 'both' then '+25 pousses chacun.'
                      when 'challenger' then '+40 pousses.'
                      else case when new.stakes then 'Objectif manqué : tu perds ta mise de 10 pousses.' else 'Objectif manqué cette fois.' end end,
      '/duels');
    perform public.notify(new.opponent, 'duel_fin', new.id::text,
      case new.winner when 'both' then 'Duel réussi à deux contre ' || c_name
                      when 'opponent' then 'Duel gagné contre ' || c_name
                      else 'Duel perdu contre ' || c_name end,
      case new.winner when 'both' then '+25 pousses chacun.'
                      when 'opponent' then '+40 pousses.'
                      else case when new.stakes then 'Objectif manqué : tu perds ta mise de 10 pousses.' else 'Objectif manqué cette fois.' end end,
      '/duels');
  end if;
  return new;
end;
$$;
revoke all on function public.duel_alerts() from public;
