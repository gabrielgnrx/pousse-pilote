-- Scénario v2 (migration 0028) : l'action du + avec une quantité, comme après une saisie en langage
-- naturel. La base retrouve l'action, borne la quantité, plafonne et calcule ; rien ne part dans le fil
-- sans que la personne le demande.
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

-- Une nouvelle salariée de l'entreprise démo : 12 km en voiture, 3 jours de bureau, du bœuf.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000281', 'nora@demo.fr');
select pg_temp.as_user('00000000-0000-0000-0000-000000000281');
select join_company('DEMO-2026', (select id from teams where name = 'Produit' and company_id = (select id from companies where join_code = 'DEMO-2026')),
                    'Nora', true, true);
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into habits (user_id, commute_mode, commute_km, commute_days, beef_meals_week, other_meat_meals_week,
                    short_flights_year, long_flights_year, new_clothes_year, buys_new_phone, heating, heating_kg_year)
values ('00000000-0000-0000-0000-000000000281', 'voiture_seul', 12, 3, 4, 4, 2, 0, 10, false, 'gaz', 1400);
-- Elle a accepté le fil (ancien réglage) : ses actions ne doivent pas y partir pour autant.
update profiles set share_feed = true, feed_choice_at = now() where id = '00000000-0000-0000-0000-000000000281';

select pg_temp.as_user('00000000-0000-0000-0000-000000000281');

-- 1. Distance : les km saisis, au prorata du trajet déclaré.
create temp table r1 as select log_action_slug('velo', 8) as j;
select pg_temp.check((select (j->>'kg')::numeric = round(8 * ef('voiture_thermique'), 3) and (j->>'units')::int = 1
                             and not (j->>'capped')::boolean from r1),
                     'vélo 8 km : 8 × facteur de la voiture déclarée, une unité');

-- 2. Les km sont plafonnés au trajet déclaré.
create temp table r2 as select log_action_slug('velo', 30) as j;
select pg_temp.check((select (j->>'kg')::numeric = round(12 * ef('voiture_thermique'), 3) and (j->>'capped')::boolean
                             and (j->>'quantity')::numeric = 12 from r2),
                     'vélo 30 km : plafonné aux 12 km déclarés');

-- 3. Plafond du jour : 2 trajets domicile-travail, partagés entre vélo, transports et covoiturage.
select pg_temp.expect_error($$select log_action_slug('transports', 10)$$, '%cap_reached%', 'troisième trajet du jour : refusé');

-- 4. Bornes du catalogue : la base refuse ce que l'IA aurait mal compris.
select pg_temp.expect_error($$select log_action_slug('vege_boeuf', 3)$$, '%quantity_out_of_range%', '3 repas d''un coup : hors bornes');
select pg_temp.expect_error($$select log_action_slug('vege_boeuf', 1.5)$$, '%quantity_out_of_range%', '1,5 repas : refusé');
select pg_temp.expect_error($$select log_action_slug('velo', 0)$$, '%quantity_out_of_range%', '0 km : refusé');
select pg_temp.expect_error($$select log_action_slug('fusee', 1)$$, '%unknown_action%', 'action inconnue : refusée');
select pg_temp.expect_error($$select log_action('train', '500', null, 300)$$, '%quantity_not_allowed%', 'raccourci à distance fixe : pas de quantité');
select pg_temp.expect_error($$select log_action('train', 'km')$$, '%quantity_required%', 'train en km sans distance : refusé');
select pg_temp.expect_error($$select log_action_slug('train', 500)$$, '%receipt_required%', 'train sans billet : refusé');

-- 5. Plusieurs unités : 2 repas = 2 unités, 2 × l'écart, 20 pousses ; le plafond du jour est alors atteint.
create temp table r3 as select log_action_slug('vege_boeuf', 2) as j;
select pg_temp.check((select (j->>'units')::int = 2 and (j->>'kg')::numeric = round(2 * (ef('repas_boeuf') - ef('repas_vegetarien')), 3)
                             and (j->>'base_points')::int = 20 from r3),
                     '2 repas végé au lieu du bœuf : 2 unités, CO₂ et pousses doublés');
select pg_temp.expect_error($$select log_action_slug('vege_autre', 1)$$, '%cap_reached%', 'troisième repas du jour : refusé');

-- 6. Train en km, avec billet : km saisis × (avion court − TGV).
create temp table r4 as select log_action_slug('train', 420, '00000000-0000-0000-0000-000000000281/billet.jpg') as j;
select pg_temp.check((select (j->>'kg')::numeric = round(420 * (ef('avion_court') - ef('tgv')), 3) from r4),
                     'train 420 km avec billet : calcul sur les km saisis');

-- 7. Rien n'est publié automatiquement.
select pg_temp.check(not exists (select 1 from validations
                                 where user_id = '00000000-0000-0000-0000-000000000281' and visibility <> 'private'),
                     'aucune action publiée sans le demander');

-- 8. Toujours aucune insertion directe possible, et aucun chiffre venu du client.
select pg_temp.expect_error($$insert into validations (challenge_id, user_id, company_id, template_id, variant, units, kg, points, proof_level, visibility)
                              select null, id, company_id, 'velo', 'base', 1, 999, 999, 0, 'company' from profiles where id = auth.uid()$$,
                            '%', 'insertion directe dans validations : refusée');
reset role;

-- 9. ef() refuse un facteur inconnu.
select pg_temp.expect_error($$select ef('kerosene_inconnu')$$, '%unknown_factor%', 'facteur inconnu : erreur explicite');
