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

-- Le classement d'un mois ne compte que les actions de ce mois.
create temp table d41 as select id from companies where join_code = 'DEMO-2026';
grant select on d41 to public;
select pg_temp.check((select coalesce(sum(kg), 0) from team_scores_between((select id from d41), date '2000-01-01', date '2000-02-01')) = 0,
                     'mois sans action : 0 kg par équipe');
select pg_temp.check((select coalesce(sum(kg), 0) from team_scores_between((select id from d41), date '2000-01-01', current_date + 1))
                     = (select coalesce(sum(kg), 0) from team_scores((select id from d41), null)),
                     'toute la période : même total que team_scores');
select pg_temp.as_user('00000000-0000-0000-0000-000000000381');
select pg_temp.check((select jsonb_array_length(admin_report_data((select id from d41), date '2000-01-15')->'teams') >= 0), 'rapport d''un mois passé : classement calculé');
reset role;
select set_config('request.jwt.claim.sub', '', false);
