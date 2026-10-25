-- 0041 — Le classement du rapport mensuel porte sur le mois du rapport seulement (v2, octobre 2026).
--
-- admin_report_data reprenait team_scores « depuis le début du mois », ce qui mêlait les mois suivants
-- au rapport d'un mois passé. team_scores_between borne la période des deux côtés ; même calcul que
-- team_scores (pousses par membre, lissées), mêmes règles : 5 membres au moins, consentement respecté.

create or replace function public.team_scores_between(p_company uuid, p_from date, p_to date)
returns table (team_id uuid, team_name text, members integer, active integer,
               points integer, kg numeric, score numeric)
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  with m as (
    select p.id, p.team_id,
           case when p.consent_team_stats then
             coalesce((select sum(v.points) from public.validations v
                       where v.user_id = p.id and v.status = 'valid' and v.day >= p_from and v.day < p_to), 0)
             + coalesce((select sum(l.points) from public.points_ledger l
                         where l.user_id = p.id and l.created_at >= p_from::timestamptz and l.created_at < p_to::timestamptz), 0)
           else 0 end as points,
           case when p.consent_team_stats then
             coalesce((select sum(v.kg) from public.validations v
                       where v.user_id = p.id and v.status = 'valid' and v.day >= p_from and v.day < p_to), 0)
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
revoke all on function public.team_scores_between(uuid, date, date) from public;

create or replace function public.admin_report_data(p_company uuid, p_month date)
returns jsonb
language plpgsql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  k constant integer := 5;
  m0 date := date_trunc('month', p_month)::date;
  m1 date := (date_trunc('month', p_month) + interval '1 month')::date;
  people integer;
  quotes jsonb;
  names text[];
begin
  if not public.is_org_admin(p_company) then
    raise exception 'not_admin';
  end if;
  select count(distinct v.user_id) into people from public.validations v
  where v.company_id = p_company and v.status = 'valid' and v.day >= m0 and v.day < m1;
  select array_agg(display_name order by char_length(display_name) desc) into names
  from public.profiles where company_id = p_company;

  -- Verbatims : messages publics (chat d'équipe, non masqués, écrits par des membres), sans auteur ni
  -- prénom (les prénoms de l'organisation sont remplacés), ni e-mail, ni numéro. Seulement si au moins
  -- 5 personnes ont participé au chat ce mois-ci.
  if (select count(distinct user_id) from public.team_messages
      where company_id = p_company and author_kind = 'member' and not hidden and created_at >= m0 and created_at < m1) >= k then
    select coalesce(jsonb_agg(q.body), '[]'::jsonb) into quotes from (
      select regexp_replace(regexp_replace(public.anonymize_text(m.body, names),
               '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}', '[e-mail]', 'g'),
             '\d[\d .-]{7,}\d', '[numéro]', 'g') as body
      from public.team_messages m
      where m.company_id = p_company and m.author_kind = 'member' and not m.hidden
        and m.created_at >= m0 and m.created_at < m1 and char_length(m.body) between 25 and 300
      order by md5(m.id::text)
      limit 30) q;
  end if;

  return jsonb_build_object(
    'month', to_char(m0, 'YYYY-MM'),
    'k', k,
    'participants', (select count(*) from public.profiles where company_id = p_company),
    'active', case when people >= k or people = 0 then people end,
    'kg', case when people >= k then (select coalesce(round(sum(v.kg), 1), 0) from public.validations v
                                      where v.company_id = p_company and v.status = 'valid' and v.day >= m0 and v.day < m1) end,
    'kg_previous', (select case when count(distinct v.user_id) >= k then round(sum(v.kg), 1) end from public.validations v
                    where v.company_id = p_company and v.status = 'valid' and v.day >= (m0 - interval '1 month')::date and v.day < m0),
    'actions', case when people >= k then (select count(*) from public.validations v
                                           where v.company_id = p_company and v.status = 'valid' and v.day >= m0 and v.day < m1) end,
    'by_poste', (select coalesce(jsonb_object_agg(poste, case when n >= k then kg end), '{}'::jsonb) from (
        select public.poste_of(t.category) as poste, round(sum(v.kg), 1) as kg, count(distinct v.user_id) as n
        from public.validations v join public.challenge_templates t on t.id = v.template_id
        where v.company_id = p_company and v.status = 'valid' and v.day >= m0 and v.day < m1 group by 1) x),
    'top_actions', (select coalesce(jsonb_agg(jsonb_build_object('template', template_id, 'count', n, 'people', p) order by n desc), '[]'::jsonb) from (
        select v.template_id, count(*) as n, count(distinct v.user_id) as p from public.validations v
        where v.company_id = p_company and v.status = 'valid' and v.day >= m0 and v.day < m1
        group by v.template_id having count(distinct v.user_id) >= k order by n desc limit 5) x),
    'challenges_done', (select case when count(distinct c.user_id) >= k then count(*) end from public.user_challenges c
                        where c.company_id = p_company and c.status = 'done' and c.done_at >= m0 and c.done_at < m1),
    'teams', (select coalesce(jsonb_agg(jsonb_build_object('name', s.team_name, 'members', s.members, 'kg', s.kg) order by s.score desc), '[]'::jsonb)
              from public.team_scores_between(p_company, m0, m1) s),
    'quotes', coalesce(quotes, '[]'::jsonb));
end;
$$;
revoke all on function public.admin_report_data(uuid, date) from public;
grant execute on function public.admin_report_data(uuid, date) to authenticated;
