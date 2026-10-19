-- Scénario « jeu » (migration 0011) : quiz, graine mystère, défi collectif, duels, jardin.
-- À jouer après les autres scénarios, sur la même base.
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

-- 1. Quiz du jour ----------------------------------------------------------------------------
select pg_temp.check((select count(*) from quiz_questions) >= 20, 'au moins 20 questions');
select pg_temp.check(quiz_of_day(current_date) = quiz_of_day(current_date) and quiz_of_day(current_date) <> quiz_of_day(current_date + 1),
  'une question par jour, différente le lendemain');

select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check(not (today_quiz() ? 'answer'), 'la bonne réponse est cachée avant de répondre');
select pg_temp.check((select count(*) from quiz_questions) = 0, 'table des questions illisible directement');
reset role;
create temp table good as select answer from quiz_questions where id = quiz_of_day(current_date);
grant select on good to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.expect_error($$select answer_quiz(9)$$, '%invalid_choice%', 'choix hors liste refusé');
select pg_temp.check((answer_quiz((select answer from good)) ->> 'correct')::boolean, 'bonne réponse reconnue');
select pg_temp.check((today_quiz() ->> 'explanation') is not null, 'explication affichée après réponse');
select pg_temp.expect_error($$select answer_quiz(0)$$, '%already_answered%', 'une seule réponse par jour');
select pg_temp.check((select sum(points) from points_ledger where kind = 'quiz') = 5, 'bonne réponse : +5 pousses');
reset role;
select pg_temp.check(quest_done('00000000-0000-0000-0000-000000000004', 'quiz'), 'la quête « quiz » est faite');
select pg_temp.check(exists (select 1 from active_days('00000000-0000-0000-0000-000000000004') a where a = current_date), 'le quiz compte pour la série');
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select answer_quiz(((select answer from good) + 1) % 2);
select pg_temp.check(not (today_quiz() ->> 'correct')::boolean, 'mauvaise réponse : pas de pousses');
select pg_temp.check((today_quiz() ->> 'answers')::int = 2 and (today_quiz() ->> 'good')::int = 1, 'score des collègues : 1 sur 2');
select pg_temp.check(not exists (select 1 from points_ledger where kind = 'quiz'), 'aucun point pour Hugo');
reset role;

-- 2. Graine mystère ----------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.expect_error($$select open_seed()$$, '%no_seed%', 'pas de graine sans quêtes finies');
reset role;
insert into mystery_seeds (user_id, day) values
  ('00000000-0000-0000-0000-000000000004', current_date - 2),
  ('00000000-0000-0000-0000-000000000004', current_date - 1),
  ('00000000-0000-0000-0000-000000000004', current_date);
select pg_temp.check((open_seed_roll('00000000-0000-0000-0000-000000000004', 0.03) ->> 'plant') is not null, 'tirage < 8 % : plante rare');
select pg_temp.check((open_seed_roll('00000000-0000-0000-0000-000000000004', 0.15) ->> 'points')::int = 20, 'tirage < 20 % : +20');
select pg_temp.check((open_seed_roll('00000000-0000-0000-0000-000000000004', 0.90) ->> 'points')::int = 5, 'tirage courant : +5');
select pg_temp.check((select count(*) from garden_rares where user_id = '00000000-0000-0000-0000-000000000004') = 1, 'plante rare rangée dans le jardin');
select pg_temp.check((select sum(points) from points_ledger where kind = 'graine') = 25, 'graines : 20 + 5 pousses');
select pg_temp.expect_error($$select open_seed_roll('00000000-0000-0000-0000-000000000004', 0.5)$$, '%no_seed%', 'chaque graine ne s''ouvre qu''une fois');
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.expect_error($$select open_seed_roll(auth.uid(), 0.01)$$, '%permission%', 'impossible de choisir son tirage');
reset role;

-- 3. Défi collectif de la semaine --------------------------------------------------------------
select pg_temp.check(weekly_goal_kind(c.id, date '2026-10-12') <> weekly_goal_kind(c.id, date '2026-10-19'), 'le thème change chaque semaine')
from companies c where join_code = 'DEMO-2026';
select pg_temp.check(weekly_goal_target('repas', 2) = 15 and weekly_goal_target('repas', 100) = 180, 'objectif : plancher, puis 60 % × 3 par participant');

begin;
-- Pour le test, le thème de la semaine est forcé sur le scanner.
create or replace function public.weekly_goal_kind(p_company uuid, p_week date) returns text language sql immutable as $$ select 'scan' $$;
delete from product_swaps;
insert into product_swaps (user_id, company_id, from_code, to_code, created_at)
select '00000000-0000-0000-0000-000000000002', company_id, '30000000000' || g, '30000000001' || g, now()
from profiles, generate_series(10, 18) g where id = '00000000-0000-0000-0000-000000000002';
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check((my_weekly_goal() ->> 'progress')::int = 9 and not (my_weekly_goal() ->> 'reached')::boolean, '9 sur 10 : pas encore atteint');
reset role;
insert into product_swaps (user_id, company_id, from_code, to_code)
select '00000000-0000-0000-0000-000000000003', company_id, '3000000000099', '3000000000098'
from profiles where id = '00000000-0000-0000-0000-000000000003';
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check((my_weekly_goal() ->> 'gained')::int = 30, 'objectif atteint : +30 pour un contributeur');
select pg_temp.check((my_weekly_goal() ->> 'gained')::int = 0, 'une seule fois');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select pg_temp.check((my_weekly_goal() ->> 'gained')::int = 0 and (my_weekly_goal() ->> 'reached')::boolean, 'pas de récompense sans contribution');
reset role;
rollback;

-- 4. Duels -------------------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.expect_error($$select challenge_duel('00000000-0000-0000-0000-000000000004', 'scan')$$, '%invalid_opponent%', 'pas de duel contre soi-même');
select pg_temp.expect_error($$select challenge_duel('00000000-0000-0000-0000-000000000010', 'scan')$$, '%invalid_opponent%', 'pas de duel hors de l''entreprise');
select pg_temp.expect_error($$select challenge_duel('00000000-0000-0000-0000-000000000005', 'sieste')$$, '%invalid_duel%', 'type de duel inconnu refusé');
create temp table d1 as select (challenge_duel('00000000-0000-0000-0000-000000000005', 'scan', 2)).id;
select pg_temp.expect_error($$select challenge_duel('00000000-0000-0000-0000-000000000005', 'repas')$$, '%duel_exists%', 'un seul duel à la fois entre deux personnes');
select pg_temp.expect_error($$select answer_duel((select id from d1), true)$$, '%duel_not_found%', 'seul l''adversaire répond');
reset role;
grant select on d1 to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.check((my_duels() -> 0 ->> 'status') = 'pending' and (my_duels() -> 0 ->> 'other_name') is not null, 'Hugo voit l''invitation');
select pg_temp.check((answer_duel((select id from d1), true)).status = 'active', 'duel accepté');
reset role;
-- Sofia fait 2 meilleurs choix, Hugo 1 : le duel continue (les 7 jours ne sont pas finis).
insert into product_swaps (user_id, company_id, from_code, to_code)
select p.id, p.company_id, '30000000002' || g, '30000000003' || g
from profiles p, generate_series(10, 11) g where p.id = '00000000-0000-0000-0000-000000000004';
insert into product_swaps (user_id, company_id, from_code, to_code)
select id, company_id, '3000000000420', '3000000000421' from profiles where id = '00000000-0000-0000-0000-000000000005';
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check((my_duels() -> 0 ->> 'status') = 'active' and (my_duels() -> 0 ->> 'mine')::int = 2
  and (my_duels() -> 0 ->> 'theirs')::int = 1, 'progression des deux côtés');
reset role;
-- Fin des 7 jours : seule Sofia a réussi.
update duels set starts_on = current_date - 8, ends_on = current_date - 2 where id = (select id from d1);
update product_swaps set created_at = now() - interval '5 days'
where user_id in ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000005') and from_code like '3000000000%';
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.check((my_duels() -> 0 ->> 'winner') = 'challenger', 'Sofia gagne le duel');
reset role;
select pg_temp.check((select points from points_ledger where kind = 'duel' and user_id = '00000000-0000-0000-0000-000000000004') = 40,
  'gagnante seule : +40');
select pg_temp.check(not exists (select 1 from points_ledger where kind = 'duel' and user_id = '00000000-0000-0000-0000-000000000005'),
  'personne ne perd de pousses');
-- Deux réussites : +25 chacun, et le duel se termine dès que les deux ont atteint l'objectif.
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
create temp table d2 as select (challenge_duel('00000000-0000-0000-0000-000000000007', 'scan', 1)).id;
reset role;
update duels set status = 'active', starts_on = current_date, ends_on = current_date + 6 where id = (select id from d2);
insert into product_swaps (user_id, company_id, from_code, to_code)
select id, company_id, '3000000000600', '3000000000601' from profiles
where id in ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000007');
select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
select pg_temp.check((my_duels() -> 0 ->> 'winner') = 'both', 'les deux ont réussi');
reset role;
select pg_temp.check((select sum(points) from points_ledger where kind = 'duel' and ref_id = (select id from d2)) = 50, '+25 chacun');
-- Invitation sans réponse : expirée après 3 jours.
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
create temp table d3 as select (challenge_duel('00000000-0000-0000-0000-000000000002', 'repas')).id;
reset role;
update duels set created_at = now() - interval '4 days' where id = (select id from d3);
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select pg_temp.check(my_duels() @> '[{"status": "expired"}]', 'invitation expirée');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from duels) = 0, 'les duels des autres sont invisibles');
reset role;

-- 5. Jardin ------------------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.check((garden('00000000-0000-0000-0000-000000000004') -> 'counts' ->> 'quiz')::int = 1, 'jardin d''une collègue : 1 bonne réponse');
select pg_temp.check(jsonb_array_length(garden('00000000-0000-0000-0000-000000000004') -> 'rares') = 1, 'sa plante rare est visible');
select pg_temp.check((garden('00000000-0000-0000-0000-000000000004') -> 'exploits' ->> 'duel')::boolean, 'exploit : duel gagné');
select pg_temp.expect_error($$select garden('00000000-0000-0000-0000-000000000010')$$, '%not_found%', 'pas de jardin hors de l''entreprise');
reset role;

-- 6. Quêtes : la graine arrive avec le bonus du jour --------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
reset role;
delete from daily_quests where user_id = '00000000-0000-0000-0000-000000000006';
insert into daily_quests (user_id, day, quests) values ('00000000-0000-0000-0000-000000000006', current_date, array['meilleur_choix']);
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select pg_temp.check((claim_daily_rewards() -> 'seed' ->> 'state') = 'ready', 'quêtes finies : une graine à ouvrir');
select pg_temp.check((open_seed() ->> 'points') is not null, 'la graine s''ouvre');
select pg_temp.check((claim_daily_rewards() -> 'seed' ->> 'state') = 'opened', 'puis elle est marquée ouverte');
reset role;

\echo 'Tous les tests du scénario jeu sont passés.'
