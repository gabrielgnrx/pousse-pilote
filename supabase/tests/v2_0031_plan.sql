-- Scénario v2 (migration 0031) : Mon plan, faisabilité, semaine écoulée, tâche du lundi.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
create function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;
create function pg_temp.as_nobody() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
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

-- 1. Un plan fait de défis reliés à des facteurs : accepté et relu par la personne seulement.
select pg_temp.as_user('00000000-0000-0000-0000-000000000281');
select save_my_plan('[{"template_id": "velo", "variant": "base", "kg_year": 412.6, "signal": "nouveau",
                       "reason": "Tes 12 km en voiture : ton plus gros levier."},
                      {"template_id": "vege", "variant": "boeuf", "kg_year": 600, "signal": "sur_sa_lancee",
                       "reason": "Déjà 2 repas végé : continue."}]', 'ia', 'plan-coach@1');
select pg_temp.check((select jsonb_array_length(items) = 2 and (items->0->>'kg_year')::numeric = 413 and source = 'ia'
                      from user_plans where user_id = auth.uid()), 'plan enregistré, kg arrondis');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check(not exists (select 1 from user_plans where user_id = '00000000-0000-0000-0000-000000000281'),
                     'le plan d''un collègue est invisible');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000281');

-- 2. Jamais un défi sans facteur, jamais un défi inventé, jamais un plan vide ou démesuré.
select pg_temp.expect_error($$select save_my_plan('[{"template_id": "escaliers", "variant": "base", "kg_year": 0, "signal": "nouveau", "reason": "Pas de facteur."}]', 'ia')$$,
                            '%invalid_plan_item%', 'défi sans facteur d''émission : refusé');
select pg_temp.expect_error($$select save_my_plan('[{"template_id": "fusee", "variant": "base", "kg_year": 5, "signal": "nouveau", "reason": "Inventé."}]', 'ia')$$,
                            '%invalid_plan_item%', 'défi inventé : refusé');
select pg_temp.expect_error($$select save_my_plan('[]', 'ia')$$, '%invalid_plan%', 'plan vide : refusé');
select pg_temp.expect_error($$select save_my_plan('[{"template_id": "velo", "variant": "base", "kg_year": 5, "signal": "nouveau", "reason": ""}]', 'ia')$$,
                            '%invalid_plan_item%', 'défi sans explication : refusé');

-- 3. Faisabilité déclarée, relue dans les entrées du plan.
select set_feasibility('covoiturage', 'impossible');
select pg_temp.check((my_plan_inputs()->'feasibility'->>'covoiturage') = 'impossible', 'faisabilité enregistrée');
select pg_temp.expect_error($$select set_feasibility('velo', 'peut-être')$$, '%', 'niveau de faisabilité contrôlé');

-- 4. Semaine écoulée : un défi abandonné est daté.
insert into user_challenges (user_id, company_id, template_id, variant, target, ends_on)
select auth.uid(), company_id, 'chauffage', 'base', 2, current_date + 13 from profiles where id = auth.uid();
update user_challenges set status = 'abandoned' where user_id = auth.uid() and template_id = 'chauffage';
reset role;
select pg_temp.check((select abandoned_at is not null from user_challenges
                      where user_id = '00000000-0000-0000-0000-000000000281' and template_id = 'chauffage'),
                     'abandon daté');
-- Ramené à la semaine dernière, il apparaît dans le bilan de la semaine.
update user_challenges set abandoned_at = date_trunc('week', now()) - interval '2 days'
 where user_id = '00000000-0000-0000-0000-000000000281' and template_id = 'chauffage';
select pg_temp.check(plan_week_stats('00000000-0000-0000-0000-000000000281')->'abandoned' ? 'chauffage',
                     'semaine écoulée : défi abandonné');

-- 5. Tâche du lundi : clé obligatoire, personnes sans plan, enregistrement validé.
-- (La faisabilité changée au point 3 a effacé le plan de Nora : on le refait.)
select pg_temp.as_user('00000000-0000-0000-0000-000000000281');
select save_my_plan('[{"template_id": "velo", "variant": "base", "kg_year": 400, "signal": "nouveau", "reason": "Ton plus gros levier."}]', 'regles');
reset role;
select pg_temp.as_nobody();
select pg_temp.expect_error($$select * from plan_pending('mauvaise-cle-mauvaise-cle-mauvaise-cle')$$, '%not_allowed%', 'lot sans clé : refusé');
select pg_temp.check(not exists (select 1 from plan_pending('cle-ia-de-test-assez-longue-pour-passer-0123456789', 100)
                                 where user_id = '00000000-0000-0000-0000-000000000281'),
                     'lot : la personne qui a déjà son plan n''y est pas');
create temp table pending as select * from plan_pending('cle-ia-de-test-assez-longue-pour-passer-0123456789', 100);
select pg_temp.check((select count(*) > 0 and bool_and(habits ? 'commute_km') and bool_and(not habits ? 'user_id') from pending),
                     'lot : habitudes sans identifiant');
select save_plan_for('cle-ia-de-test-assez-longue-pour-passer-0123456789', (select user_id from pending limit 1),
                     '[{"template_id": "velo", "variant": "base", "kg_year": 100, "signal": "nouveau", "reason": "Plan des règles."}]', 'regles');
reset role;
select pg_temp.check((select source = 'regles' from user_plans where user_id = (select user_id from pending limit 1)),
                     'lot : plan enregistré par la tâche planifiée');
select set_config('request.jwt.claim.sub', '', false);

-- 6. Changer la faisabilité efface le plan de la semaine (recalculé à la visite suivante).
select pg_temp.as_user('00000000-0000-0000-0000-000000000281');
select set_feasibility('velo', 'difficile');
select pg_temp.check(not exists (select 1 from user_plans where user_id = auth.uid()), 'faisabilité changée : plan à recalculer');
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- 7. Un plan des règles calculé à une visite est repris par la tâche du lundi (personne active).
select pg_temp.as_user('00000000-0000-0000-0000-000000000281');
select save_my_plan('[{"template_id": "velo", "variant": "base", "kg_year": 400, "signal": "nouveau", "reason": "Plan des règles."}]', 'regles', 'visite');
reset role;
select pg_temp.as_nobody();
select pg_temp.check(exists (select 1 from plan_pending('cle-ia-de-test-assez-longue-pour-passer-0123456789', 100)
                             where user_id = '00000000-0000-0000-0000-000000000281'),
                     'plan de visite : repris par la tâche du lundi');
reset role;
select set_config('request.jwt.claim.sub', '', false);
