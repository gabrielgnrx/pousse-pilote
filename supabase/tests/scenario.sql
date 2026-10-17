-- Scénario de bout en bout, joué sur la base de test (voir README, « Tester la base »).
-- Chaque vérification lève une erreur si elle échoue.
\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- Une seconde entreprise, pour vérifier le cloisonnement.
insert into companies (name, join_code, email_domain) values ('Autre SA', 'AUTRE-2026', 'autre.fr');
insert into teams (company_id, name) select id, 'Compta' from companies where join_code = 'AUTRE-2026';

-- 7 salariés dans l'entreprise démo (Gabriel + 5 en Data + 1 en Finance), 1 chez Autre SA.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'gabriel@demo.fr'),
  ('00000000-0000-0000-0000-000000000002', 'malik@demo.fr'),
  ('00000000-0000-0000-0000-000000000003', 'lea@demo.fr'),
  ('00000000-0000-0000-0000-000000000004', 'sofia@demo.fr'),
  ('00000000-0000-0000-0000-000000000005', 'hugo@demo.fr'),
  ('00000000-0000-0000-0000-000000000006', 'ines@demo.fr'),
  ('00000000-0000-0000-0000-000000000007', 'camille@demo.fr'),
  ('00000000-0000-0000-0000-000000000009', 'intrus@gmail.com');

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

-- 1. Rejoindre : le code est lisible sans compte ; un mauvais domaine est refusé.
set role anon;
select pg_temp.check((company_by_code('demo-2026')->>'name') = 'Entreprise démo', 'code lisible sans compte, insensible à la casse');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-000000000009');
do $$ begin
  perform join_company('AUTRE-2026', null, 'Intrus', true, true);
  raise exception 'ÉCHEC : domaine e-mail non vérifié';
exception when others then
  if sqlerrm <> 'wrong_email_domain' then raise; end if;
  raise notice 'ok : mauvais domaine e-mail refusé';
end $$;
reset role;

do $$
declare
  data_team uuid := (select t.id from teams t join companies c on c.id = t.company_id
                     where c.join_code = 'DEMO-2026' and t.name = 'Data');
  fin_team uuid := (select t.id from teams t join companies c on c.id = t.company_id
                    where c.join_code = 'DEMO-2026' and t.name = 'Finance');
  i int;
begin
  for i in 1..7 loop
    perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000' || i, false);
    perform join_company('DEMO-2026', case when i = 7 then fin_team else data_team end,
                         'Personne ' || i, true, true);
  end loop;
end $$;
select pg_temp.check((select count(*) from profiles) = 7, '7 profils créés');

-- 2. Habitudes de Gabriel : voiture seul 6 km, bœuf 4 fois, pas d'avion.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
insert into habits values ('00000000-0000-0000-0000-000000000001', 'voiture_seul', 6, 5, 4, 1, 0, 0, 15, true, 'gaz', 803, now());

-- 3. Les gains par unité correspondent au calcul TypeScript (tests co2.test.ts).
select pg_temp.check(round(unit_kg('velo', 'base', h), 4) = 0.6636, 'vélo : 6 km × 0,1106') from habits h;
select pg_temp.check(round(unit_kg('covoiturage', 'base', h), 4) = 0.3318, 'covoiturage : moitié du trajet') from habits h;
select pg_temp.check(round(unit_kg('vege', 'boeuf', h), 2) = 4.12, 'végé au lieu du bœuf : 4,12') from habits h;
select pg_temp.check(round(unit_kg('moins_boeuf', 'base', h), 4) = 3.4467, 'volaille au lieu du bœuf') from habits h;
select pg_temp.check(unit_kg('train', '500', h) = 0, 'train non éligible sans vol déclaré') from habits h;
select pg_temp.check(round(unit_kg('chauffage', 'base', h), 3) = round(803 * 0.07 / 30, 3), 'chauffage : 7 % sur 30 semaines') from habits h;

-- 4. Un défi vélo : plafond de 2 trajets par jour, partagé avec le métro.
insert into user_challenges (id, user_id, company_id, template_id, variant, target, ends_on)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
        my_company_id(), 'velo', 'base', 10, current_date + 30),
       ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
        my_company_id(), 'transports', 'base', 10, current_date + 30);

select pg_temp.check(v.units = 2 and round(v.kg, 3) = 1.327 and v.visibility = 'private' and v.points = 0,
  'sans preuve : 2 trajets comptés (CO₂), ni publiés ni récompensés en pousses')
from validate_challenge_day('10000000-0000-0000-0000-000000000001', 5) v;

do $$ begin
  perform validate_challenge_day('10000000-0000-0000-0000-000000000002', 1, null, null, null, 'company');
  raise exception 'ÉCHEC : plafond partagé non appliqué';
exception when others then
  if sqlerrm <> 'cap_reached' then raise; end if;
  raise notice 'ok : plafond domicile-travail partagé entre vélo et métro';
end $$;

-- 5. Repas végé avec photo et témoin : publié dans le fil, témoin en attente.
insert into user_challenges (id, user_id, company_id, template_id, variant, target, ends_on)
values ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
        my_company_id(), 'vege', 'boeuf', 5, current_date + 7);
select pg_temp.check(v.visibility = 'company' and v.proof_level = 2 and v.witness_status = 'pending'
                     and round(v.kg, 2) = 4.12 and v.points = 15,
  'avec photo et témoin : publié, preuve forte')
from validate_challenge_day('10000000-0000-0000-0000-000000000003', 1,
  '00000000-0000-0000-0000-000000000001/repas.jpg',
  '00000000-0000-0000-0000-000000000002', 'Curry de pois chiches', 'company') v;

do $$ begin
  perform validate_challenge_day('10000000-0000-0000-0000-000000000003', 1,
    '00000000-0000-0000-0000-000000000002/vol.jpg', null, null, 'company');
  raise exception 'ÉCHEC : photo d''un autre utilisateur acceptée';
exception when others then
  if sqlerrm <> 'invalid_photo' then raise; end if;
  raise notice 'ok : photo hors de mon dossier refusée';
end $$;

-- 6. Écriture directe d'une validation interdite (le CO₂ ne vient jamais du navigateur).
do $$ begin
  insert into validations (challenge_id, user_id, company_id, template_id, variant, units, kg, points, proof_level, visibility)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
          my_company_id(), 'velo', 'base', 1, 9999, 0, 0, 'company');
  raise exception 'ÉCHEC : insertion directe acceptée';
exception when insufficient_privilege then
  raise notice 'ok : insertion directe refusée';
end $$;
reset role;

-- 7. Le témoin refuse : la validation est annulée.
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from validations where witness_status = 'pending') = 1,
  'le témoin voit la demande');
select pg_temp.check((select count(*) from validations) = 1,
  'le collègue voit seulement la publication du fil, pas la validation privée');
select respond_witness(id, false) from validations where witness_status = 'pending';
reset role;
select pg_temp.check(status = 'rejected' and kg = 0 and visibility = 'private', 'refus du témoin : validation annulée')
from validations where witness_id = '00000000-0000-0000-0000-000000000002';

-- 8. Cloisonnement : un salarié d'une autre entreprise ne voit rien.
insert into auth.users values ('00000000-0000-0000-0000-000000000010', 'x@autre.fr');
select pg_temp.as_user('00000000-0000-0000-0000-000000000010');
select join_company('AUTRE-2026', null, 'Autre', true, true);
select pg_temp.check((select count(*) from profiles) = 1, 'autre entreprise : ne voit que son profil');
select pg_temp.check((select count(*) from validations) = 0, 'autre entreprise : aucune validation visible');
reset role;

-- 9. Classement : Data (6 personnes) apparaît, Finance (1 personne) est masquée.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from team_stats()) = 1, 'une seule ligne de classement');
select pg_temp.check((select team_name = 'Data' and participants = 6 and is_mine from team_stats()),
  'Data affichée, équipe de moins de 5 masquée');
select pg_temp.check((select round(kg, 3) from team_stats()) = 1.3, 'seules les validations valides comptent');
reset role;

\echo 'Tous les tests du scénario sont passés.'
