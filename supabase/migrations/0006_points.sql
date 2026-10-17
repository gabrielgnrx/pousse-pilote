-- Pousse · deux axes clairs
--   Le jeu = les points (classement individuel et par équipe).
--   L'impact = les kg de CO₂ évités (objectif collectif de l'entreprise), jamais utilisés pour gagner.
-- Remplace le score de progression de 0005 par un classement en points par participant.

-- Barème lisible : défi du quotidien 10, train 30, défis expert 15 à 150 (+5 avec une preuve).
update public.challenge_templates set points_per_unit = case id
  when 'velo' then 10
  when 'transports' then 10
  when 'covoiturage' then 10
  when 'vege' then 10
  when 'moins_boeuf' then 10
  when 'occasion' then 10
  when 'chauffage' then 10
  when 'train' then 30
  when 'vegetalien' then 15
  when 'reparation' then 60
  when 'vacances_train' then 150
  else points_per_unit end;

-- Le potentiel de réduction ne sert plus au classement.
drop function if exists public.weekly_potential_kg(public.habits);

-- Points d'une personne depuis une date : défis validés + garder le cap + influence + témoin.
create or replace function public.member_points(p_user uuid, p_since date)
returns integer
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select (
    coalesce((select sum(v.points) from public.validations v
              where v.user_id = p_user and v.status = 'valid'
                and (p_since is null or v.day >= p_since)), 0)
    + coalesce((select sum(l.points) from public.points_ledger l
                where l.user_id = p_user
                  and (p_since is null or l.created_at >= p_since::timestamptz)), 0)
  )::integer
$$;
revoke all on function public.member_points(uuid, date) from public;

-- Classement des équipes : points par participant (un inactif compte 0).
-- Toujours : équipes d'au moins 5 participants, les plus petites regroupées ou masquées.
drop function if exists public.team_stats(date);
create function public.team_stats(p_since date default null)
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
  order by 5 desc, 6 desc;
$$;

-- Objectif collectif : un seul, celui de l'entreprise, en kg de CO₂ évités depuis le début du pilote.
-- 30 kg par participant sur la durée du pilote (companies.pilot_weeks).
drop function if exists public.collective_goal();
create function public.collective_goal()
returns table (name text, participants integer, kg numeric, goal_kg numeric, ends_on date)
language sql stable security definer set search_path = public
as $$
  select c.name,
         (select count(*) from public.profiles p where p.company_id = c.id)::integer,
         coalesce((select round(sum(v.kg), 1) from public.validations v
                   where v.company_id = c.id and v.status = 'valid' and v.day >= c.pilot_start), 0),
         greatest(30, 30 * (select count(*) from public.profiles p where p.company_id = c.id)),
         c.pilot_start + 7 * c.pilot_weeks - 1
  from public.companies c
  where c.id = public.my_company_id()
$$;

revoke all on function public.team_stats(date) from public;
revoke all on function public.collective_goal() from public;
grant execute on function public.team_stats(date) to authenticated;
grant execute on function public.collective_goal() to authenticated;
