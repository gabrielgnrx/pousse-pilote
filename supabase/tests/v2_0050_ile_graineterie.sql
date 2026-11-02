-- Scénario v2 (migration 0050) : Graineterie, récompenses de défis, migrateur d'équipe, cadeaux.
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

-- Même règle de récompense que challengeReward() (catalog.test.ts).
select pg_temp.check(island_challenge_reward('transport', 7, 3, 'standard') = array['muguet'], '7 jours : graine rare');
select pg_temp.check(island_challenge_reward('transport', 7, 5, 'standard') = array['muguet', 'muguet'], '7 jours costaud : deux graines rares');
select pg_temp.check(island_challenge_reward('alimentation', 30, 10, 'standard') = array['figuier'], '30 jours : plante spéciale');
select pg_temp.check(island_challenge_reward('alimentation', 30, 18, 'standard') = array['figuier_fruits'], '30 jours costaud : variante');
select pg_temp.check(island_challenge_reward('consommation', 90, 3, 'expert') = array['chene_liege', 'tamaris_fleurs'], '90 jours expert : arbre et variante');
select pg_temp.check(island_challenge_reward('logement', 90, 10, 'standard') = array['platane'], '90 jours : arbre remarquable');
select pg_temp.check(island_challenge_reward('quotidien', 7, 1, 'standard') = array['muguet'], 'thème quotidien : la forêt');
select pg_temp.check(island_consolation('alimentation') = 'groseillier', 'consolation : plante commune de la zone');

-- Une équipe de deux pour le migrateur.
insert into teams (company_id, name)
select id, 'Île' from companies where join_code = 'DEMO-2026';
select id as ile_team from teams where name = 'Île' \gset
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000501', 'ines@demo.fr'),
  ('00000000-0000-0000-0000-000000000502', 'paul@demo.fr');
select pg_temp.as_user('00000000-0000-0000-0000-000000000501');
select join_company('DEMO-2026', :'ile_team', 'Inès', true, true);
select pg_temp.as_user('00000000-0000-0000-0000-000000000502');
select join_company('DEMO-2026', :'ile_team', 'Paul', true, true);
select pg_temp.as_admin();
insert into habits (user_id, commute_mode, commute_km, commute_days, beef_meals_week, other_meat_meals_week,
                    short_flights_year, long_flights_year, new_clothes_year, buys_new_phone, heating, heating_kg_year)
select u, 'voiture_seul', 8, 4, 2, 3, 0, 0, 10, false, 'gaz', 1000
from unnest(array['00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000502']::uuid[]) u;

-- Graineterie : le solde vient des pousses gagnées.
select pg_temp.as_user('00000000-0000-0000-0000-000000000501');
select pg_temp.check((select (island('00000000-0000-0000-0000-000000000501')->>'pousses')::int = 0), 'pas de pousse au départ');
select pg_temp.expect_error($$select island_buy('noisetier')$$, '%not_enough%', 'trop cher sans pousses');
select pg_temp.expect_error($$select island_buy('merisier')$$, '%not_for_sale%', 'les plantes de défi ne se vendent pas');
select log_action('velo', 'base');
select pg_temp.as_admin();
insert into points_ledger (user_id, company_id, kind, points, ref_id)
select id, company_id, 'quete', 50, '00000000-0000-0000-0000-0000000005f1' from profiles where id = '00000000-0000-0000-0000-000000000501';
select pg_temp.check(member_points('00000000-0000-0000-0000-000000000501', null) >= 60, 'un trajet à vélo et une quête : au moins 60 pousses');
select pg_temp.as_user('00000000-0000-0000-0000-000000000501');
select pg_temp.check((select (island_buy('noisetier')->'inventory'->>'noisetier')::int = 1), 'noisetier acheté');
select pg_temp.check((select (island('00000000-0000-0000-0000-000000000501')->>'pousses')::int
                        = (select sum(points) from points_ledger where user_id = '00000000-0000-0000-0000-000000000501')
                          + (select sum(points) from validations where user_id = '00000000-0000-0000-0000-000000000501') - 40), 'le solde baisse de 40');
select pg_temp.expect_error($$select island_buy('erable')$$, '%locked%', 'érable verrouillé avant 10 trajets');
select pg_temp.expect_error($$select island_plant('noisetier', 1, 1)$$, '%wrong_zone%', 'le noisetier reste en forêt');
select pg_temp.check((select (island_plant('noisetier', -1, -1)->'inventory'->>'noisetier')::int = 0), 'noisetier planté');
select pg_temp.expect_error($$select island_plant('noisetier', -2, -1)$$, '%no_seed%', 'plus de noisetier à poser');
select pg_temp.check((select (island_uproot(-1, -1)->'inventory'->>'noisetier')::int = 1), 'arraché : il revient dans le bac');

-- Le classement compte les pousses gagnées : un achat n'y touche pas.
select pg_temp.as_admin();
select pg_temp.check(member_points('00000000-0000-0000-0000-000000000501', null) >= 40, 'les pousses gagnées ne baissent pas');

-- Défis : réussi, terminé sans succès, abandonné.
insert into user_challenges (id, user_id, company_id, template_id, target, starts_on, ends_on, status)
select '00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-000000000501', company_id, 'velo', 20,
       current_date - 29, current_date, 'done'
from profiles where id = '00000000-0000-0000-0000-000000000501';
insert into user_challenges (id, user_id, company_id, template_id, target, starts_on, ends_on, status)
select '00000000-0000-0000-0000-0000000005a2', '00000000-0000-0000-0000-000000000501', company_id, 'vege', 3,
       current_date - 9, current_date - 3, 'active'
from profiles where id = '00000000-0000-0000-0000-000000000501';
insert into user_challenges (id, user_id, company_id, template_id, target, starts_on, ends_on, status)
select '00000000-0000-0000-0000-0000000005a3', '00000000-0000-0000-0000-000000000501', company_id, 'occasion', 3,
       current_date - 9, current_date - 3, 'abandoned'
from profiles where id = '00000000-0000-0000-0000-000000000501';

select pg_temp.as_user('00000000-0000-0000-0000-000000000501');
select pg_temp.check(island_claim() = 2, 'deux récompenses : le défi réussi et la consolation');
select pg_temp.check(island_claim() = 0, 'rejouée, elle ne donne rien deux fois');
select pg_temp.check((select (island('00000000-0000-0000-0000-000000000501')->'inventory'->>'merisier_fleurs')::int = 1),
                     '30 jours de vélo, 5 par semaine : merisier en fleurs');
select pg_temp.check((select (island('00000000-0000-0000-0000-000000000501')->'inventory'->>'groseillier')::int = 1),
                     'défi végé raté : un groseillier');
select pg_temp.check((select jsonb_array_length(island('00000000-0000-0000-0000-000000000501')->'recent') = 2), 'les récompenses récentes');
select pg_temp.check((select island('00000000-0000-0000-0000-000000000501')->'recent'->0->>'source' = 'defi'), 'source : défi');

-- Les récompenses ne se lisent que pour soi ; l'inventaire se voit sur l'île (visite).
select pg_temp.as_user('00000000-0000-0000-0000-000000000502');
select pg_temp.check((select count(*) = 0 from island_inventory where user_id = '00000000-0000-0000-0000-000000000501'), 'inventaire privé');
select pg_temp.check((select island('00000000-0000-0000-0000-000000000501')->'pousses' = 'null'::jsonb), 'solde d''un collègue caché');

-- Migrateur : le défi d'équipe de la semaine, deux membres, deux îles qui l'accueillent.
select pg_temp.as_admin();
insert into team_weeks (team_id, week_start, options, chosen, target)
select id, date_trunc('week', current_date)::date, array['actions', 'repas', 'quiz'], 'actions', 6 from teams where name = 'Île';
select pg_temp.as_user('00000000-0000-0000-0000-000000000502');
select pg_temp.check((select (team_garden()->'migration'->>'needed')::int = 2
                         and jsonb_array_length(team_garden()->'migration'->'hosts') = 1
                         and not (team_garden()->'migration'->>'done')::boolean), 'une île sur deux');
select pg_temp.check(island_claim() = 0, 'pas encore de migrateur');
select log_action('velo', 'base');
select pg_temp.check((select (team_garden()->'migration'->>'done')::boolean), 'deux îles : le migrateur arrive');
select pg_temp.check(island_claim() = 2, 'il arrive chez les deux membres');
select pg_temp.check((select (island('00000000-0000-0000-0000-000000000502')->'inventory' ? (team_garden()->'migration'->>'bird'))), 'dans le carnet');
select pg_temp.expect_error(format($$select island_plant(%L, 0, 0)$$, (select team_garden()->'migration'->>'bird')), '%no_seed%', 'un visiteur ne se plante pas');

-- Cadeaux : un myosotis par jour, à un collègue de l'entreprise.
select pg_temp.expect_error($$select island_gift('00000000-0000-0000-0000-000000000502')$$, '%not_colleague%', 'pas à soi-même');
select island_gift('00000000-0000-0000-0000-000000000501');
select pg_temp.expect_error($$select island_gift('00000000-0000-0000-0000-000000000501')$$, '%already_gifted%', 'un seul par jour');
select pg_temp.check((select (team_garden()->>'gifted_today')::boolean), 'cadeau du jour fait');
select pg_temp.as_user('00000000-0000-0000-0000-000000000501');
select pg_temp.check((select island('00000000-0000-0000-0000-000000000501')->'recent'->0->>'from' = 'Paul'), 'on sait qui l''a offert');
select pg_temp.check((select (island_plant('myosotis', 2, 1)->'inventory'->>'myosotis')::int = 0), 'le myosotis pousse partout');
select pg_temp.check((select count(*) = 1 from alerts where user_id = '00000000-0000-0000-0000-000000000501' and kind = 'cadeau_ile'), 'alerte de cadeau');
select pg_temp.as_admin();
