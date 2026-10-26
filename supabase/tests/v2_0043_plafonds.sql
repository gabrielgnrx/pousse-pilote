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

-- Scénario v2 (migration 0043) : plus de justificatif ; des plafonds sur 365 jours calés sur le bilan.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000431', 'yanis@demo.fr');
select pg_temp.as_user('00000000-0000-0000-0000-000000000431');
select join_company('DEMO-2026', (select id from teams where name = 'Data' and company_id = (select id from companies where join_code = 'DEMO-2026')), 'Yanis', true, true);
reset role;
select set_config('request.jwt.claim.sub', '', false);
-- 2 vols courts et aucun long-courrier par an.
insert into habits (user_id, commute_mode, commute_km, commute_days, beef_meals_week, other_meat_meals_week,
                    short_flights_year, long_flights_year, new_clothes_year, buys_new_phone, heating, heating_kg_year)
values ('00000000-0000-0000-0000-000000000431', 'voiture_seul', 10, 3, 2, 3, 2, 0, 10, false, 'gaz', 1200);

-- 1. Sans justificatif : une réparation s'enregistre.
select pg_temp.as_user('00000000-0000-0000-0000-000000000431');
select pg_temp.check((select (log_action_slug('reparation_smartphone')->>'points')::int > 0), 'réparation sans justificatif : enregistrée');
reset role;

-- 2. Historique de l'année (inséré directement, daté du passé).
create function pg_temp.past(t text, v text, d integer) returns void language sql as $$
  insert into validations (user_id, company_id, team_id, template_id, variant, day, units, kg, points, witness_status, proof_level, visibility)
  select p.id, p.company_id, p.team_id, t, v, current_date - d, 1, 0, 10, 'none', 0, 'private'
  from profiles p where p.id = '00000000-0000-0000-0000-000000000431';
$$;
select pg_temp.past('train', 'km', 300);
select pg_temp.past('train', 'km', 200);
select pg_temp.past('train', 'km', 100);
select pg_temp.past('train', 'km', 50);
select pg_temp.past('vacances_train', 'base', 200);
select pg_temp.past('reparation', 'ordinateur', 60);
select pg_temp.past('appli_occasion', 'jean', 3);
select pg_temp.past('appli_occasion', 'jean', 2);
select pg_temp.past('appli_occasion', 'jean', 1);
select pg_temp.expect_error($$select pg_temp.past('train', 'km', 20)$$, '%year_cap_reached%', 'le plafond vaut aussi pour une insertion directe');
-- Un trajet d'il y a plus d'un an ne compte plus.
select pg_temp.past('train', 'km', 400);

select pg_temp.as_user('00000000-0000-0000-0000-000000000431');
select pg_temp.expect_error($$select log_action_slug('train', 300)$$, '%year_cap_reached%', 'train : 2 trajets par vol court déclaré (4 par an)');
select pg_temp.expect_error($$select log_action_slug('vacances_train')$$, '%year_cap_reached%', 'vacances en train : au moins 1 par an, même sans long-courrier');
select pg_temp.expect_error($$select log_action('reparation', 'ordinateur')$$, '%cap_reached%', 'réparation : 2 par an (déjà 2)');
select pg_temp.expect_error($$select log_action('appli_occasion', 'jean')$$, '%week_cap_reached%', 'achat d''occasion via une appli : 3 par semaine');
reset role;

-- 3. Les plafonds suivent le bilan : 1 long-courrier déclaré → 1 voyage en vacances par an, pas plus.
select pg_temp.check((select cap = 1 and days = 365 from period_cap('vacances_train', (select h from habits h where user_id = '00000000-0000-0000-0000-000000000431'))),
                     'vacances : plafond = vols long-courrier déclarés, au moins 1');
select pg_temp.check((select cap = 4 from period_cap('train', (select h from habits h where user_id = '00000000-0000-0000-0000-000000000431'))),
                     'train : 2 × vols courts, au moins 4');
select pg_temp.check((select count(*) = 0 from challenge_templates where requires_receipt), 'plus aucun justificatif demandé');
select set_config('request.jwt.claim.sub', '', false);
