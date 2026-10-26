-- Scénario v2 (migration 0039) : l'IA de l'espace admin est journalisée au nom de l'organisation, avec un quota.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
create function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;
create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'ÉCHEC : %', label; end if;
  raise notice 'ok : %', label;
end $$;
create function pg_temp.expect_error(stmt text, expected text, label text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'ÉCHEC : % (aucune erreur)', label;
exception when others then
  if sqlerrm not like expected then raise; end if;
  raise notice 'ok : %', label;
end $$;
set client_min_messages = notice;

-- Scénario v2 (migration 0042) : plus rien de l'IA en base ; le reste fonctionne comme avant.
select pg_temp.check(to_regclass('public.ai_calls') is null and to_regclass('public.ai_quota') is null
                     and to_regclass('public.ai_cache') is null and to_regclass('public.proof_checks') is null
                     and to_regclass('public.quiz_week_questions') is null and to_regclass('public.monthly_reports') is null,
                     'tables de l''IA retirées');
select pg_temp.check(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                 where n.nspname = 'public' and p.proname in ('ai_log', 'ai_consume', 'ai_cache_get', 'ai_cache_put',
                                   'ai_log_service', 'admin_ai_log', 'admin_ai_consume', 'record_proof_verdict', 'resubmit_proof',
                                   'plan_pending', 'save_plan_for', 'week_quiz', 'answer_week_quiz', 'quiz_week_insert', 'admin_save_report')),
                     'fonctions de l''IA retirées');
select pg_temp.check(not exists (select 1 from information_schema.columns where table_schema = 'public'
                                 and ((table_name = 'validations' and column_name = 'proof_status')
                                   or (table_name = 'profiles' and column_name = 'consent_ai'))),
                     'colonnes de l''IA retirées');
select pg_temp.check(exists (select 1 from cron_keys where name = 'ia'), 'clé des tâches planifiées gardée pour l''animateur');

-- Un train avec son billet : enregistré, pousses acquises, billet gardé privé (effacé à 30 jours).
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000421', 'ines@demo.fr');
select pg_temp.as_user('00000000-0000-0000-0000-000000000421');
select join_company('DEMO-2026', (select id from teams where name = 'Data' and company_id = (select id from companies where join_code = 'DEMO-2026')), 'Inès', true, true);
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into habits (user_id, commute_mode, commute_km, commute_days, beef_meals_week, other_meat_meals_week,
                    short_flights_year, long_flights_year, new_clothes_year, buys_new_phone, heating, heating_kg_year)
values ('00000000-0000-0000-0000-000000000421', 'voiture_seul', 10, 3, 2, 3, 2, 0, 10, false, 'gaz', 1200);
select pg_temp.as_user('00000000-0000-0000-0000-000000000421');
create temp table t42 as select log_action_slug('train', 300, '00000000-0000-0000-0000-000000000421/billet.jpg') as j;
grant select on t42 to public;
select pg_temp.check((select (j->>'points')::int > 0 and (j->>'kg')::numeric > 0 and (j->>'receipt')::boolean from t42),
                     'train avec billet : CO₂ et pousses comptés tout de suite');
select pg_temp.expect_error($$select log_action_slug('train', 300)$$, '%receipt_required%', 'train sans billet : refusé');

-- Mon plan : seul le plan des règles s'enregistre.
reset role;
select pg_temp.expect_error($$insert into user_plans (user_id, company_id, week_start, items, source)
                              select id, company_id, current_date, '[]', 'ia' from profiles where id = '00000000-0000-0000-0000-000000000421'$$,
                            '%user_plans_source_check%', 'plan « ia » : refusé');
select pg_temp.as_user('00000000-0000-0000-0000-000000000421');

-- Suppression de compte : toujours effective.
select delete_my_account();
reset role;
select pg_temp.check(not exists (select 1 from profiles where id = '00000000-0000-0000-0000-000000000421'), 'compte supprimé');

-- Tableau de bord : plus de ligne « IA ».
create temp table d42 as select id from companies where join_code = 'DEMO-2026';
grant select on d42 to public;
select pg_temp.as_user('00000000-0000-0000-0000-000000000381');
select pg_temp.check((select not (admin_dashboard((select id from d42)) ? 'ai')), 'tableau de bord sans coût de l''IA');
reset role;
select set_config('request.jwt.claim.sub', '', false);
