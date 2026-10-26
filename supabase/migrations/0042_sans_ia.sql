-- 0042 — Pousse sans IA (octobre 2026).
--
-- Décision produit du 26/10/2026 : l'application n'utilise plus d'IA. Ce qui fonctionnait déjà sans
-- elle reste (saisie libre par règles, plan par règles, animateur à messages préparés, rapport écrit
-- par règles). Cette migration retire de la base ce qui ne servait qu'à l'IA :
--   - les tâches planifiées du coach du lundi et du quiz de la semaine ;
--   - le journal, les quotas et le cache des appels (ai_calls, ai_quota, ai_cache) ;
--   - la vérification des justificatifs par vision : un justificatif redevient une preuve déposée,
--     privée, effacée au bout de 30 jours ; les pousses mises de côté en attente d'une nouvelle photo
--     sont rendues ;
--   - le quiz de la semaine généré, les rapports enregistrés, le refus de l'IA par salarié.
-- La clé des tâches planifiées (nommée « ia » dans cron_keys et « pousse_ia » dans Vault) reste :
-- l'animateur du QG s'en sert toujours.

-- 1. Tâches planifiées (Supabase seulement : rien à faire hors Supabase).
do $$
begin
  if to_regclass('cron.job') is not null then
    execute $q$select cron.unschedule(jobid) from cron.job where jobname in ('pousse-plan', 'pousse-quiz')$q$;
  end if;
end;
$$;

-- 2. Justificatifs : plus de verdict. Les pousses mises de côté reviennent, puis le suivi disparaît.
update public.validations v
   set points = v.points + coalesce((select pc.points_withheld from public.proof_checks pc
                                     where pc.validation_id = v.id order by pc.checked_at desc limit 1), 0)
 where v.proof_status = 'needs_review';
drop trigger if exists validations_proof_pending on public.validations;
drop function if exists public.mark_proof_pending();
drop function if exists public.record_proof_verdict(uuid, text, text, text, text);
drop function if exists public.resubmit_proof(uuid, text);
drop table if exists public.proof_checks;
alter table public.validations drop column if exists proof_status;

-- 3. Quiz de la semaine généré.
drop function if exists public.week_quiz();
drop function if exists public.answer_week_quiz(bigint, integer);
drop function if exists public.quiz_week_insert(text, date, jsonb, text);
drop table if exists public.quiz_week_answers;
drop table if exists public.quiz_week_questions;

-- 4. Mon plan : calculé par les règles à la visite ; plus de lot du lundi.
drop function if exists public.plan_pending(text, integer);
drop function if exists public.save_plan_for(text, uuid, jsonb, text, text);
update public.user_plans set source = 'regles', prompt_version = null where source <> 'regles';
alter table public.user_plans drop constraint if exists user_plans_source_check;
alter table public.user_plans add constraint user_plans_source_check check (source = 'regles');

-- 5. Rapport mensuel : calculé à l'affichage, plus enregistré.
drop function if exists public.admin_save_report(uuid, date, jsonb, text, text);
drop table if exists public.monthly_reports;

-- 6. Journal, quotas et cache de l'IA.
drop function if exists public.admin_ai_log(uuid, text, text, text, text, integer, integer, integer, integer, numeric, text);
drop function if exists public.admin_ai_consume(uuid, text, integer);
drop function if exists public.ai_log_service(uuid, text, text, text, text, integer, integer, integer, integer, numeric, text);
drop function if exists public.ai_log(text, text, text, text, integer, integer, integer, integer, numeric, text, text, uuid);
drop function if exists public.ai_consume(text, integer, integer);
drop function if exists public.ai_cache_get(text);
drop function if exists public.ai_cache_put(text, text, jsonb, integer);

create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

drop table if exists public.ai_calls;
drop table if exists public.ai_quota;
drop table if exists public.ai_cache;

-- 7. Refus de l'IA par salarié : sans objet.
alter table public.profiles drop column if exists consent_ai;

-- 8. Tableau de bord RSE sans la ligne « coût de l'IA ».
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
              from public.team_scores(p_company, null) s));
end;
$$;
revoke all on function public.admin_dashboard(uuid) from public;
grant execute on function public.admin_dashboard(uuid) to authenticated;
