-- Scénario v2 (migration 0047) : l'île. Les graines viennent des vraies actions, chacune ne se plante qu'une fois.
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

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000471', 'ines@demo.fr');
select pg_temp.as_user('00000000-0000-0000-0000-000000000471');
select join_company('DEMO-2026', (select id from teams where name = 'Data' and company_id = (select id from companies where join_code = 'DEMO-2026')), 'Inès', true, true);
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into habits (user_id, commute_mode, commute_km, commute_days, beef_meals_week, other_meat_meals_week,
                    short_flights_year, long_flights_year, new_clothes_year, buys_new_phone, heating, heating_kg_year)
values ('00000000-0000-0000-0000-000000000471', 'voiture_seul', 8, 4, 2, 3, 0, 0, 10, false, 'gaz', 1000);

-- Deux trajets à vélo et un repas végé : deux graines de bouleau, une de potager.
select pg_temp.as_user('00000000-0000-0000-0000-000000000471');
select log_action('velo', 'base');
select log_action('velo', 'base');
select log_action('vege', 'repas');

select pg_temp.check((select jsonb_array_length(island('00000000-0000-0000-0000-000000000471')->'plants') = 0), 'île vide au départ');
select pg_temp.check((select (island('00000000-0000-0000-0000-000000000471')->'counts'->>'transport')::int = 2), 'deux graines de transport');

create temp table p1 as select island_plant('transport', 0, 0) as j;
grant select on p1 to public;
select pg_temp.check((select jsonb_array_length(j->'plants') = 1 and (j->'plants'->0->>'fed')::int = 1 from p1), 'premier bouleau planté au centre');
create temp table p2 as select island_plant('transport', 0, 0) as j;
grant select on p2 to public;
select pg_temp.check((select jsonb_array_length(j->'plants') = 1 and (j->'plants'->0->>'fed')::int = 2 from p2), 'seconde graine : le même bouleau grandit');
select pg_temp.expect_error($$select island_plant('transport', 1, 0)$$, '%no_seed%', 'plus de graine de transport');
select pg_temp.expect_error($$select island_plant('alimentation', 0, 0)$$, '%tile_taken%', 'un potager ne pousse pas sur le bouleau');
select pg_temp.expect_error($$select island_plant('alimentation', 3, 2)$$, '%off_island%', 'hors de l''île (9 + 4 > 10)');
select pg_temp.check((select jsonb_array_length(island_plant('alimentation', 3, 1)->'plants') = 2), 'potager au bord de l''île (9 + 1 = 10)');
select pg_temp.expect_error($$select island_plant('chene', -1, 0)$$, '%no_seed%', 'chêne rare sans la série de 30 jours');
select pg_temp.expect_error($$select island_plant('licorne', -1, 0)$$, '%no_seed%', 'espèce inconnue');

-- Une plante rare de graine mystère : posée une seule fois, adulte.
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into garden_rares (user_id, plant) values ('00000000-0000-0000-0000-000000000471', 'lotus');
select pg_temp.as_user('00000000-0000-0000-0000-000000000471');
select pg_temp.check((select (island_plant('lotus', -2, -2)->'plants'->2->>'rare')::boolean), 'lotus posé');
select pg_temp.expect_error($$select island_plant('lotus', -2, -1)$$, '%already_planted%', 'un seul lotus');

-- Les écritures directes sont fermées.
select pg_temp.expect_error($$insert into island_plants (user_id, species, x, z) values ('00000000-0000-0000-0000-000000000471', 'transport', 2, 2)$$,
                            '%row-level security%', 'pas d''insertion directe');

-- Une personne d'une autre entreprise ne voit pas l'île.
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into companies (name, join_code) values ('Autre', 'AUTRE-0047');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000472', 'zoe@autre.fr');
select pg_temp.as_user('00000000-0000-0000-0000-000000000472');
select join_company('AUTRE-0047', null, 'Zoé', true, true);
select pg_temp.check((select count(*) = 0 from island_plants), 'plantes d''une autre entreprise invisibles');
select pg_temp.expect_error($$select island('00000000-0000-0000-0000-000000000471')$$, '%not_found%', 'île d''une autre entreprise introuvable');
reset role;
select set_config('request.jwt.claim.sub', '', false);
