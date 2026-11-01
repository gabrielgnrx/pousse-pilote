-- Scénario v2 (migration 0048) : une graine par action ; déplacer et arracher une plante.
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

-- Une cycliste : son trajet à vélo est une bonne habitude (0 kg), comptée dans « transport » et, pour
-- le jardin, aussi dans « cap ». Sur l'île, il ne donne qu'une graine.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000481', 'nora@demo.fr');
select pg_temp.as_user('00000000-0000-0000-0000-000000000481');
select join_company('DEMO-2026', (select id from teams where name = 'Data' and company_id = (select id from companies where join_code = 'DEMO-2026')), 'Nora', true, true);
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into habits (user_id, commute_mode, commute_km, commute_days, beef_meals_week, other_meat_meals_week,
                    short_flights_year, long_flights_year, new_clothes_year, buys_new_phone, heating, heating_kg_year)
values ('00000000-0000-0000-0000-000000000481', 'velo', 5, 4, 1, 2, 0, 0, 10, false, 'gaz', 1000);

select pg_temp.as_user('00000000-0000-0000-0000-000000000481');
select log_action('velo', 'base');
select pg_temp.check((select (garden('00000000-0000-0000-0000-000000000481')->'counts'->>'cap')::int = 1), 'le jardin compte toujours l''habitude dans « cap »');
select pg_temp.check((select (island('00000000-0000-0000-0000-000000000481')->'counts'->>'cap')::int = 0), 'l''île ne la compte pas une seconde fois');
select pg_temp.check((select (island('00000000-0000-0000-0000-000000000481')->'counts'->>'transport')::int = 1), 'une graine de transport');
select pg_temp.expect_error($$select island_plant('cap', 0, 0)$$, '%no_seed%', 'pas de cactus gratuit');

-- Planter, déplacer, arracher.
select island_plant('transport', 0, 0);
select pg_temp.expect_error($$select island_plant('transport', 1, 0)$$, '%no_seed%', 'la graine est dépensée');
select pg_temp.check((select (island_move(0, 0, 2, 1)->'plants'->0->>'x')::int = 2), 'bouleau déplacé en (2, 1)');
select pg_temp.expect_error($$select island_move(0, 0, 1, 1)$$, '%no_plant%', 'plus rien en (0, 0)');
select pg_temp.expect_error($$select island_move(2, 1, 3, 3)$$, '%off_island%', 'pas hors de l''île');
select pg_temp.check((select jsonb_array_length(island_uproot(2, 1)->'plants') = 0), 'bouleau arraché');
select pg_temp.check((select jsonb_array_length(island_plant('transport', -1, 0)->'plants') = 1), 'sa graine est revenue : replantée');
select pg_temp.expect_error($$select island_uproot(0, 0)$$, '%no_plant%', 'rien à arracher');

-- Une plante occupée bloque le déplacement.
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into garden_rares (user_id, plant) values ('00000000-0000-0000-0000-000000000481', 'bonsai');
select pg_temp.as_user('00000000-0000-0000-0000-000000000481');
select island_plant('bonsai', 1, 1);
select pg_temp.expect_error($$select island_move(1, 1, -1, 0)$$, '%tile_taken%', 'case déjà prise');
select pg_temp.check((select jsonb_array_length(island_uproot(1, 1)->'plants') = 1), 'bonsaï arraché');
select pg_temp.check((select (island_plant('bonsai', 2, 0)->'plants'->1->>'rare')::boolean), 'le bonsaï se repose ailleurs');
reset role;
select set_config('request.jwt.claim.sub', '', false);
