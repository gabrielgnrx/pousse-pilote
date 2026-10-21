-- Scénario « pousses et classement équitables » (migration 0024), à jouer en dernier, sur la même base.
-- Personnes 1 à 6 : équipe Data ; personne 7 : équipe Finance.
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

-- La personne 2 vient déjà à vélo et ne mange pas de viande : rien à « remplacer ».
delete from validations where user_id = '00000000-0000-0000-0000-000000000002' and day = current_date;
delete from user_challenges where user_id = '00000000-0000-0000-0000-000000000002';
insert into habits (user_id, commute_mode, commute_km, commute_days, beef_meals_week, other_meat_meals_week,
                    short_flights_year, long_flights_year, new_clothes_year, buys_new_phone, heating, heating_kg_year)
values ('00000000-0000-0000-0000-000000000002', 'velo', 5, 4, 0, 0, 0, 0, 5, false, 'gaz', 800)
on conflict (user_id) do update set commute_mode = 'velo', beef_meals_week = 0, other_meat_meals_week = 0,
  short_flights_year = 0, long_flights_year = 0;

-- 1. Une bonne habitude rapporte autant qu'un changement.
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
create temp table a1 as select log_action('velo', 'base') as j;
create temp table a2 as select log_action('velo', 'base') as j;
select pg_temp.check((select (j->>'kg')::numeric = 0 and (j->>'base_points')::int = 10 from a1), 'vélo déjà habituel : 0 kg, mais 10 pousses');
select pg_temp.check((select (j->>'base_points')::int = 10 from a2), 'second trajet à vélo : 10 pousses aussi');
create temp table a3 as select log_action('escaliers', 'base') as j;
create temp table a4 as select log_action('gourde', 'base') as j;
create temp table a5 as select log_action('ecran', 'base') as j;
select pg_temp.check((select (a3.j->>'base_points')::int = 2 and (a5.j->>'base_points')::int = 0 from a3, a5),
                     'petits gestes : plafonnés à 5 pousses par jour, tous confondus');

-- 2. Les grosses actions demandent un justificatif.
select pg_temp.expect_error($$select log_action('train', '500')$$, '%receipt_required%', 'train sans billet : refusé');
select pg_temp.expect_error($$select log_action('vacances_train', 'base')$$, '%receipt_required%', 'vacances en train sans réservation : refusé');
select pg_temp.expect_error($$select log_action('reparation', 'smartphone')$$, '%receipt_required%', 'réparation sans facture : refusé');

-- 3. Défis : objectif minimum et un seul défi en cours par action.
select pg_temp.expect_error($$insert into user_challenges (user_id, company_id, template_id, variant, target, starts_on, ends_on)
  select id, company_id, 'vege', 'base', 1, current_date, current_date + 6 from profiles where id = auth.uid()$$,
  '%target_too_small%', 'défi de 1 repas : refusé');
insert into user_challenges (user_id, company_id, template_id, variant, target, starts_on, ends_on)
select id, company_id, 'vege', 'base', 3, current_date, current_date + 6 from profiles where id = auth.uid();
select pg_temp.check(true, 'défi de 3 repas : accepté');
select pg_temp.expect_error($$insert into user_challenges (user_id, company_id, template_id, variant, target, starts_on, ends_on)
  select id, company_id, 'vege', 'base', 5, current_date, current_date + 29 from profiles where id = auth.uid()$$,
  '%challenge_exists%', 'un second défi sur la même action : refusé');
insert into user_challenges (user_id, company_id, template_id, variant, target, starts_on, ends_on)
select id, company_id, 'chauffage', 'base', 1, current_date, current_date + 6 from profiles where id = auth.uid();
select pg_temp.check(true, 'action hebdomadaire (chauffage) : objectif de 1 accepté');
reset role;

-- 4. Classement : l'effectif compte tous les membres, la moyenne est lissée.
create temp table before_s as
  select * from team_scores((select company_id from profiles where id = '00000000-0000-0000-0000-000000000001'), null);
select pg_temp.check((select members from before_s where team_name = 'Data') =
                     (select count(*) from profiles p join teams t on t.id = p.team_id where t.name = 'Data'),
                     'effectif de Data : tous ses membres');
select pg_temp.check(not exists (select 1 from before_s where team_name in ('Finance', 'Autres équipes')),
                     'équipes de moins de 5 membres : pas classées ni regroupées');
-- Un membre inactif qui ne partage pas ses pousses ne fait pas monter son équipe.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000031', 'inactif@demo.fr') on conflict do nothing;
insert into profiles (id, company_id, team_id, display_name, consent_data, consent_team_stats)
select '00000000-0000-0000-0000-000000000031', company_id, team_id, 'Inactif', true, false
from profiles where id = '00000000-0000-0000-0000-000000000001'
on conflict (id) do nothing;
create temp table after_s as
  select * from team_scores((select company_id from profiles where id = '00000000-0000-0000-0000-000000000001'), null);
select pg_temp.check((select a.score < b.score and a.members = b.members + 1
                      from after_s a, before_s b where a.team_name = 'Data' and b.team_name = 'Data'),
                     'un inactif qui ne partage pas compte quand même dans l''effectif');
-- Lissage : score = (pousses + 3 × moyenne de l'entreprise) / (membres + 3).
select pg_temp.check((select s.score = round((s.points + 3 * (
                        select sum(case when p.consent_team_stats then member_points(p.id, null) else 0 end)::numeric / count(*)
                        from profiles p where p.company_id = (select company_id from profiles where id = '00000000-0000-0000-0000-000000000001')
                          and p.team_id is not null)) / (s.members + 3), 1)
                      from after_s s where s.team_name = 'Data'), 'score lissé vers la moyenne de l''entreprise');
