-- Scénario « duels avec enjeu » (migration 0016), à jouer en dernier.
-- Personnes 1 à 6 : équipe Data ; personne 7 : équipe Finance.
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
create function pg_temp.total(uid uuid) returns integer language sql as $$ select member_points(uid, null) $$;
set client_min_messages = notice;

-- On repart sans duel en cours.
update duels set status = 'done' where status in ('pending', 'active');
-- La personne 7 roule seule en voiture (le vélo est donc faisable pour elle) et a 15 pousses de côté.
insert into habits (user_id, commute_mode, commute_km, commute_days, beef_meals_week, other_meat_meals_week,
                    short_flights_year, long_flights_year, new_clothes_year, buys_new_phone, heating, heating_kg_year)
values ('00000000-0000-0000-0000-000000000007', 'voiture_seul', 10, 4, 2, 2, 0, 0, 5, false, 'gaz', 800)
on conflict (user_id) do update set commute_mode = 'voiture_seul', commute_km = 10;
insert into points_ledger (user_id, company_id, kind, points, ref_id)
select id, company_id, 'quete', 15, gen_random_uuid() from profiles where id = '00000000-0000-0000-0000-000000000007';
create temp table base as select pg_temp.total('00000000-0000-0000-0000-000000000007') as p7;
grant select on base to authenticated;

-- 1. Un duel se lance contre une autre équipe seulement.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.expect_error($$select challenge_duel('00000000-0000-0000-0000-000000000002', 'repas', 3)$$, '%same_team%', 'pas de duel dans sa propre équipe');
insert into user_challenges (id, user_id, company_id, template_id, variant, target, starts_on, ends_on)
select 'd0000000-0000-0000-0000-000000000001', id, company_id, 'velo', 'base', 25, current_date, current_date + 29
from profiles where id = auth.uid();
select pg_temp.check(d.kind = 'action' and d.template_id = 'velo' and d.target = 10 and d.stakes,
                     'défi lancé en duel : même action, objectif plafonné à 10, avec enjeu')
from challenge_duel_action('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000007') d;
select pg_temp.expect_error($$select challenge_duel('00000000-0000-0000-0000-000000000007', 'repas', 3)$$, '%duel_exists%', 'un seul duel à la fois entre deux personnes');

-- 2. Refuser un duel faisable : −10.
select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
select answer_duel((select id from duels where status = 'pending' and opponent = auth.uid() limit 1), false);
reset role;
select pg_temp.check(pg_temp.total('00000000-0000-0000-0000-000000000007') = (select p7 from base) - 10, 'refus : −10 pousses');

-- 3. Refuser une action qui ne remplace rien dans son bilan : gratuit.
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
insert into user_challenges (id, user_id, company_id, template_id, variant, target, starts_on, ends_on)
select 'd0000000-0000-0000-0000-000000000002', id, company_id, 'vacances_train', 'base', 1, current_date, current_date + 6
from profiles where id = auth.uid();
select challenge_duel_action('d0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000007');
select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
select pg_temp.check(not ((my_duels() -> 0 ->> 'feasible')::boolean), 'vacances en train : pas faisable pour elle (aucun long-courrier)');
select answer_duel((select id from duels where status = 'pending' and opponent = auth.uid() limit 1), false);
reset role;
select pg_temp.check(pg_temp.total('00000000-0000-0000-0000-000000000007') = (select p7 from base) - 10, 'refus d''une action infaisable : rien de perdu');

-- 4. Laisser expirer = refuser.
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select challenge_duel('00000000-0000-0000-0000-000000000007', 'repas', 3);
reset role;
update duels set created_at = now() - interval '4 days' where status = 'pending' and opponent = '00000000-0000-0000-0000-000000000007';
select settle_duels('00000000-0000-0000-0000-000000000007');
select pg_temp.check(pg_temp.total('00000000-0000-0000-0000-000000000007') = (select p7 from base) - 20, 'sans réponse en 3 jours : −10');

-- 5. Échouer : −20, sans jamais passer sous zéro.
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select challenge_duel('00000000-0000-0000-0000-000000000007', 'scan', 5);
select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
select answer_duel((select id from duels where status = 'pending' and opponent = auth.uid() limit 1), true);
reset role;
update duels set starts_on = current_date - 8, ends_on = current_date - 2 where status = 'active' and opponent = '00000000-0000-0000-0000-000000000007';
create temp table before6 as select pg_temp.total('00000000-0000-0000-0000-000000000006') as p6;
select settle_duels('00000000-0000-0000-0000-000000000007');
select pg_temp.check(pg_temp.total('00000000-0000-0000-0000-000000000007') = 0, 'échec : −20, plafonné pour ne pas passer sous zéro');
select pg_temp.check(pg_temp.total('00000000-0000-0000-0000-000000000006') = greatest(0, (select p6 from before6) - 20), 'l''autre a aussi échoué : −20');
select settle_duels('00000000-0000-0000-0000-000000000007');
select pg_temp.check(pg_temp.total('00000000-0000-0000-0000-000000000006') = greatest(0, (select p6 from before6) - 20), 'pénalité appliquée une seule fois');

-- 6. Classement : total des pousses.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from team_stats(null)) >= 1 and (select coalesce(bool_and(a.points >= b.points), true) from
                       (select points, row_number() over () as r from team_stats(null)) a
                       join (select points, row_number() over () as r from team_stats(null)) b on b.r = a.r + 1),
                     'équipes classées par total de pousses');
reset role;
