-- Scénario « engagement » (migration 0005), à jouer juste après scenario.sql sur la même base.
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

-- 1. Défis expert, identiques au TypeScript (engagement.test.ts).
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check(round(unit_kg('vegetalien', 'base', h), 2) = 0.31, 'végétalien : 0,85 − 0,54') from habits h;
select pg_temp.check(unit_kg('vacances_train', 'base', h) = 0, 'vacances en train : pas de long-courrier déclaré') from habits h;
select pg_temp.check(unit_kg('reparation', 'smartphone', h) = 80.2, 'réparation smartphone : 80,2 kg') from habits h;
select pg_temp.check(unit_kg('reparation', 'ordinateur', h) = 0, 'réparation ordinateur : aucun achat déclaré') from habits h;
select pg_temp.check(kept_habits(h) = array['repas_vege', 'sans_avion'], 'habitudes à garder de Gabriel') from habits h;

-- 2. Garder le cap : 10 points, une fois par semaine et par habitude, seulement si l'habitude est déclarée.
select pg_temp.check(k.habit = 'repas_vege', 'garder le cap : repas végé') from keep_habit('repas_vege') k;
select pg_temp.check((select sum(points) from points_ledger) = 10, '10 points de maintien');
select pg_temp.expect_error($$select keep_habit('repas_vege')$$, 'already_kept', 'une seule fois par semaine');
select pg_temp.expect_error($$select keep_habit('trajet_doux')$$, 'not_kept_habit', 'habitude non déclarée refusée');
do $$ begin
  insert into points_ledger (user_id, company_id, kind, points, ref_id)
  values (auth.uid(), my_company_id(), 'maintien', 1000, gen_random_uuid());
  raise exception 'ÉCHEC : points écrits directement';
exception when insufficient_privilege then raise notice 'ok : points non inscriptibles directement';
end $$;

-- 3. Gabriel publie un repas végé avec photo : visible dans le fil.
select pg_temp.check(v.visibility = 'company' and v.status = 'valid', 'publication de Gabriel')
from validate_challenge_day('10000000-0000-0000-0000-000000000003', 1,
  '00000000-0000-0000-0000-000000000001/repas2.jpg', null, 'Lentilles', 'company') v;
reset role;

-- 4. Léa relève le défi grâce à cette publication ; Hugo est déjà sobre.
insert into habits values ('00000000-0000-0000-0000-000000000003', 'voiture_seul', 10, 4, 2, 4, 1, 0, 10, true, 'gaz', 500, now(), 0);
insert into habits values ('00000000-0000-0000-0000-000000000005', 'velo', 5, 5, 0, 0, 0, 0, 2, false, 'pompe_a_chaleur', 30, now(), 0);
insert into habits values ('00000000-0000-0000-0000-000000000006', 'voiture_seul', 10, 4, 2, 4, 0, 0, 10, true, 'gaz', 500, now(), 0);

select id as private_id from validations
where user_id = '00000000-0000-0000-0000-000000000001' and visibility = 'private' and status = 'valid' limit 1 \gset
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.expect_error(format($$
  insert into user_challenges (user_id, company_id, template_id, variant, target, ends_on, inspired_by)
  values (auth.uid(), my_company_id(), 'vege', 'boeuf', 5, current_date + 7, %L)$$, :'private_id'),
  '%row-level security%', 'impossible de citer une validation privée');
insert into user_challenges (id, user_id, company_id, template_id, variant, target, ends_on, inspired_by)
select '20000000-0000-0000-0000-000000000001', auth.uid(), my_company_id(), 'vege', 'boeuf', 5, current_date + 7, v.id
from validations v where v.caption = 'Lentilles';
select validate_challenge_day('20000000-0000-0000-0000-000000000001', 1,
  null, '00000000-0000-0000-0000-000000000004', null, 'company');
reset role;
select pg_temp.check((select points from points_ledger where kind = 'influence'
                      and user_id = '00000000-0000-0000-0000-000000000001') = 15,
  'influence : Gabriel gagne 15 points');

-- 5. Le témoin confirme : 3 points pour lui.
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select respond_witness(id, true) from validations where witness_status = 'pending';
select pg_temp.check((select sum(points) from points_ledger) = 3, 'témoin : 3 points');
reset role;

-- 6. Inès relève aussi, mais son témoin refuse : l'influence correspondante est retirée.
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
insert into user_challenges (id, user_id, company_id, template_id, variant, target, ends_on, inspired_by)
select '20000000-0000-0000-0000-000000000002', auth.uid(), my_company_id(), 'vege', 'boeuf', 5, current_date + 7, v.id
from validations v where v.caption = 'Lentilles';
select validate_challenge_day('20000000-0000-0000-0000-000000000002', 1,
  null, '00000000-0000-0000-0000-000000000004', null, 'company');
reset role;
select pg_temp.check((select count(*) from points_ledger where kind = 'influence') = 2, 'deux influences créditées');
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select respond_witness(id, false) from validations where witness_status = 'pending';
reset role;
select pg_temp.check((select count(*) from points_ledger where kind = 'influence') = 1, 'refus du témoin : influence retirée');

-- 7. Influence agrégée vue par Gabriel.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check(i.challenges = 2 and i.colleagues = 2 and i.kg = 4.1, 'mon influence : 2 défis, 4,1 kg')
from my_influence() i;
reset role;

-- 8. Hugo garde le cap sur ses trajets à vélo : il marque des points sans CO₂ évité.
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.check(kept_habits(h) @> array['trajet_doux', 'repas_vege', 'sans_avion', 'peu_de_neuf', 'telephone_garde'],
  'Hugo : cinq habitudes à garder') from habits h;
select keep_habit('trajet_doux');
-- Classement en pousses, Data (6 personnes) — pas de pousses sans preuve (0009) :
--   Gabriel 2 trajets sans preuve (0) + repas avec photo (15) + garder le cap (10) + influence de Léa (15) = 40
--   Léa repas confirmé par témoin (15) ; témoin 3 ; Hugo 10 ; Inès 0 (refusée) ; une personne inactive.
--   Total 68 → 11,3 pousses par participant, 4 actifs.
select pg_temp.check(s.team_name = 'Data' and s.points = 68 and s.points_per_person = 11.3
                     and s.active = 4 and s.is_mine,
  'classement : pousses par participant, inactifs à 0') from team_stats() s;
select pg_temp.expect_error($$select member_points('00000000-0000-0000-0000-000000000001', null)$$,
  'permission denied%', 'points d''un collègue non consultables');
reset role;

-- 9. Objectif collectif : celui de l'entreprise, 30 kg × 7 participants, en kg réellement évités.
select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
select pg_temp.check(g.name = 'Entreprise démo' and g.participants = 7 and g.goal_kg = 210
                     and g.kg = round(1.327 + 4.12 + 4.12, 1), 'objectif de l''entreprise : 210 kg')
from collective_goal() g;
reset role;

-- 10. Quêtes du jour (0009) : 3 quêtes tirées pour la journée, la première est toujours liée aux défis.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check(jsonb_array_length(r->'order') = 3 and r->'order'->>0 = 'preuve'
                     and (r->'quests'->>'preuve')::boolean,
  'quêtes : 3 tirées, « défi avec preuve » en premier et déjà faite') from claim_daily_rewards() r;
select pg_temp.check((select quests from daily_quests) = (select array(select jsonb_array_elements_text(claim_daily_rewards()->'order'))),
  'quêtes figées pour la journée');
select pg_temp.check((select not ('lancer' = any (quests)) from daily_quests), 'pas « lancer un défi » quand on en a déjà');
reset role;
-- Toutes les quêtes du jour faites : +15, une seule fois.
update daily_quests set quests = array['preuve', 'cap', 'scan'] where user_id = '00000000-0000-0000-0000-000000000001';
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check(not (claim_daily_rewards()->>'quest_done')::boolean, 'scan pas encore fait : pas de bonus');
insert into product_scans (user_id, company_id, code, name) values (auth.uid(), my_company_id(), '3017620422003', 'Test');
select pg_temp.check((r->>'gained')::int = 15 and (r->>'quest_done')::boolean, 'trois quêtes faites : +15') from claim_daily_rewards() r;
select pg_temp.check((claim_daily_rewards()->>'gained')::int = 0, 'bonus crédité une seule fois');
reset role;

-- Garder le cap : au plus 2 habitudes récompensées par semaine (20 pousses).
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select keep_habit('repas_vege');
select keep_habit('peu_de_neuf');
select pg_temp.check((select sum(points) from points_ledger where kind = 'maintien') = 20,
  'garder le cap : 3 habitudes confirmées, 20 pousses');
reset role;
delete from habit_checkins where user_id = '00000000-0000-0000-0000-000000000005' and habit in ('repas_vege', 'peu_de_neuf');
delete from points_ledger where user_id = '00000000-0000-0000-0000-000000000005' and kind = 'maintien'
  and ref_id not in (select id from habit_checkins);

-- Hugo a été actif aujourd'hui, hier et avant-hier : série de 3 jours, +10.
insert into habit_checkins (user_id, company_id, habit, week_start, created_at)
select '00000000-0000-0000-0000-000000000005', company_id, 'sans_avion', date '2020-01-06', now() - interval '1 day'
from profiles where id = '00000000-0000-0000-0000-000000000005';
insert into habit_checkins (user_id, company_id, habit, week_start, created_at)
select '00000000-0000-0000-0000-000000000005', company_id, 'sans_avion', date '2020-01-13', now() - interval '2 days'
from profiles where id = '00000000-0000-0000-0000-000000000005';
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.check((r->>'streak')::int = 3 and (r->>'gained')::int = 10, 'série de 3 jours : +10 pousses')
from claim_daily_rewards() r;
select pg_temp.check((select sum(points) from points_ledger) = 20, 'Hugo : 10 (cap) + 10 (série)');
select pg_temp.expect_error($$select day_streak(auth.uid())$$, 'permission denied%', 'série d''un autre non consultable');
reset role;

-- 11. Scanner (0008) : +5 pousses par meilleur choix, 3 fois par jour, jamais pour un moins bon.
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
insert into product_scans (user_id, company_id, code, name, grade, co2_kg_per_kg)
values (auth.uid(), my_company_id(), '3017620422003', 'Pâte à tartiner', 'e', 5.2);
select pg_temp.expect_error($$select record_swap('3017620422003', '3000000000002', 'b', 'd', 1, 1)$$,
  'not_better', 'alternative moins bien notée refusée');
select pg_temp.check((record_swap('3017620422003', '3000000000002', 'e', 'b', 5.2, 2.1)->>'points')::int = 5,
  'meilleur choix : +5 pousses');
select pg_temp.expect_error($$select record_swap('3017620422003', '3000000000002', 'e', 'b', 5.2, 2.1)$$,
  'already_swapped', 'même choix une seule fois par jour');
select record_swap('3017620422003', '3000000000003', 'e', 'a', 5.2, 1.0);
select pg_temp.check((record_swap('3017620422003', '3000000000004', 'c', 'c', 2.0, 1.0)->>'remaining')::int = 0,
  'même note mais deux fois moins de CO₂ : accepté');
select pg_temp.expect_error($$select record_swap('3017620422003', '3000000000005', 'e', 'a', 5, 1)$$,
  'swap_cap', 'au plus 3 meilleurs choix par jour');
select pg_temp.check((select sum(points) from points_ledger where kind = 'scan') = 15, '3 × 5 pousses');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select pg_temp.expect_error($$select record_swap('3017620422003', '3000000000009', null, 'c', null, 1)$$,
  'not_better', 'produit non noté : une alternative C ne compte pas');
select pg_temp.check((record_swap('3017620422003', '3000000000009', null, 'b', null, null)->>'points')::int = 5,
  'produit non noté : une alternative B compte');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from product_scans) = 1, 'historique des scans personnel');
do $$ begin
  insert into points_ledger (user_id, company_id, kind, points, ref_id)
  values (auth.uid(), my_company_id(), 'scan', 500, gen_random_uuid());
  raise exception 'ÉCHEC : pousses écrites directement';
exception when insufficient_privilege then raise notice 'ok : pousses de scan non inscriptibles directement';
end $$;
reset role;

\echo 'Tous les tests du scénario engagement sont passés.'
