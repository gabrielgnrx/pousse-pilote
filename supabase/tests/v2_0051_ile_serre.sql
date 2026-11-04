-- Scénario v2 (migration 0051) : le défi débloque, les pousses font grandir.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
create function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
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

select pg_temp.check(island_grow_cost(1) = 30 and island_grow_cost(2) = 60 and island_grow_cost(3) = 100 and island_grow_cost(4) is null,
                     'coûts des stades : 30, 60, 100');
select pg_temp.check((select unlock from island_catalog where key = 'noisetier') = 2 and (select price from island_catalog where key = 'noisetier') is null,
                     'plus rien à vendre : le noisetier se débloque par 2 trajets');

-- Une nouvelle arrivante : quatre graines de départ, une par zone.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000511', 'lea@demo.fr');
select pg_temp.as_user('00000000-0000-0000-0000-000000000511');
select join_company('DEMO-2026', null, 'Léa', true, true);
select pg_temp.as_admin();
insert into habits (user_id, commute_mode, commute_km, commute_days, beef_meals_week, other_meat_meals_week,
                    short_flights_year, long_flights_year, new_clothes_year, buys_new_phone, heating, heating_kg_year)
values ('00000000-0000-0000-0000-000000000511', 'voiture_seul', 8, 4, 2, 3, 0, 0, 10, false, 'gaz', 1000);

select pg_temp.as_user('00000000-0000-0000-0000-000000000511');
select pg_temp.check(island_claim() = 4, 'quatre plantes de départ');
select pg_temp.check(island_claim() = 0, 'une seule fois');
select pg_temp.check((select string_agg(p->>'species' || '@' || island_tile_zone((p->>'x')::int, (p->>'z')::int), ' ' order by p->>'species')
                      from jsonb_array_elements(island('00000000-0000-0000-0000-000000000511')->'plants') p)
                     = 'alimentation@potager consommation@plage logement@ruisseau transport@foret', 'chacune dans sa zone');
select pg_temp.check((select (island('00000000-0000-0000-0000-000000000511')->>'pousses')::int = 0), 'pas encore de pousses');
select pg_temp.expect_error($$select island_grow(-1, -1)$$, '%not_enough%', 'grandir coûte des pousses');
select pg_temp.expect_error($$select island_plant('transport', -2, -1)$$, '%not_enough%', 'planter aussi');
select pg_temp.expect_error($$select island_plant('noisetier', -2, -1)$$, '%locked%', 'noisetier pas encore débloqué');
select pg_temp.expect_error($$select island_plant('merisier', -2, -1)$$, '%locked%', 'merisier : défi à réussir');

-- Deux trajets à vélo : des pousses, et le noisetier débloqué.
select log_action('velo', 'base');
select log_action('velo', 'base');
select pg_temp.check((select island('00000000-0000-0000-0000-000000000511')->'unlocked' ? 'noisetier'), 'deux trajets : noisetier débloqué');
select pg_temp.check((select (island('00000000-0000-0000-0000-000000000511')->>'pousses')::int >= 20), 'des pousses à dépenser');
select pg_temp.as_admin();
insert into points_ledger (user_id, company_id, kind, points, ref_id)
select id, company_id, 'quete', 200, '00000000-0000-0000-0000-0000000005f2' from profiles where id = '00000000-0000-0000-0000-000000000511';
select member_points('00000000-0000-0000-0000-000000000511', null) as gagnees \gset
select pg_temp.as_user('00000000-0000-0000-0000-000000000511');

select pg_temp.check((select (island_grow(-1, -1)->'plants'->0->>'stage')::int = 2), 'le bouleau grandit');
select pg_temp.check((select (island('00000000-0000-0000-0000-000000000511')->>'pousses')::int = :gagnees - 30), '30 pousses dépensées');
select island_grow(-1, -1);
select island_grow(-1, -1);
select pg_temp.expect_error($$select island_grow(-1, -1)$$, '%adult%', 'adulte : il ne grandit plus');
select pg_temp.check((select (island('00000000-0000-0000-0000-000000000511')->>'pousses')::int = :gagnees - 190), '30 + 60 + 100');
select pg_temp.expect_error($$select island_plant('noisetier', 2, 2)$$, '%wrong_zone%', 'le noisetier reste en forêt');
select pg_temp.expect_error($$select island_plant('noisetier', -1, -1)$$, '%tile_taken%', 'pas sur une plante');
select island_plant('noisetier', -2, -1);
select pg_temp.check((select (island('00000000-0000-0000-0000-000000000511')->>'pousses')::int = :gagnees - 200), 'planter : 10 pousses');
select island_uproot(-2, -1);
select pg_temp.check((select (island('00000000-0000-0000-0000-000000000511')->>'pousses')::int = :gagnees - 190), 'arracher rend les pousses');

-- Le classement ne bouge pas : il compte les pousses gagnées.
select pg_temp.as_admin();
select pg_temp.check(member_points('00000000-0000-0000-0000-000000000511', null) = :gagnees, 'pousses gagnées intactes');

-- Défi réussi : l'espèce est débloquée, le premier exemplaire offert.
insert into user_challenges (user_id, company_id, template_id, target, starts_on, ends_on, status, done_at)
select id, company_id, 'velo', 10, current_date - 29, current_date, 'done', now()
from profiles where id = '00000000-0000-0000-0000-000000000511';
select pg_temp.as_user('00000000-0000-0000-0000-000000000511');
select pg_temp.check(island_claim() = 1, 'un mois de vélo : merisier');
select pg_temp.check((select (island('00000000-0000-0000-0000-000000000511')->'unlocked' ? 'merisier')
                         and (island('00000000-0000-0000-0000-000000000511')->'free'->>'merisier')::int = 1), 'débloqué, un offert');
select island_plant('merisier', -1, -2);
select pg_temp.check((select (island('00000000-0000-0000-0000-000000000511')->>'pousses')::int = :gagnees - 190), 'le premier ne coûte rien');
select pg_temp.check((select not (island('00000000-0000-0000-0000-000000000511')->'free' ? 'merisier')), 'plus d''offert');
select island_plant('merisier', -2, -2);
select pg_temp.check((select (island('00000000-0000-0000-0000-000000000511')->>'pousses')::int = :gagnees - 200), 'le deuxième : 10 pousses');
select pg_temp.check((select island('00000000-0000-0000-0000-000000000511')->'unlocked' ? 'merisier'), 'débloqué pour toujours');

-- Les plantes posées avant gardent leur taille (scénario 0049 : un bouleau à 2 graines → stade 1).
select pg_temp.as_admin();
select pg_temp.check((select bool_and(stage = 1) from island_plants where user_id = '00000000-0000-0000-0000-000000000491'), 'anciennes plantes : stade selon leurs graines');
