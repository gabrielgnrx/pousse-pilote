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

-- Un salarié qui accepte l'IA : appel accepté. Puis il la refuse depuis son profil : tout appel est refusé.
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check(ai_consume('parse_action', 100, 10000), 'IA acceptée : appel accepté');
update profiles set consent_ai = false where id = auth.uid();
select pg_temp.check(not ai_consume('parse_action', 100, 10000), 'IA refusée : appel refusé par la base');
reset role;

-- Le plan du lundi ne passe pas par le coach pour lui.
select pg_temp.check(coalesce((select not active_recently from plan_pending('cle-ia-de-test-assez-longue-pour-passer-0123456789', 100)
                               where user_id = '00000000-0000-0000-0000-000000000002'), true),
                     'plan du lundi : pas de coach IA pour une personne qui a refusé l''IA');

update profiles set consent_ai = true where id = '00000000-0000-0000-0000-000000000002';
select set_config('request.jwt.claim.sub', '', false);
