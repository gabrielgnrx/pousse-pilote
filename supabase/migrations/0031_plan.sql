-- 0031 — Mon plan, recalculé chaque semaine (v2, octobre 2026).
--
-- Le plan de la semaine est calculé par l'application (src/lib/plan/weekly.ts : potentiel de CO₂,
-- faisabilité déclarée, semaine écoulée), puis éventuellement formulé par le coach IA. La base :
--   - n'accepte qu'un plan fait de défis du catalogue reliés à des facteurs d'émission (plan_validate) ;
--   - garde la faisabilité déclarée par la personne ;
--   - fournit le bilan de la semaine écoulée (actions par défi, défis abandonnés, défis en cours) ;
--   - sert la tâche planifiée du lundi (clé « ia »), par lots.

-- 1. Faisabilité déclarée -------------------------------------------------------------------------------
create table if not exists public.plan_feasibility (
  user_id uuid not null references public.profiles on delete cascade,
  template_id text not null references public.challenge_templates,
  level text not null check (level in ('facile', 'possible', 'difficile', 'impossible')),
  updated_at timestamptz not null default now(),
  primary key (user_id, template_id)
);
alter table public.plan_feasibility enable row level security;
drop policy if exists "faisabilité: la mienne" on public.plan_feasibility;
create policy "faisabilité: la mienne" on public.plan_feasibility for select to authenticated using (user_id = auth.uid());

create or replace function public.set_feasibility(p_template text, p_level text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_member';
  end if;
  insert into public.plan_feasibility (user_id, template_id, level)
  values (auth.uid(), p_template, p_level)
  on conflict (user_id, template_id) do update set level = excluded.level, updated_at = now();
  -- Le plan de la semaine sera recalculé avec cette faisabilité (la table user_plans est créée plus bas ;
  -- la fonction n'est appelée qu'une fois la migration appliquée).
  delete from public.user_plans
   where user_id = auth.uid() and week_start = date_trunc('week', (now() at time zone 'Europe/Paris')::date)::date;
end;
$$;
revoke all on function public.set_feasibility(text, text) from public;
grant execute on function public.set_feasibility(text, text) to authenticated;

-- 2. Date d'abandon d'un défi (pour adapter le plan) ------------------------------------------------------
alter table public.user_challenges add column if not exists abandoned_at timestamptz;
create or replace function public.challenge_abandoned_at()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if new.status = 'abandoned' and old.status is distinct from 'abandoned' then
    new.abandoned_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists user_challenges_abandoned_at on public.user_challenges;
create trigger user_challenges_abandoned_at
  before update of status on public.user_challenges
  for each row execute function public.challenge_abandoned_at();

-- 3. La semaine écoulée d'une personne ---------------------------------------------------------------------
create or replace function public.plan_week_stats(p_user uuid)
returns jsonb
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  with wk as (select date_trunc('week', current_date)::date as this_monday)
  select jsonb_build_object(
    'counts', coalesce((select jsonb_object_agg(template_id, n) from (
        select v.template_id, sum(v.units)::integer as n from public.validations v, wk
        where v.user_id = p_user and v.status = 'valid' and v.day >= wk.this_monday - 7 and v.day < wk.this_monday
        group by v.template_id) x), '{}'::jsonb),
    'abandoned', coalesce((select jsonb_agg(distinct c.template_id) from public.user_challenges c, wk
        where c.user_id = p_user and c.status = 'abandoned' and c.abandoned_at >= wk.this_monday - 7), '[]'::jsonb),
    'active', coalesce((select jsonb_agg(distinct c.template_id) from public.user_challenges c
        where c.user_id = p_user and c.status = 'active' and current_date between c.starts_on and c.ends_on), '[]'::jsonb))
$$;
revoke all on function public.plan_week_stats(uuid) from public;

create or replace function public.my_plan_inputs()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'stats', public.plan_week_stats(auth.uid()),
    'feasibility', coalesce((select jsonb_object_agg(template_id, level) from public.plan_feasibility where user_id = auth.uid()), '{}'::jsonb))
  where auth.uid() is not null
$$;
revoke all on function public.my_plan_inputs() from public;
grant execute on function public.my_plan_inputs() to authenticated;

-- 4. Le plan ------------------------------------------------------------------------------------------------
create table if not exists public.user_plans (
  user_id uuid not null references public.profiles on delete cascade,
  company_id uuid not null references public.companies on delete cascade,
  week_start date not null,
  items jsonb not null,
  source text not null check (source in ('regles', 'ia', 'mock')),
  prompt_version text,
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);
alter table public.user_plans enable row level security;
drop policy if exists "plans: le mien" on public.user_plans;
create policy "plans: le mien" on public.user_plans for select to authenticated using (user_id = auth.uid());

-- Un plan valide : 1 à 5 défis du catalogue, chacun relié à une action dont le CO₂ vient des facteurs
-- (jamais un défi sans facteur, même si l'IA en proposait un), une phrase courte par défi.
create or replace function public.plan_validate(p_items jsonb)
returns jsonb
language plpgsql stable set search_path = public
as $$
declare
  item jsonb;
  out jsonb := '[]'::jsonb;
  tpl text;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 5 then
    raise exception 'invalid_plan';
  end if;
  for item in select * from jsonb_array_elements(p_items) loop
    tpl := item->>'template_id';
    if not exists (
      select 1 from public.challenge_templates t
      join public.action_types a on a.template_id = t.id and a.active
      where t.id = tpl and t.active and a.reference_rule <> 'aucun' and cardinality(a.factors) > 0) then
      raise exception 'invalid_plan_item:%', tpl;
    end if;
    if coalesce(item->>'signal', '') not in ('nouveau', 'abandonne', 'sur_sa_lancee', 'en_cours')
       or coalesce((item->>'kg_year')::numeric, -1) < 0
       or char_length(coalesce(item->>'reason', '')) not between 1 and 220 then
      raise exception 'invalid_plan_item:%', tpl;
    end if;
    out := out || jsonb_build_object(
      'template_id', tpl,
      'variant', left(coalesce(item->>'variant', 'base'), 20),
      'kg_year', round((item->>'kg_year')::numeric),
      'signal', item->>'signal',
      'reason', trim(item->>'reason'));
  end loop;
  return out;
end;
$$;

create or replace function public.save_my_plan(p_items jsonb, p_source text, p_version text default null)
returns void
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  cid uuid := public.my_company_id();
begin
  if cid is null then
    raise exception 'not_member';
  end if;
  insert into public.user_plans (user_id, company_id, week_start, items, source, prompt_version)
  values (auth.uid(), cid, date_trunc('week', current_date)::date, public.plan_validate(p_items), p_source, p_version)
  on conflict (user_id, week_start) do update
    set items = excluded.items, source = excluded.source, prompt_version = excluded.prompt_version, created_at = now();
end;
$$;
revoke all on function public.save_my_plan(jsonb, text, text) from public;
grant execute on function public.save_my_plan(jsonb, text, text) to authenticated;

-- 5. La tâche planifiée du lundi : par lots, les personnes sans plan cette semaine ---------------------------
create or replace function public.plan_pending(p_token text, p_limit integer default 25)
returns table (user_id uuid, company_id uuid, habits jsonb, feasibility jsonb, stats jsonb, active_recently boolean)
language plpgsql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
begin
  if not public.cron_key_named('ia', p_token) then
    raise exception 'not_allowed';
  end if;
  return query
  select p.id, p.company_id, to_jsonb(h) - 'user_id' - 'updated_at',
         coalesce((select jsonb_object_agg(f.template_id, f.level) from public.plan_feasibility f where f.user_id = p.id), '{}'::jsonb),
         public.plan_week_stats(p.id),
         exists (select 1 from public.validations v where v.user_id = p.id and v.day > current_date - 28)
  from public.profiles p
  join public.habits h on h.user_id = p.id
  -- Sans plan cette semaine, ou avec le plan des règles calculé à une visite (« visite ») : la tâche du
  -- lundi le reformule avec le coach pour les personnes actives. Ses propres plans n'y reviennent pas.
  where not exists (select 1 from public.user_plans u
                    where u.user_id = p.id and u.week_start = date_trunc('week', current_date)::date
                      and not (u.source = 'regles' and coalesce(u.prompt_version, '') = 'visite'
                               and exists (select 1 from public.validations v where v.user_id = p.id and v.day > current_date - 28)))
  order by p.id
  limit least(greatest(p_limit, 1), 100);
end;
$$;
revoke all on function public.plan_pending(text, integer) from public;
grant execute on function public.plan_pending(text, integer) to anon, authenticated;

create or replace function public.save_plan_for(p_token text, p_user uuid, p_items jsonb, p_source text, p_version text default null)
returns void
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
begin
  if not public.cron_key_named('ia', p_token) then
    raise exception 'not_allowed';
  end if;
  insert into public.user_plans (user_id, company_id, week_start, items, source, prompt_version)
  select p.id, p.company_id, date_trunc('week', current_date)::date, public.plan_validate(p_items), p_source, p_version
  from public.profiles p where p.id = p_user
  on conflict (user_id, week_start) do update
    set items = excluded.items, source = excluded.source, prompt_version = excluded.prompt_version, created_at = now();
end;
$$;
revoke all on function public.save_plan_for(text, uuid, jsonb, text, text) from public;
grant execute on function public.save_plan_for(text, uuid, jsonb, text, text) to anon, authenticated;
