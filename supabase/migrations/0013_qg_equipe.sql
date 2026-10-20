-- Pousse · le QG de l'équipe
--   1. Le chat de l'équipe : messages entre membres, signalement (masqué après 2 signalements).
--   2. Le défi d'équipe de la semaine, voté dans le chat le lundi de 9 h à 14 h.
--      Uniquement des défis que tout le monde peut relever et que l'appli compte elle-même :
--      repas végé, actions enregistrées, actions publiées avec photo, quiz, scanner, bravos.
--      Objectif = un nombre par membre × nombre de membres. Atteint : +30 pousses à chaque contributeur.
--   3. À 14 h, le choix le plus voté l'emporte (Pousse départage) et l'annonce arrive dans le chat.

alter table public.points_ledger drop constraint if exists points_ledger_kind_check;
alter table public.points_ledger add constraint points_ledger_kind_check
  check (kind in ('maintien', 'influence', 'temoin', 'quete', 'serie', 'scan', 'collectif', 'duel', 'graine', 'quiz', 'equipe'));

-- 1. Le chat ---------------------------------------------------------------------------------------

create table if not exists public.team_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies,
  team_id uuid not null references public.teams on delete cascade,
  -- null : message de Pousse (annonce du défi, résultat).
  user_id uuid references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists team_messages_team_idx on public.team_messages (team_id, created_at desc);
alter table public.team_messages enable row level security;
drop policy if exists "chat: mon équipe" on public.team_messages;
create policy "chat: mon équipe" on public.team_messages
  for select to authenticated
  using (not hidden and team_id = (select p.team_id from public.profiles p where p.id = auth.uid()));
-- Pas de politique d'écriture : tout passe par post_team_message.

create table if not exists public.team_message_reports (
  message_id uuid not null references public.team_messages on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.team_message_reports enable row level security;
drop policy if exists "chat: mes signalements" on public.team_message_reports;
create policy "chat: mes signalements" on public.team_message_reports
  for select to authenticated using (user_id = auth.uid());

create or replace function public.post_team_message(p_body text)
returns public.team_messages
language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles;
  m public.team_messages;
  body text := trim(coalesce(p_body, ''));
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;
  if me.team_id is null then
    raise exception 'no_team';
  end if;
  if char_length(body) = 0 or char_length(body) > 500 then
    raise exception 'invalid_message';
  end if;
  -- Garde-fou contre le spam : 30 messages par heure au plus.
  if (select count(*) from public.team_messages
      where user_id = me.id and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'too_many_messages';
  end if;
  insert into public.team_messages (company_id, team_id, user_id, body)
  values (me.company_id, me.team_id, me.id, body)
  returning * into m;
  return m;
end;
$$;
revoke all on function public.post_team_message(text) from public;
grant execute on function public.post_team_message(text) to authenticated;

create or replace function public.report_team_message(p_message uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  m public.team_messages;
begin
  select * into m from public.team_messages
  where id = p_message
    and team_id = (select team_id from public.profiles where id = auth.uid());
  if not found or m.user_id is null or m.user_id = auth.uid() then
    raise exception 'cannot_report';
  end if;
  insert into public.team_message_reports (message_id, user_id) values (m.id, auth.uid())
  on conflict do nothing;
  if (select count(*) from public.team_message_reports where message_id = m.id) >= 2 then
    update public.team_messages set hidden = true where id = m.id;
  end if;
end;
$$;
revoke all on function public.report_team_message(uuid) from public;
grant execute on function public.report_team_message(uuid) to authenticated;

-- 2. Le défi d'équipe de la semaine -------------------------------------------------------------

create table if not exists public.team_weeks (
  team_id uuid not null references public.teams on delete cascade,
  week_start date not null,
  options text[] not null,
  chosen text,
  target integer,
  primary key (team_id, week_start)
);
alter table public.team_weeks enable row level security;

create table if not exists public.team_week_votes (
  team_id uuid not null,
  week_start date not null,
  user_id uuid not null references public.profiles on delete cascade,
  choice text not null,
  created_at timestamptz not null default now(),
  primary key (team_id, week_start, user_id),
  foreign key (team_id, week_start) references public.team_weeks on delete cascade
);
alter table public.team_week_votes enable row level security;

-- Combien par membre, pour chaque type de défi d'équipe.
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
    else null end
$$;

-- Ce que l'équipe (ou un membre) a fait sur la période, pour un type de défi.
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
    when 'quiz' then (select count(*) from public.quiz_answers q
                      where q.user_id in (select id from members) and q.correct and q.day between p_from and p_to)
    when 'scan' then (select count(*) from public.product_swaps s
                      where s.user_id in (select id from members) and s.created_at::date between p_from and p_to)
    when 'bravo' then (select count(*) from public.cheers c
                       where c.user_id in (select id from members) and c.created_at::date between p_from and p_to)
    else 0 end)::integer
$$;
revoke all on function public.team_kind_count(text, uuid, uuid, date, date) from public;

-- Ouvre la semaine (3 choix), clôt le vote après lundi 14 h, crédite les contributeurs si l'objectif est atteint.
-- p_now : l'instant de référence (paramètre pour les tests ; now() sinon).
create or replace function public.settle_team_week(p_team uuid, p_week date, p_now timestamp)
returns public.team_weeks
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  w public.team_weeks;
  pool text[] := array['repas', 'actions', 'preuve', 'quiz', 'scan', 'bravo'];
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
        when 'quiz' then 'bonnes réponses au quiz'
        when 'scan' then 'meilleurs choix au scanner'
        when 'bravo' then 'bravos dans le fil' end;
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
revoke all on function public.settle_team_week(uuid, date, timestamp) from public;

-- L'état de la semaine pour la personne connectée.
create or replace function public.my_team_week_at(p_now timestamp)
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  wk date := date_trunc('week', p_now)::date;
  w public.team_weeks;
  before_points integer;
  gained integer;
  phase text;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found or me.team_id is null then
    return null;
  end if;
  select coalesce(sum(points), 0) into before_points from public.points_ledger where user_id = me.id and kind = 'equipe';
  -- La semaine dernière d'abord (bonus d'un objectif atteint en fin de semaine), puis celle-ci.
  perform public.settle_team_week(me.team_id, wk - 7, p_now);
  w := public.settle_team_week(me.team_id, wk, p_now);
  select coalesce(sum(points), 0) - before_points into gained from public.points_ledger where user_id = me.id and kind = 'equipe';

  phase := case
    when w.chosen is not null then 'closed'
    when p_now >= wk + time '09:00' then 'open'
    else 'upcoming' end;

  return jsonb_build_object(
    'week_start', wk,
    'phase', phase,
    'opens_at', to_char(wk + time '09:00', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'closes_at', to_char(wk + time '14:00', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'members', (select count(*) from public.profiles where team_id = me.team_id),
    'voters', (select count(*) from public.team_week_votes where team_id = me.team_id and week_start = wk),
    'my_vote', (select choice from public.team_week_votes where team_id = me.team_id and week_start = wk and user_id = me.id),
    'options', (select jsonb_agg(jsonb_build_object(
                  'kind', o,
                  'per_member', public.team_kind_per_member(o),
                  'votes', (select count(*) from public.team_week_votes b
                            where b.team_id = me.team_id and b.week_start = wk and b.choice = o))
                  order by i)
                from unnest(w.options) with ordinality as x(o, i)),
    'chosen', w.chosen,
    'target', w.target,
    'progress', case when w.chosen is null then null
                     else public.team_kind_count(w.chosen, me.team_id, null, wk, wk + 6) end,
    'mine', case when w.chosen is null then null
                 else public.team_kind_count(w.chosen, me.team_id, me.id, wk, wk + 6) end,
    'gained', gained);
end;
$$;
revoke all on function public.my_team_week_at(timestamp) from public;

create or replace function public.my_team_week()
returns jsonb
language sql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$ select public.my_team_week_at(localtimestamp) $$;
revoke all on function public.my_team_week() from public;
grant execute on function public.my_team_week() to authenticated;

-- Voter (ou changer son vote) : le lundi de 9 h à 14 h seulement.
create or replace function public.vote_team_week_at(p_choice text, p_now timestamp)
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  wk date := date_trunc('week', p_now)::date;
  w public.team_weeks;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found or me.team_id is null then
    raise exception 'no_team';
  end if;
  w := public.settle_team_week(me.team_id, wk, p_now);
  if w.chosen is not null or p_now < wk + time '09:00' or p_now >= wk + time '14:00' then
    raise exception 'vote_closed';
  end if;
  if not (p_choice = any (w.options)) then
    raise exception 'invalid_choice';
  end if;
  insert into public.team_week_votes (team_id, week_start, user_id, choice)
  values (me.team_id, wk, me.id, p_choice)
  on conflict (team_id, week_start, user_id) do update set choice = excluded.choice, created_at = now();
  return public.my_team_week_at(p_now);
end;
$$;
revoke all on function public.vote_team_week_at(text, timestamp) from public;

create or replace function public.vote_team_week(p_choice text)
returns jsonb
language sql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$ select public.vote_team_week_at(p_choice, localtimestamp) $$;
revoke all on function public.vote_team_week(text) from public;
grant execute on function public.vote_team_week(text) to authenticated;
