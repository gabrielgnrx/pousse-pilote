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

create temp table demo2 as select id from companies where join_code = 'DEMO-2026';
grant select on demo2 to public;

-- L'admin du scénario 0038 (sans profil) journalise un rapport et consomme son quota.
select pg_temp.as_user('00000000-0000-0000-0000-000000000381');
select admin_ai_log((select id from demo2), 'rapport', 'rapport@1', 'claude-sonnet-5-5', 'ok', 1000, 500, 0, 4000, 0.01, null);
select pg_temp.check(admin_ai_consume((select id from demo2), 'rapport', 2), '1er rapport du jour : accepté');
select pg_temp.check(admin_ai_consume((select id from demo2), 'rapport', 2), '2e rapport du jour : accepté');
select pg_temp.check(not admin_ai_consume((select id from demo2), 'rapport', 2), '3e rapport du jour : refusé');
select pg_temp.check(not admin_ai_consume((select id from demo2), 'Rapport!', 2), 'nom de tâche invalide : refusé');
reset role;
select pg_temp.check((select count(*) = 1 from ai_calls where company_id = (select id from demo2) and task = 'rapport' and user_id is null),
                     'appel journalisé au nom de l''organisation, sans utilisateur');

-- Un salarié ne peut ni journaliser ni consommer au nom de l'organisation.
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.expect_error($$select admin_ai_log((select id from demo2), 'rapport', 'v', 'm', 'ok')$$, '%not_admin%', 'journal admin refusé à un salarié');
select pg_temp.expect_error($$select admin_ai_consume((select id from demo2), 'rapport', 5)$$, '%not_admin%', 'quota admin refusé à un salarié');
reset role;
select set_config('request.jwt.claim.sub', '', false);
