-- Scénario « cohérence des règles » (migration 0023), à jouer en dernier, sur la même base.
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
set client_min_messages = notice;

-- On repart sans duel en cours ; la personne 7 vient en voiture (le vélo remplace donc un trajet).
update duels set status = 'done' where status in ('pending', 'active');
delete from validations where user_id = '00000000-0000-0000-0000-000000000007' and day = current_date;
insert into habits (user_id, commute_mode, commute_km, commute_days, beef_meals_week, other_meat_meals_week,
                    short_flights_year, long_flights_year, new_clothes_year, buys_new_phone, heating, heating_kg_year)
values ('00000000-0000-0000-0000-000000000007', 'voiture_seul', 10, 4, 2, 2, 0, 0, 5, false, 'gaz', 800)
on conflict (user_id) do update set commute_mode = 'voiture_seul', commute_km = 10;

-- 1. Un duel « trajets » lancé depuis le fil, accepté.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select challenge_duel('00000000-0000-0000-0000-000000000007', 'trajets', 3);
select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
select answer_duel((select id from duels where status = 'pending' and opponent = auth.uid() limit 1), true);

-- 2. Une action enregistrée avec le +, sans photo : elle compte dans le duel, avec le ×1,5.
create temp table r as select log_action('velo', 'base') as j;
reset role;
select pg_temp.check((select j->>'boost' from r) = 'duel', 'trajet à vélo sans photo : boost du duel');
select pg_temp.check((select (j->>'points')::int = round((j->>'base_points')::int * 1.5)::int from r), 'trajet à vélo : pousses ×1,5');
select pg_temp.check(duel_progress(d, '00000000-0000-0000-0000-000000000007') = 1, 'duel trajets : l''action sans photo compte')
from duels d where d.kind = 'trajets' and d.status = 'active' and d.opponent = '00000000-0000-0000-0000-000000000007';

-- 3. Un duel « actions enregistrées » compte toute action, avec ou sans photo.
select pg_temp.check(duel_count('defis', '00000000-0000-0000-0000-000000000007', current_date, current_date) >= 1,
                     'duel « actions » : toute action enregistrée compte');

-- 4. Le Baobab du jardin s'obtient avec un défi d'équipe réussi.
insert into points_ledger (user_id, company_id, kind, points, ref_id)
select id, company_id, 'equipe', 50, gen_random_uuid() from profiles where id = '00000000-0000-0000-0000-000000000003';
select pg_temp.check((garden('00000000-0000-0000-0000-000000000003')->'exploits'->>'collectif')::boolean,
                     'défi d''équipe réussi : exploit Baobab');
