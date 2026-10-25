-- Scénario v2 (migration 0038) : lancement self-serve, agrégats seulement, rien sous 5 personnes.
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

-- 1. Une admin RSE crée son organisation (elle n'a pas besoin d'être participante).
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000381', 'claire.rse@verdure.fr');
select pg_temp.as_user('00000000-0000-0000-0000-000000000381');
select pg_temp.expect_error($$select create_organization('Verdure Conseil', 'autre.fr', array['Data'])$$, '%domain_mismatch%', 'domaine d''une autre entreprise : refusé');
select pg_temp.expect_error($$select create_organization('X', null, array['Data'])$$, '%invalid_name%', 'nom trop court : refusé');
create temp table org as select create_organization('Verdure Conseil', 'verdure.fr', array['Data', 'Conseil', 'Ops']) as j;
grant select on org to public;
select pg_temp.check((select (j->>'join_code') ~ '^VERDUR-[0-9A-F]{4}$' from org), 'code d''invitation généré');
select pg_temp.check((select count(*) = 3 from jsonb_array_elements((select teams from my_admin_organizations() limit 1))), '3 équipes créées');
select pg_temp.check(admin_add_teams(((select j from org)->>'company_id')::uuid, array['Finance', 'Data']) = 1, 'équipe ajoutée, doublon ignoré');

-- 2. Tableau de bord d'une organisation de moins de 5 personnes : totaux masqués.
select pg_temp.check((select (d->>'participants')::int = 0 and d->'kg_total' = 'null'::jsonb
                      from (select admin_dashboard(((select j from org)->>'company_id')::uuid) as d) x), 'moins de 5 participants : totaux masqués');
reset role;

-- 3. L'entreprise démo : l'admin voit des agrégats, jamais une ligne.
create temp table demo as select id from companies where join_code = 'DEMO-2026';
grant select on demo to public;
insert into organization_admins (company_id, user_id) select id, '00000000-0000-0000-0000-000000000381' from demo;
select pg_temp.as_user('00000000-0000-0000-0000-000000000381');
create temp table dash as select admin_dashboard((select id from demo)) as d;
grant select on dash to public;
select pg_temp.check((select (d->>'participants')::int >= 5 and (d->>'kg_total')::numeric >= 0 and jsonb_array_length(d->'weeks') = 12 from dash),
                     'agrégats de l''entreprise démo');
select pg_temp.check(not exists (select 1 from validations) and not exists (select 1 from habits) and not exists (select 1 from footprints),
                     'aucune ligne individuelle lisible par l''admin');
select pg_temp.check((select bool_and((w->>'active') is null or (w->>'active')::int >= 5) from dash, jsonb_array_elements(d->'weeks') w),
                     'tendance : aucune semaine sous 5 personnes actives');
select pg_temp.check((select bool_and((t->>'members')::int >= 5) from dash, jsonb_array_elements(d->'teams') t), 'classement : équipes de 5 membres au moins');

-- 4. Données du rapport et export CSV.
create temp table rep as select admin_report_data((select id from demo), current_date) as r;
grant select on rep to public;
select pg_temp.check((select r ? 'kg' and r ? 'quotes' and r ? 'top_actions' from rep), 'données du rapport mensuel');
select pg_temp.check((select bool_and((t->>'people')::int >= 5) from rep, jsonb_array_elements(r->'top_actions') t), 'actions phares : 5 personnes au moins');
select pg_temp.check((select bool_and(people is null or people >= 5)
                      from admin_mobility_csv((select id from demo), current_date - 60, current_date)),
                     'CSV mobilité : aucune ligne sous 5 personnes');
reset role;

-- 5. Un salarié n'a accès à rien de tout cela.
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.expect_error($$select admin_dashboard((select company_id from profiles where id = auth.uid()))$$, '%not_admin%', 'tableau de bord refusé à un salarié');
select pg_temp.expect_error($$select admin_report_data((select company_id from profiles where id = auth.uid()), current_date)$$, '%not_admin%', 'rapport refusé à un salarié');
select pg_temp.expect_error($$select * from admin_mobility_csv((select company_id from profiles where id = auth.uid()), current_date - 30, current_date)$$, '%not_admin%', 'export refusé à un salarié');
reset role;

-- 6. Anonymisation des verbatims : les prénoms deviennent « un collègue ».
select pg_temp.check(anonymize_text('Merci Léa et léa ! Bravo Malik.', array['Léa', 'Malik']) = 'Merci un collègue et un collègue ! Bravo un collègue.',
                     'verbatims : prénoms remplacés');
select set_config('request.jwt.claim.sub', '', false);
