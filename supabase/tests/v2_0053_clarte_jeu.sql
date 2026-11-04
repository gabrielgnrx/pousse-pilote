-- Scénario v2 (migration 0053) : bonus gros leviers dans les pousses, et pas de bravo à soi-même.
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

-- Odile mange du bœuf 5 fois par semaine : un repas végé à la place du bœuf évite plus de 3 kg.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000531', 'odile@demo.fr');
select pg_temp.as_user('00000000-0000-0000-0000-000000000531');
select join_company('DEMO-2026', (select id from teams where name = 'Produit' and company_id = (select id from companies where join_code = 'DEMO-2026')),
                    'Odile', true, true);
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into habits (user_id, commute_mode, commute_km, commute_days, beef_meals_week, other_meat_meals_week,
                    short_flights_year, long_flights_year, new_clothes_year, buys_new_phone, heating, heating_kg_year)
values ('00000000-0000-0000-0000-000000000531', 'voiture_seul', 2, 3, 5, 3, 1, 0, 8, false, 'gaz', 1200);

select pg_temp.as_user('00000000-0000-0000-0000-000000000531');
create temp table a53 as select log_action('vege', 'boeuf') as j;
create temp table b53 as select log_action('escaliers') as j;
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.check((select (j->>'kg')::numeric >= 1 from a53), 'le repas végé au lieu du bœuf évite plus de 1 kg');
select pg_temp.check((select (j->>'bonus')::int = case when (j->>'kg')::numeric >= 3 then 10 else 5 end from a53),
                     'bonus gros levier : +5 au-delà de 1 kg, +10 au-delà de 3 kg');
select pg_temp.check((select (j->>'base_points')::int = t.points_per_unit + (j->>'bonus')::int
                      from a53, challenge_templates t where t.id = 'vege'),
                     'les pousses de base gardent leur valeur, le bonus s''ajoute');
select pg_temp.check((select (j->>'bonus')::int = 0 from b53), 'pas de bonus pour un petit geste à 0 kg');

-- Elle publie son repas : elle ne peut pas se féliciter, un collègue si.
select pg_temp.as_user('00000000-0000-0000-0000-000000000531');
select publish_action((select (j->>'id')::uuid from a53), null, 'Midi végé');
select pg_temp.expect_error(
  format('insert into cheers (validation_id, user_id) values (%L, %L)', (select (j->>'id') from a53), '00000000-0000-0000-0000-000000000531'),
  '%row-level security%', 'pas de bravo sur sa propre publication');
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.as_user('00000000-0000-0000-0000-000000000281');
insert into cheers (validation_id, user_id) values ((select (j->>'id')::uuid from a53), '00000000-0000-0000-0000-000000000281');
reset role;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.check((select count(*) = 1 from cheers where validation_id = (select (j->>'id')::uuid from a53)), 'un collègue peut féliciter');
select pg_temp.check(not exists (select 1 from cheers c join validations v on v.id = c.validation_id where v.user_id = c.user_id),
                     'aucun bravo à soi-même ne reste en base');
