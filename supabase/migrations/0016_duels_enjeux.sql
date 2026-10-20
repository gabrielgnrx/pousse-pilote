-- Pousse · duels avec enjeu, défis annulables, classement en pousses totales
--   1. Un défi peut se lancer en duel contre quelqu'un d'une AUTRE équipe : même action, 7 jours.
--   2. Duels avec enjeu (tous les nouveaux duels) :
--        refuser (ou laisser expirer 3 jours) : −10 pousses, sauf si l'action ne remplace rien dans son bilan ;
--        ne pas atteindre l'objectif au bout des 7 jours : −20 pousses (pour chacun des deux) ;
--        réussir : +25 chacun, ou +40 si on est seul à réussir (inchangé).
--      Une pénalité ne fait jamais passer le total sous zéro. Garde-fous : au plus 2 invitations en
--      attente par personne, et pas deux duels en même temps entre les deux mêmes personnes.
--   3. Classement des équipes : total des pousses de leurs membres.

-- 1. Les pénalités dans le registre des pousses ---------------------------------------------------

alter table public.points_ledger drop constraint if exists points_ledger_kind_check;
alter table public.points_ledger add constraint points_ledger_kind_check
  check (kind in ('maintien', 'influence', 'temoin', 'quete', 'serie', 'scan', 'collectif', 'duel', 'graine', 'quiz', 'equipe', 'penalite'));
alter table public.points_ledger drop constraint if exists points_ledger_points_check;
alter table public.points_ledger add constraint points_ledger_points_check
  check ((kind = 'penalite' and points < 0) or (kind <> 'penalite' and points > 0));

-- Retire au plus p_points, sans jamais faire passer le total sous zéro. Une seule fois par référence.
create or replace function public.apply_penalty(p_user uuid, p_company uuid, p_points integer, p_ref uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  amount integer := least(p_points, greatest(public.member_points(p_user, null), 0));
begin
  if amount <= 0 then
    return 0;
  end if;
  insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
  values (p_user, p_company, 'penalite', -amount, p_ref)
  on conflict (user_id, kind, ref_id) do nothing;
  return case when found then amount else 0 end;
end;
$$;
revoke all on function public.apply_penalty(uuid, uuid, integer, uuid) from public;

-- 2. Duels sur une action précise, avec enjeu ------------------------------------------------------

alter table public.duels add column if not exists template_id text references public.challenge_templates;
alter table public.duels add column if not exists variant text;
alter table public.duels add column if not exists challenge_id uuid references public.user_challenges on delete set null;
alter table public.duels add column if not exists stakes boolean not null default false;
alter table public.duels drop constraint if exists duels_kind_check;
alter table public.duels add constraint duels_kind_check check (kind in ('trajets', 'repas', 'scan', 'defis', 'action'));

-- Ce qui compte pour une personne dans un duel.
create or replace function public.duel_progress(d public.duels, p_user uuid)
returns integer
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select case
    when d.starts_on is null then 0
    when d.kind = 'action' then (select coalesce(sum(v.units), 0)::integer from public.validations v
                                 where v.user_id = p_user and v.status = 'valid' and v.template_id = d.template_id
                                   and v.day between d.starts_on and least(d.ends_on, current_date))
    else public.duel_count(d.kind, p_user, d.starts_on, least(d.ends_on, current_date)) end
$$;
revoke all on function public.duel_progress(public.duels, uuid) from public;

-- L'action est-elle faisable pour cette personne (elle remplace une habitude de son bilan) ?
create or replace function public.duel_feasible(d public.duels, p_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case when d.kind <> 'action' then true
              else coalesce((select public.unit_kg(d.template_id, coalesce(d.variant, 'base'), h) > 0
                             from public.habits h where h.user_id = p_user), false) end
$$;
revoke all on function public.duel_feasible(public.duels, uuid) from public;

-- Vérifications communes avant d'envoyer un duel.
create or replace function public.check_duel_opponent(me public.profiles, p_opponent uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  other public.profiles;
begin
  select * into other from public.profiles where id = p_opponent and company_id = me.company_id;
  if not found or other.id = me.id then
    raise exception 'invalid_opponent';
  end if;
  if other.team_id is null or other.team_id is not distinct from me.team_id then
    raise exception 'same_team';
  end if;
  if (select count(*) from public.duels where me.id in (challenger, opponent) and status in ('pending', 'active')) >= 3 then
    raise exception 'too_many_duels';
  end if;
  if (select count(*) from public.duels where opponent = p_opponent and status = 'pending') >= 2 then
    raise exception 'opponent_busy';
  end if;
  if exists (select 1 from public.duels
             where status in ('pending', 'active')
               and ((challenger = me.id and opponent = p_opponent) or (challenger = p_opponent and opponent = me.id))) then
    raise exception 'duel_exists';
  end if;
end;
$$;
revoke all on function public.check_duel_opponent(public.profiles, uuid) from public;

-- Lancer en duel un défi qu'on vient de créer : même action, objectif du défi (10 au plus), 7 jours.
create or replace function public.challenge_duel_action(p_challenge uuid, p_opponent uuid)
returns public.duels
language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles;
  c public.user_challenges;
  d public.duels;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;
  select * into c from public.user_challenges where id = p_challenge and user_id = me.id and status = 'active';
  if not found then
    raise exception 'challenge_not_found';
  end if;
  perform public.check_duel_opponent(me, p_opponent);
  insert into public.duels (company_id, challenger, opponent, kind, target, template_id, variant, challenge_id, stakes)
  values (me.company_id, me.id, p_opponent, 'action', least(c.target, 10), c.template_id, c.variant, c.id, true)
  returning * into d;
  return d;
end;
$$;
revoke all on function public.challenge_duel_action(uuid, uuid) from public;
grant execute on function public.challenge_duel_action(uuid, uuid) to authenticated;

-- Le duel « classique » (depuis le fil ou la page Duels) suit les mêmes règles : autre équipe, avec enjeu.
create or replace function public.challenge_duel(p_opponent uuid, p_kind text, p_target integer default 3)
returns public.duels
language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles;
  d public.duels;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;
  if p_kind not in ('trajets', 'repas', 'scan', 'defis') or p_target is null or p_target not between 1 and 10 then
    raise exception 'invalid_duel';
  end if;
  perform public.check_duel_opponent(me, p_opponent);
  insert into public.duels (company_id, challenger, opponent, kind, target, stakes)
  values (me.company_id, me.id, p_opponent, p_kind, p_target, true)
  returning * into d;
  return d;
end;
$$;
revoke all on function public.challenge_duel(uuid, text, integer) from public;
grant execute on function public.challenge_duel(uuid, text, integer) to authenticated;

-- Répondre : refuser coûte 10 pousses (si l'action est faisable pour soi).
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
    update public.duels set status = 'declined' where id = d.id returning * into d;
    if d.stakes and public.duel_feasible(d, d.opponent) then
      perform public.apply_penalty(d.opponent, d.company_id, 10, md5(d.id::text || ':refus')::uuid);
    end if;
  end if;
  return d;
end;
$$;
revoke all on function public.answer_duel(uuid, boolean) from public;
grant execute on function public.answer_duel(uuid, boolean) to authenticated;

-- Clôture : invitations expirées (= refus), duels terminés (bonus et pénalités).
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
    if d.stakes and public.duel_feasible(d, d.opponent) then
      perform public.apply_penalty(d.opponent, d.company_id, 10, md5(d.id::text || ':refus')::uuid);
    end if;
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
        perform public.apply_penalty(d.challenger, d.company_id, 20, md5(d.id::text || ':echec:' || d.challenger)::uuid);
      end if;
      if w in ('both', 'opponent') then
        insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
        values (d.opponent, d.company_id, 'duel', case when w = 'both' then 25 else 40 end, d.id)
        on conflict (user_id, kind, ref_id) do nothing;
      elsif d.stakes then
        perform public.apply_penalty(d.opponent, d.company_id, 20, md5(d.id::text || ':echec:' || d.opponent)::uuid);
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function public.settle_duels(uuid) from public;

create or replace function public.my_duels()
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return '[]'::jsonb;
  end if;
  perform public.settle_duels(me);
  return coalesce((
    select jsonb_agg(x order by x.rank, x.created_at desc)
    from (
      select d.id, d.kind, d.target, d.status, d.winner, d.starts_on, d.ends_on, d.created_at,
             d.template_id, d.variant, d.challenge_id, d.stakes,
             case when d.challenger = me then 'challenger' else 'opponent' end as role,
             o.id as other_id, o.display_name as other_name,
             (select t.name from public.teams t where t.id = o.team_id) as other_team,
             public.duel_progress(d, me) as mine,
             public.duel_progress(d, o.id) as theirs,
             public.duel_feasible(d, me) as feasible,
             case d.status when 'pending' then 0 when 'active' then 1 else 2 end as rank
      from public.duels d
      join public.profiles o on o.id = case when d.challenger = me then d.opponent else d.challenger end
      where me in (d.challenger, d.opponent)
        and (d.status in ('pending', 'active') or d.created_at > now() - interval '14 days')
    ) x), '[]'::jsonb);
end;
$$;
revoke all on function public.my_duels() from public;
grant execute on function public.my_duels() to authenticated;

-- 3. Classement : total des pousses de chaque équipe ---------------------------------------------

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
  order by 4 desc, 6 desc;
$$;
