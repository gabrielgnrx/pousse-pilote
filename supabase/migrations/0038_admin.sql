-- 0038 — Espace admin RSE (v2, octobre 2026) : lancement en self-serve, tableau de bord, rapport mensuel.
--
-- Principe de confiance : l'admin RSE ne lit AUCUNE ligne individuelle. Il n'a aucun droit sur les tables
-- des salariés ; tout passe par des fonctions security definer qui renvoient des agrégats, et rien n'est
-- calculé sur un groupe de moins de 5 personnes (valeur null à la place).

-- 1. Les admins d'une organisation (une personne peut être admin sans participer) ----------------------
create table if not exists public.organization_admins (
  company_id uuid not null references public.companies on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
alter table public.organization_admins enable row level security;
drop policy if exists "admins: les miens" on public.organization_admins;
create policy "admins: les miens" on public.organization_admins for select to authenticated using (user_id = auth.uid());

alter table public.companies add column if not exists created_by uuid references auth.users on delete set null;

create or replace function public.is_org_admin(p_company uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.organization_admins where company_id = p_company and user_id = auth.uid())
$$;
revoke all on function public.is_org_admin(uuid) from public;
grant execute on function public.is_org_admin(uuid) to authenticated;

create or replace function public.my_admin_organizations()
returns table (company_id uuid, name text, join_code text, email_domain text, teams jsonb, participants integer)
language sql stable security definer set search_path = public
as $$
  select c.id, c.name, c.join_code, c.email_domain,
         coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by t.name) from public.teams t where t.company_id = c.id), '[]'::jsonb),
         (select count(*)::integer from public.profiles p where p.company_id = c.id)
  from public.organization_admins a join public.companies c on c.id = a.company_id
  where a.user_id = auth.uid()
  order by c.created_at
$$;
revoke all on function public.my_admin_organizations() from public;
grant execute on function public.my_admin_organizations() to authenticated;

-- Sans dépendre de l'extension unaccent : les lettres accentuées courantes du français.
create or replace function public.unaccent_fr(t text)
returns text
language sql immutable
as $$ select translate(t, 'àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇœŒ', 'aaaeeeeiioouuucAAAEEEEIIOOUUUCoO') $$;

-- 2. Lancer une organisation en self-serve -----------------------------------------------------------------
create or replace function public.create_organization(p_name text, p_email_domain text, p_teams text[])
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  name text := trim(coalesce(p_name, ''));
  domain text := nullif(lower(trim(coalesce(p_email_domain, ''))), '');
  code text;
  cid uuid;
  team text;
  user_email text;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if char_length(name) not between 2 and 80 then
    raise exception 'invalid_name';
  end if;
  if domain is not null and domain !~ '^[a-z0-9.-]+\.[a-z]{2,}$' then
    raise exception 'invalid_domain';
  end if;
  -- Le domaine imposé doit être celui de l'admin (on ne lance pas un programme pour une autre entreprise).
  select email into user_email from auth.users where id = uid;
  if domain is not null and lower(split_part(user_email, '@', 2)) <> domain then
    raise exception 'domain_mismatch';
  end if;
  if (select count(*) from public.organization_admins where user_id = uid) >= 3 then
    raise exception 'too_many_organizations';
  end if;
  if coalesce(array_length(p_teams, 1), 0) not between 1 and 30 then
    raise exception 'invalid_teams';
  end if;

  -- Code d'invitation : 6 lettres du nom, un tiret, 4 caractères aléatoires.
  loop
    code := upper(left(regexp_replace(unaccent_fr(name), '[^A-Za-z0-9]', '', 'g'), 6)) || '-'
            || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    exit when not exists (select 1 from public.companies where join_code = code);
  end loop;

  insert into public.companies (name, join_code, email_domain, pilot_start, created_by)
  values (name, code, domain, current_date, uid)
  returning id into cid;
  foreach team in array p_teams loop
    team := trim(team);
    if char_length(team) between 1 and 40 then
      insert into public.teams (company_id, name) values (cid, team) on conflict do nothing;
    end if;
  end loop;
  insert into public.organization_admins (company_id, user_id) values (cid, uid);
  return jsonb_build_object('company_id', cid, 'join_code', code);
end;
$$;
revoke all on function public.create_organization(text, text, text[]) from public;
grant execute on function public.create_organization(text, text, text[]) to authenticated;

create or replace function public.admin_add_teams(p_company uuid, p_teams text[])
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  team text;
  n integer := 0;
begin
  if not public.is_org_admin(p_company) then
    raise exception 'not_admin';
  end if;
  foreach team in array coalesce(p_teams, '{}') loop
    team := trim(team);
    if char_length(team) between 1 and 40 then
      insert into public.teams (company_id, name) values (p_company, team) on conflict do nothing;
      if found then n := n + 1; end if;
    end if;
  end loop;
  return n;
end;
$$;
revoke all on function public.admin_add_teams(uuid, text[]) from public;
grant execute on function public.admin_add_teams(uuid, text[]) to authenticated;

-- 3. Tableau de bord : agrégats seulement, rien sous 5 personnes -----------------------------------------
create or replace function public.poste_of(p_category text)
returns text
language sql immutable
as $$
  select case p_category
    when 'transport' then 'mobilite'
    when 'alimentation' then 'alimentation'
    when 'consommation' then 'consommation'
    when 'logement' then 'energie'
    else 'autre' end
$$;

create or replace function public.admin_dashboard(p_company uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  k constant integer := 5;
  members integer;
  wk date := date_trunc('week', current_date)::date;
begin
  if not public.is_org_admin(p_company) then
    raise exception 'not_admin';
  end if;
  select count(*) into members from public.profiles where company_id = p_company;

  return jsonb_build_object(
    'k', k,
    'participants', members,
    'active_7', (select case when count(distinct v.user_id) >= k or count(distinct v.user_id) = 0 then count(distinct v.user_id) end
                 from public.validations v where v.company_id = p_company and v.status = 'valid' and v.day > current_date - 7),
    'active_30', (select case when count(distinct v.user_id) >= k or count(distinct v.user_id) = 0 then count(distinct v.user_id) end
                  from public.validations v where v.company_id = p_company and v.status = 'valid' and v.day > current_date - 30),
    'with_bilan', (select case when count(*) >= k or count(*) = 0 then count(*) end
                   from public.habits h join public.profiles p on p.id = h.user_id where p.company_id = p_company),
    'kg_total', case when members >= k then (select coalesce(round(sum(v.kg), 1), 0) from public.validations v
                                             where v.company_id = p_company and v.status = 'valid') end,
    'actions_total', case when members >= k then (select count(*) from public.validations v
                                                  where v.company_id = p_company and v.status = 'valid') end,
    -- Par poste : seulement si au moins 5 personnes y ont contribué.
    'by_poste', (select coalesce(jsonb_object_agg(poste, case when people >= k then kg end), '{}'::jsonb) from (
        select public.poste_of(t.category) as poste, round(sum(v.kg), 1) as kg, count(distinct v.user_id) as people
        from public.validations v join public.challenge_templates t on t.id = v.template_id
        where v.company_id = p_company and v.status = 'valid'
        group by 1) x),
    -- Tendance : les 12 dernières semaines, kg et personnes actives (masqués sous 5 personnes).
    'weeks', (select coalesce(jsonb_agg(jsonb_build_object('week', w.week, 'active', case when w.people >= k then w.people end,
                                                           'kg', case when w.people >= k then w.kg end) order by w.week), '[]'::jsonb)
              from (select g::date as week,
                           (select count(distinct v.user_id) from public.validations v
                            where v.company_id = p_company and v.status = 'valid' and v.day between g::date and g::date + 6) as people,
                           (select coalesce(round(sum(v.kg), 1), 0) from public.validations v
                            where v.company_id = p_company and v.status = 'valid' and v.day between g::date and g::date + 6) as kg
                    from generate_series(wk - 77, wk, interval '7 days') g) w),
    -- Classement des équipes (team_scores ne garde que les équipes d'au moins 5 membres).
    'teams', (select coalesce(jsonb_agg(jsonb_build_object('name', s.team_name, 'members', s.members, 'active', s.active,
                                                           'kg', s.kg, 'score', s.score) order by s.score desc), '[]'::jsonb)
              from public.team_scores(p_company, null) s),
    'ai', (select jsonb_build_object('calls', count(*), 'cost_usd', round(coalesce(sum(cost_usd), 0), 2))
           from public.ai_calls a where a.company_id = p_company and a.created_at > now() - interval '30 days'));
end;
$$;
revoke all on function public.admin_dashboard(uuid) from public;
grant execute on function public.admin_dashboard(uuid) to authenticated;

-- 4. Données du rapport mensuel : agrégats du mois et verbatims anonymisés du chat -----------------------
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
              from public.team_scores(p_company, m0) s),
    'quotes', coalesce(quotes, '[]'::jsonb));
end;
$$;
revoke all on function public.admin_report_data(uuid, date) from public;
grant execute on function public.admin_report_data(uuid, date) to authenticated;

-- Remplace chaque prénom de l'organisation (mot entier, sans tenir compte de la casse) par « un collègue ».
create or replace function public.anonymize_text(p_text text, p_names text[])
returns text
language plpgsql immutable
as $$
declare
  n text;
  out text := p_text;
begin
  foreach n in array coalesce(p_names, '{}') loop
    if char_length(n) >= 2 then
      out := regexp_replace(out, '(^|[^[:alpha:]])' || regexp_replace(n, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') || '($|[^[:alpha:]])',
                            '\1un collègue\2', 'gi');
    end if;
  end loop;
  return out;
end;
$$;

-- 5. Rapports enregistrés ----------------------------------------------------------------------------------
create table if not exists public.monthly_reports (
  company_id uuid not null references public.companies on delete cascade,
  month date not null,
  content jsonb not null,
  source text not null check (source in ('ia', 'gabarit', 'mock')),
  prompt_version text,
  created_at timestamptz not null default now(),
  primary key (company_id, month)
);
alter table public.monthly_reports enable row level security;
drop policy if exists "rapports: admins" on public.monthly_reports;
create policy "rapports: admins" on public.monthly_reports for select to authenticated using (public.is_org_admin(company_id));

create or replace function public.admin_save_report(p_company uuid, p_month date, p_content jsonb, p_source text, p_version text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_org_admin(p_company) then
    raise exception 'not_admin';
  end if;
  insert into public.monthly_reports (company_id, month, content, source, prompt_version)
  values (p_company, date_trunc('month', p_month)::date, p_content, p_source, p_version)
  on conflict (company_id, month) do update set content = excluded.content, source = excluded.source,
    prompt_version = excluded.prompt_version, created_at = now();
end;
$$;
revoke all on function public.admin_save_report(uuid, date, jsonb, text, text) from public;
grant execute on function public.admin_save_report(uuid, date, jsonb, text, text) to authenticated;

-- 6. Export CSV : mobilité domicile-travail agrégée par mois (scope 3, forfait mobilités durables) ----------
create or replace function public.admin_mobility_csv(p_company uuid, p_from date, p_to date)
returns table (month text, mode text, trips integer, km numeric, kg_avoided numeric, people integer)
language plpgsql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
begin
  if not public.is_org_admin(p_company) then
    raise exception 'not_admin';
  end if;
  if p_to < p_from or p_to - p_from > 731 then
    raise exception 'invalid_period';
  end if;
  return query
  select to_char(date_trunc('month', v.day), 'YYYY-MM'),
         case v.template_id when 'velo' then 'velo_marche' when 'transports' then 'transports_en_commun'
                            when 'covoiturage' then 'covoiturage' else 'teletravail' end,
         case when count(distinct v.user_id) >= 5 then sum(v.units)::integer end,
         -- Distance : celle du trajet déclaré (un aller) ; un jour de télétravail évite un aller-retour.
         case when count(distinct v.user_id) >= 5 then round(sum(h.commute_km * v.units * case when v.template_id = 'teletravail' then 2 else 1 end), 1) end,
         case when count(distinct v.user_id) >= 5 then round(sum(v.kg), 1) end,
         case when count(distinct v.user_id) >= 5 then count(distinct v.user_id)::integer end
  from public.validations v
  left join public.habits h on h.user_id = v.user_id
  where v.company_id = p_company and v.status = 'valid' and v.day between p_from and p_to
    and v.template_id in ('velo', 'transports', 'covoiturage', 'teletravail')
  group by 1, 2
  order by 1, 2;
end;
$$;
revoke all on function public.admin_mobility_csv(uuid, date, date) from public;
grant execute on function public.admin_mobility_csv(uuid, date, date) to authenticated;
