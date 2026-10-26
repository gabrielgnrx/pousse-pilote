-- Scénario v2 (migration 0039) : l'IA de l'espace admin est journalisée au nom de l'organisation, avec un quota.
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

-- Scénario (migration 0045) : repas végé pondéré par le bilan, et deux appareils d'un coup.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000451', 'clara@demo.fr');
select pg_temp.as_user('00000000-0000-0000-0000-000000000451');
select join_company('DEMO-2026', (select id from teams where name = 'Data' and company_id = (select id from companies where join_code = 'DEMO-2026')), 'Clara', true, true);
reset role;
select set_config('request.jwt.claim.sub', '', false);
-- 1 repas de bœuf et 3 d'autres viandes par semaine, un smartphone neuf par an, des appareils.
insert into habits (user_id, commute_mode, commute_km, commute_days, beef_meals_week, other_meat_meals_week,
                    short_flights_year, long_flights_year, new_clothes_year, buys_new_phone, new_devices_year, heating, heating_kg_year)
values ('00000000-0000-0000-0000-000000000451', 'voiture_seul', 10, 3, 1, 3, 0, 0, 10, true, 1, 'gaz', 1200);

select pg_temp.as_user('00000000-0000-0000-0000-000000000451');
create temp table veg as select log_action('vege', 'repas') as j;
grant select on veg to public;
select pg_temp.check((select (j->>'kg')::numeric = round((1 * ef('repas_boeuf')
                        + 3 * (ef('repas_porc') + ef('repas_poulet') + ef('repas_poisson')) / 3) / 4 - ef('repas_vegetarien'), 3) from veg),
                     'repas végé : repas habituel pondéré (1 bœuf, 3 autres viandes) moins végétarien');
select pg_temp.check((select (log_action('reparation', 'smartphone')->>'kg')::numeric = round(ef('smartphone_neuf'), 3)), 'smartphone réparé');
select pg_temp.check((select (log_action('reparation', 'ordinateur')->>'kg')::numeric = round(ef('ordinateur_portable_neuf'), 3)), 'ordinateur réparé le même jour');
select pg_temp.expect_error($$select log_action('reparation', 'smartphone')$$, '%cap_reached%', 'un troisième appareil : refusé');
reset role;
select set_config('request.jwt.claim.sub', '', false);
