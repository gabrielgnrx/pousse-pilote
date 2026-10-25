-- 0040 — Refuser l'IA (v2, octobre 2026).
--
-- Chaque salarié peut refuser l'usage de l'IA pour ses propres données (onboarding ou profil). Ce choix
-- est appliqué par la base, au même endroit que les quotas : ai_consume refuse tout appel pour une
-- personne qui a dit non, et l'application passe à ses replis sans IA (raccourcis, formulaire, plan
-- des règles). Le plan du lundi n'appelle pas le coach pour elle ; ses justificatifs ne sont pas lus
-- par l'IA (ils restent en attente : l'action compte pour le CO₂, sans les pousses du justificatif).

alter table public.profiles add column if not exists consent_ai boolean not null default true;

create or replace function public.ai_consume(p_task text, p_user_limit integer, p_org_limit integer)
returns boolean
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  uid uuid := auth.uid();
  cid uuid := public.my_company_id();
  u integer;
  o integer;
begin
  if uid is null or cid is null then
    raise exception 'not_member';
  end if;
  if p_user_limit < 1 or p_org_limit < 1
     or not coalesce((select consent_ai from public.profiles where id = uid), false) then
    return false;
  end if;
  insert into public.ai_quota as q (scope, subject, task, day, used)
  values ('user', uid, p_task, current_date, 1)
  on conflict (scope, subject, task, day) do update set used = q.used + 1
  returning used into u;
  insert into public.ai_quota as q (scope, subject, task, day, used)
  values ('org', cid, p_task, current_date, 1)
  on conflict (scope, subject, task, day) do update set used = q.used + 1
  returning used into o;
  if u > p_user_limit or o > p_org_limit then
    -- Refus : on rend l'appel réservé, le compteur reste au plafond.
    update public.ai_quota set used = used - 1 where scope = 'user' and subject = uid and task = p_task and day = current_date;
    update public.ai_quota set used = used - 1 where scope = 'org' and subject = cid and task = p_task and day = current_date;
    return false;
  end if;
  return true;
end;
$$;

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
         p.consent_ai and exists (select 1 from public.validations v where v.user_id = p.id and v.day > current_date - 28)
  from public.profiles p
  join public.habits h on h.user_id = p.id
  -- Sans plan cette semaine, ou avec le plan des règles calculé à une visite (« visite ») : la tâche du
  -- lundi le reformule avec le coach pour les personnes actives. Ses propres plans n'y reviennent pas.
  where not exists (select 1 from public.user_plans u
                    where u.user_id = p.id and u.week_start = date_trunc('week', current_date)::date
                      and not (u.source = 'regles' and coalesce(u.prompt_version, '') = 'visite'
                               and p.consent_ai
                               and exists (select 1 from public.validations v where v.user_id = p.id and v.day > current_date - 28)))
  order by p.id
  limit least(greatest(p_limit, 1), 100);
end;
$$;
