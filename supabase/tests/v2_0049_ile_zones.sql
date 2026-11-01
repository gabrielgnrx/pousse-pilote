-- Scénario v2 (migration 0049) : chaque espèce pousse dans sa zone ; mêmes zones qu'en TypeScript.
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

-- Mêmes zones que zoneOfTile() : 9 cases chacune, la case centrale à part (voir ecosystem.test.ts).
select pg_temp.check((select string_agg(z || '=' || n, ' ' order by z) = 'foret=9 plage=9 potager=9 ruisseau=9'
                      from (select coalesce(island_tile_zone(x, z), 'centre') as z, count(*) as n
                            from generate_series(-3, 3) x, generate_series(-3, 3) z
                            where x * x + z * z <= 10 group by 1) t where z <> 'centre'), 'zones de 9 cases');
select pg_temp.check(island_tile_zone(-1, -1) = 'foret' and island_tile_zone(1, -1) = 'ruisseau'
                     and island_tile_zone(1, 1) = 'plage' and island_tile_zone(-1, 1) = 'potager'
                     and island_tile_zone(0, 0) is null, 'repères des quatre zones');

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000491', 'yanis@demo.fr');
select pg_temp.as_user('00000000-0000-0000-0000-000000000491');
select join_company('DEMO-2026', (select id from teams where name = 'Data' and company_id = (select id from companies where join_code = 'DEMO-2026')), 'Yanis', true, true);
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into habits (user_id, commute_mode, commute_km, commute_days, beef_meals_week, other_meat_meals_week,
                    short_flights_year, long_flights_year, new_clothes_year, buys_new_phone, heating, heating_kg_year)
values ('00000000-0000-0000-0000-000000000491', 'voiture_seul', 8, 4, 2, 3, 0, 0, 10, false, 'gaz', 1000);

select pg_temp.as_user('00000000-0000-0000-0000-000000000491');
select log_action('velo', 'base');
select log_action('velo', 'base');
select pg_temp.expect_error($$select island_plant('transport', 1, 1)$$, '%wrong_zone%', 'pas de bouleau sur la plage');
select pg_temp.check((select jsonb_array_length(island_plant('transport', -1, -1)->'plants') = 1), 'bouleau dans la forêt');
select pg_temp.expect_error($$select island_move(-1, -1, 1, 1)$$, '%wrong_zone%', 'ne se déplace pas sur la plage');
select pg_temp.check((select (island_move(-1, -1, 0, 0)->'plants'->0->>'x')::int = 0), 'la case centrale accepte tout');
select pg_temp.check((select (island_plant('transport', 0, 0)->'plants'->0->>'fed')::int = 2), 'il grandit au centre');
reset role;
select set_config('request.jwt.claim.sub', '', false);
