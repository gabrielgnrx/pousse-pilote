-- Scénario v2 (migration 0034) : rendez-vous de l'animateur et limite de fréquence.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
create function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;
create function pg_temp.as_nobody() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
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
-- Un instant de la semaine en cours, en heure de Paris (jour 0 = lundi).
create function pg_temp.at(days integer, hm text) returns timestamptz language sql stable as $$
  select ((date_trunc('week', (now() at time zone 'Europe/Paris'))::date + days) + hm::time) at time zone 'Europe/Paris'
$$;
create function pg_temp.k() returns text language sql as $$ select 'cle-ia-de-test-assez-longue-pour-passer-0123456789' $$;
set client_min_messages = notice;

create temp table data_team as select id from teams where name = 'Data' and company_id = (select id from companies where join_code = 'DEMO-2026');
grant select on data_team to public;

select pg_temp.as_nobody();
select pg_temp.expect_error($$select * from animator_due('mauvaise-cle-mauvaise-cle-mauvaise-cle')$$, '%not_allowed%', 'sans clé : refusé');

-- 1. Lundi 9 h 05 : ouverture du vote, avec les 3 propositions de la semaine.
create temp table due1 as select * from animator_due(pg_temp.k(), pg_temp.at(0, '09:05')) where team_id = (select id from data_team);
select pg_temp.check((select slot = 'vote_open' and jsonb_array_length(context->'options') = 3 and context ? 'last_week' from due1),
                     'lundi 9 h : ouverture du vote due, 3 propositions');
select pg_temp.check(animator_post(pg_temp.k(), (select id from data_team), 'vote_open', '', 'C''est lundi : votez pour le défi de la semaine !',
                                   (select jsonb_build_object('rank', context->'rank') from due1), pg_temp.at(0, '09:05')),
                     'message d''ouverture posté');
select pg_temp.check(not animator_post(pg_temp.k(), (select id from data_team), 'vote_open', '', 'Doublon', '{}', pg_temp.at(0, '09:15')),
                     'pas deux ouvertures le même jour');
select pg_temp.check(not exists (select 1 from animator_due(pg_temp.k(), pg_temp.at(0, '09:15')) d where d.team_id = (select id from data_team) and d.slot = 'vote_open'),
                     'ouverture plus due une fois postée');
reset role;

-- 2. Le message est un message de bot, lisible par l'équipe seulement.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check(exists (select 1 from team_messages where author_kind = 'animateur' and user_id is null and body like 'C''est lundi%'),
                     'message de l''animateur visible dans le chat, marqué bot');
select pg_temp.expect_error($$insert into team_messages (company_id, team_id, body, author_kind) select company_id, team_id, 'faux bot', 'animateur' from profiles where id = auth.uid()$$,
                            '%', 'un salarié ne peut pas se faire passer pour l''animateur');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000281');
select pg_temp.check(not exists (select 1 from team_messages where author_kind = 'animateur' and body like 'C''est lundi%'),
                     'une autre équipe ne le voit pas');
reset role;

-- 3. Lundi 14 h 05 : le défi retenu ; la base ne poste plus l'annonce fixe elle-même.
select pg_temp.as_nobody();
create temp table due2 as select * from animator_due(pg_temp.k(), pg_temp.at(0, '14:05')) where team_id = (select id from data_team) and slot = 'vote_close';
select pg_temp.check((select context->>'chosen' is not null and (context->>'target')::int > 0 from due2), 'lundi 14 h : défi retenu, objectif');
reset role;

-- 4. Limite de fréquence : un seul message spontané par jour et par équipe.
select pg_temp.as_nobody();
select pg_temp.check(animator_post(pg_temp.k(), (select id from data_team), 'reaction', 'palier:test', 'Bravo l''équipe, 50 kg évités !', '{}', pg_temp.at(2, '11:00')),
                     'première réaction du jour : postée');
select pg_temp.check(not animator_post(pg_temp.k(), (select id from data_team), 'midweek', '', 'On relance ?', '{}', pg_temp.at(2, '15:00')),
                     'second message spontané le même jour : refusé');
select pg_temp.check(not exists (select 1 from animator_due(pg_temp.k(), pg_temp.at(2, '15:00')) d where d.team_id = (select id from data_team)),
                     'plus rien de spontané dû ce jour-là');
select pg_temp.check(animator_post(pg_temp.k(), (select id from data_team), 'vote_close', '', 'Défi retenu !', '{}', pg_temp.at(2, '15:30')),
                     'les messages fixes ne sont pas concernés par la limite');

-- 5. Vendredi 16 h 05 : le bilan, avec les prénoms des seules personnes qui ont publié.
-- La personne 1 publie une action cette semaine ; la personne 3 a des actions, toutes privées.
reset role;
update validations set visibility = 'private'
 where user_id in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003');
update validations set visibility = 'company', day = date_trunc('week', (now() at time zone 'Europe/Paris'))::date
 where id = (select id from validations where user_id = '00000000-0000-0000-0000-000000000001' and status = 'valid' order by created_at desc limit 1);
update validations set day = date_trunc('week', (now() at time zone 'Europe/Paris'))::date
 where id = (select id from validations where user_id = '00000000-0000-0000-0000-000000000003' and status = 'valid' order by created_at desc limit 1);
select pg_temp.as_nobody();
create temp table due3 as select * from animator_due(pg_temp.k(), pg_temp.at(4, '16:05')) where slot = 'friday';
reset role;
select pg_temp.check((select bool_and(context ? 'kg' and context ? 'publishers') from due3), 'vendredi : bilan dû pour chaque équipe');
select pg_temp.check((select (context->'publishers') ? (select display_name from profiles where id = '00000000-0000-0000-0000-000000000001')
                             and not (context->'publishers') ? (select display_name from profiles where id = '00000000-0000-0000-0000-000000000003')
                      from due3 where team_id = (select id from data_team)),
                     'vendredi : seules les personnes qui ont publié sont nommées');
reset role;
select set_config('request.jwt.claim.sub', '', false);
