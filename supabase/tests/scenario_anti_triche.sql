-- Scénario « moins de triche, un bilan stable » (migration 0025), à jouer en dernier, sur la même base.
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

-- La personne 4 : en voiture 2 jours par semaine, un bilan fait il y a 3 jours.
delete from validations where user_id = '00000000-0000-0000-0000-000000000004';
delete from user_challenges where user_id = '00000000-0000-0000-0000-000000000004';
delete from footprints where user_id = '00000000-0000-0000-0000-000000000004';
insert into footprints (user_id, answers, total_kg, by_category, created_at)
values ('00000000-0000-0000-0000-000000000004', '{}', 6000, '{}', now() - interval '3 days');
insert into habits (user_id, commute_mode, commute_km, commute_days, beef_meals_week, other_meat_meals_week,
                    short_flights_year, long_flights_year, new_clothes_year, buys_new_phone, heating, heating_kg_year)
values ('00000000-0000-0000-0000-000000000004', 'voiture_seul', 10, 2, 2, 2, 0, 0, 5, false, 'gaz', 800)
on conflict (user_id) do update set commute_mode = 'voiture_seul', commute_days = 2;

select pg_temp.as_user('00000000-0000-0000-0000-000000000004');

-- 1. Un défi ne se modifie plus, il s'annule seulement.
insert into user_challenges (id, user_id, company_id, template_id, variant, target, starts_on, ends_on)
select 'e0000000-0000-0000-0000-000000000001', id, company_id, 'vege', 'base', 5, current_date, current_date + 6
from profiles where id = auth.uid();
select pg_temp.expect_error($$update user_challenges set target = 1 where id = 'e0000000-0000-0000-0000-000000000001'$$,
                            '%challenge_locked%', 'objectif baissé après coup : refusé');
select pg_temp.expect_error($$update user_challenges set ends_on = current_date + 90 where id = 'e0000000-0000-0000-0000-000000000001'$$,
                            '%challenge_locked%', 'durée allongée après coup : refusée');
select pg_temp.expect_error($$update user_challenges set status = 'done' where id = 'e0000000-0000-0000-0000-000000000001'$$,
                            '%', 'se déclarer « réussi » soi-même : refusé');
update user_challenges set status = 'abandoned' where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.check((select status = 'abandoned' from user_challenges where id = 'e0000000-0000-0000-0000-000000000001'),
                     'annuler un défi : possible');
select pg_temp.expect_error($$update user_challenges set status = 'active' where id = 'e0000000-0000-0000-0000-000000000001'$$,
                            '%', 'réactiver un défi annulé : refusé');

-- 2. Plafond de la semaine calé sur le bilan : 2 jours de bureau = 4 trajets.
reset role;
-- 4 trajets déjà enregistrés cette semaine (lundi).
insert into validations (user_id, company_id, team_id, template_id, variant, day, units, kg, points, witness_status, proof_level, visibility)
select p.id, p.company_id, p.team_id, 'transports', 'base', date_trunc('week', current_date)::date, 4, 0, 40, 'none', 0, 'private'
from profiles p where p.id = '00000000-0000-0000-0000-000000000004';
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.expect_error($$select log_action('velo', 'base')$$, '%_cap_reached%', '2 jours de bureau déclarés : pas de 5e trajet cette semaine');

-- 3. Le bilan se refait une fois tous les 30 jours.
select pg_temp.expect_error($$insert into footprints (user_id, answers, total_kg, by_category) values (auth.uid(), '{}', 9000, '{}')$$,
                            '%bilan_locked%', 'nouveau bilan 3 jours après : refusé');
select pg_temp.expect_error($$update habits set commute_km = 80 where user_id = auth.uid()$$,
                            '%bilan_locked%', 'habitudes modifiées sans bilan : refusé');
reset role;
update footprints set created_at = now() - interval '31 days' where user_id = '00000000-0000-0000-0000-000000000004';
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
insert into footprints (user_id, answers, total_kg, by_category) values (auth.uid(), '{}', 7000, '{}');
update habits set commute_km = 12 where user_id = auth.uid();
select pg_temp.check((select commute_km = 12 from habits where user_id = auth.uid()), 'après 30 jours : nouveau bilan et habitudes mises à jour');

-- 4 et 5. Fonctions retirées.
select pg_temp.expect_error($$select keep_habit('repas_vege')$$, '%permission denied%', 'garder le cap : fermé');
select pg_temp.expect_error($$select validate_challenge_day(gen_random_uuid(), 1, null, null, null, 'private')$$,
                            '%permission denied%', 'ancienne validation : fermée');
reset role;
delete from daily_quests where user_id = '00000000-0000-0000-0000-000000000005';
select pg_temp.check(not ('cap' = any (todays_quests('00000000-0000-0000-0000-000000000005'))), 'plus de quête « Garde le cap »');
