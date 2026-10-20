-- Pousse · fiabilité : équipe verrouillée, règlement automatique, notifications ciblées
--   1. On ne change plus d'équipe soi-même (sinon on emporte ses pousses dans l'équipe qui gagne).
--      Un changement reste possible depuis l'éditeur SQL (auth.uid() vide), pour corriger une erreur.
--   2. Une table d'alertes : ce qui mérite une notification (invitation en duel, vote ouvert, défi qui
--      se termine, équipe dépassée…). Elles s'affichent dans l'appli et partent en notification push.
--   3. tick() : règle les duels et le défi de la semaine à heure fixe (plus besoin que quelqu'un ouvre
--      l'appli) et prépare les alertes. Appelée toutes les 5 minutes (0019_planification.sql).

-- 1. Équipe verrouillée ---------------------------------------------------------------------------

create or replace function public.lock_team()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if new.team_id is not null
     and not exists (select 1 from public.teams t where t.id = new.team_id and t.company_id = new.company_id) then
    raise exception 'unknown_team';
  end if;
  if tg_op = 'UPDATE' and old.team_id is not null and new.team_id is distinct from old.team_id
     and auth.uid() is not null then
    raise exception 'team_locked';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_lock_team on public.profiles;
create trigger profiles_lock_team
  before insert or update of team_id, company_id on public.profiles
  for each row execute function public.lock_team();

-- 2. Alertes --------------------------------------------------------------------------------------

create table if not exists public.alerts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null,
  ref text not null,
  title text not null,
  body text not null,
  url text not null default '/fil',
  created_at timestamptz not null default now(),
  pushed_at timestamptz,
  seen_at timestamptz,
  unique (user_id, kind, ref)
);
create index if not exists alerts_user_idx on public.alerts (user_id, created_at desc);
create index if not exists alerts_unpushed_idx on public.alerts (created_at) where pushed_at is null;
alter table public.alerts enable row level security;
drop policy if exists "alertes: les miennes" on public.alerts;
create policy "alertes: les miennes" on public.alerts
  for select to authenticated using (user_id = auth.uid());

-- Une alerte au plus par (personne, sorte, référence) : rejouer tick() ne crée pas de doublon.
create or replace function public.notify(p_user uuid, p_kind text, p_ref text, p_title text, p_body text, p_url text)
returns void
language sql security definer set search_path = public
as $$
  insert into public.alerts (user_id, kind, ref, title, body, url)
  values (p_user, p_kind, p_ref, p_title, p_body, p_url)
  on conflict (user_id, kind, ref) do nothing;
$$;
revoke all on function public.notify(uuid, text, text, text, text, text) from public;

create or replace function public.mark_alerts_seen()
returns void
language sql security definer set search_path = public
as $$
  update public.alerts set seen_at = now() where user_id = auth.uid() and seen_at is null;
$$;
revoke all on function public.mark_alerts_seen() from public;
grant execute on function public.mark_alerts_seen() to authenticated;

-- Duels : invitation, réponse, expiration et résultat préviennent les bonnes personnes.
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
        case when new.stakes then 'Tu as 3 jours pour répondre. Sans réponse ou en cas de refus : −10 pousses.'
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
      case when new.stakes then 'Tu n''as pas répondu à ' || c_name || ' : −10 pousses.'
           else 'Tu n''as pas répondu à ' || c_name || '.' end,
      '/duels');
  elsif new.status = 'done' then
    perform public.notify(new.challenger, 'duel_fin', new.id::text,
      case new.winner when 'both' then 'Duel réussi à deux contre ' || o_name
                      when 'challenger' then 'Duel gagné contre ' || o_name
                      else 'Duel perdu contre ' || o_name end,
      case new.winner when 'both' then '+25 pousses chacun.'
                      when 'challenger' then '+40 pousses.'
                      else case when new.stakes then 'Objectif manqué : −20 pousses.' else 'Objectif manqué cette fois.' end end,
      '/duels');
    perform public.notify(new.opponent, 'duel_fin', new.id::text,
      case new.winner when 'both' then 'Duel réussi à deux contre ' || c_name
                      when 'opponent' then 'Duel gagné contre ' || c_name
                      else 'Duel perdu contre ' || c_name end,
      case new.winner when 'both' then '+25 pousses chacun.'
                      when 'opponent' then '+40 pousses.'
                      else case when new.stakes then 'Objectif manqué : −20 pousses.' else 'Objectif manqué cette fois.' end end,
      '/duels');
  end if;
  return new;
end;
$$;
revoke all on function public.duel_alerts() from public;

drop trigger if exists duels_alerts on public.duels;
create trigger duels_alerts
  after insert or update of status on public.duels
  for each row execute function public.duel_alerts();

-- 3. Le tic-tac : règlements et alertes programmées -----------------------------------------------

-- Rang de chaque équipe la dernière fois (pour prévenir quand une autre passe devant).
create table if not exists public.team_rank_state (
  team_id uuid primary key references public.teams on delete cascade,
  week_start date not null,
  rank integer not null
);
alter table public.team_rank_state enable row level security;

create or replace function public.team_kind_label(p_kind text)
returns text
language sql immutable
as $$
  select case p_kind
    when 'repas' then 'repas végé'
    when 'actions' then 'actions enregistrées'
    when 'preuve' then 'actions publiées avec photo'
    when 'quiz' then 'quiz réussis'
    when 'scan' then 'meilleurs choix au scanner'
    when 'bravo' then 'bravos dans le fil'
    when 'nature' then 'actions nature'
    else p_kind end
$$;

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

  -- Classement de la semaine : prévenir une équipe qu'une autre vient de lui passer devant.
  -- Mêmes règles que le classement affiché : équipes d'au moins 5 participants.
  for r in
    with per_team as (
      select p.company_id, p.team_id, count(*) as participants,
             sum(public.member_points(p.id, wk)) as points
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
             'Il manque ' || (r.ahead_points - r.points + 1) || ' pousses à ton équipe pour reprendre la place.',
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

create or replace function public.tick()
returns jsonb
language sql security definer set search_path = public
as $$
  select public.tick_at((now() at time zone 'Europe/Paris')::timestamp);
$$;
revoke all on function public.tick() from public;

-- 4. Envoi des notifications ----------------------------------------------------------------------

-- Clé d'un cron donné (empreinte SHA-256 dans cron_keys).
create or replace function public.cron_key_valid(p_name text, p_token text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_token is not null and length(p_token) >= 32 and exists (
    select 1 from public.cron_keys k
    where k.name = p_name and k.sha256 = encode(sha256(convert_to(p_token, 'UTF8')), 'hex'))
$$;
revoke all on function public.cron_key_valid(text, text) from public;

-- Les appareils à prévenir : une notification par personne au plus par heure, rien entre 21 h et 8 h,
-- seulement les alertes de moins de 12 h. Les alertes plus anciennes restent visibles dans l'appli.
create or replace function public.alerts_due_at(p_token text, p_now timestamp)
returns table (endpoint text, user_id uuid)
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
begin
  if not public.cron_key_valid('notifier', p_token) then
    raise exception 'forbidden';
  end if;
  if p_now::time < time '08:00' or p_now::time >= time '21:00' then
    return;
  end if;
  return query
    select s.endpoint, s.user_id
    from public.push_subscriptions s
    where exists (select 1 from public.alerts a
                  where a.user_id = s.user_id and a.pushed_at is null and a.seen_at is null
                    and a.created_at > now() - interval '12 hours')
      and not exists (select 1 from public.alerts a
                      where a.user_id = s.user_id and a.pushed_at > now() - interval '1 hour');
end;
$$;
revoke all on function public.alerts_due_at(text, timestamp) from public;

create or replace function public.alerts_due(p_token text)
returns table (endpoint text, user_id uuid)
language sql security definer set search_path = public
as $$
  select * from public.alerts_due_at(p_token, (now() at time zone 'Europe/Paris')::timestamp);
$$;
revoke all on function public.alerts_due(text) from public;
grant execute on function public.alerts_due(text) to anon, authenticated;

-- Après l'envoi : la plus récente alerte de chaque personne prévenue part, les autres restent dans
-- l'appli ; les abonnements refusés par le service de push sont retirés.
create or replace function public.alerts_pushed(p_token text, p_users uuid[], p_gone text[])
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.cron_key_valid('notifier', p_token) then
    raise exception 'forbidden';
  end if;
  update public.alerts set pushed_at = now()
  where user_id = any (p_users) and pushed_at is null;
  delete from public.push_subscriptions where endpoint = any (p_gone);
end;
$$;
revoke all on function public.alerts_pushed(text, uuid[], text[]) from public;
grant execute on function public.alerts_pushed(text, uuid[], text[]) to anon, authenticated;

-- Lu par le téléphone à la réception : l'alerte qui vient de partir, sinon rien (rappel du jour).
create or replace function public.my_latest_alert()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('title', a.title, 'body', a.body, 'url', a.url, 'tag', a.kind)
  from public.alerts a
  where a.user_id = auth.uid() and a.pushed_at > now() - interval '15 minutes'
  order by a.created_at desc
  limit 1
$$;
revoke all on function public.my_latest_alert() from public;
grant execute on function public.my_latest_alert() to authenticated;
