-- Scénario v2 (migration 0029) : journal des appels IA, quotas et cache.
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
set client_min_messages = notice;

-- 1. Journal : la personne et son organisation sont fixées par la base, pas par l'appelant.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select ai_log('parse-action', 'v1', 'claude-haiku-5-5', 'ok', 120, 40, 0, 850, 0.000032);
reset role;
select pg_temp.check((select company_id = (select company_id from profiles where id = '00000000-0000-0000-0000-000000000001')
                             and user_id = '00000000-0000-0000-0000-000000000001' and input_tokens = 120
                      from ai_calls order by id desc limit 1),
                     'journal : personne et organisation de la session');

select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check(not exists (select 1 from ai_calls), 'journal : illisible pour un salarié');
select pg_temp.expect_error($$insert into ai_calls (task, prompt_version, model, status) values ('x', 'v1', 'm', 'ok')$$,
                            '%', 'journal : pas d''écriture directe');
select pg_temp.expect_error($$select ai_log('Parse Action !', 'v1', 'm', 'ok')$$, '%', 'journal : nom de tâche contrôlé');

-- Sans session ni clé de tâche planifiée : refusé.
select pg_temp.as_nobody();
select pg_temp.expect_error($$select ai_log('animateur', 'v1', 'claude-sonnet-5-5', 'ok')$$, '%not_allowed%', 'journal : anonyme refusé');
reset role;

-- Avec la clé « ia » (tâches planifiées) : accepté, pour l'organisation passée.
insert into cron_keys (name, sha256)
values ('ia', encode(sha256(convert_to('cle-ia-de-test-assez-longue-pour-passer-0123456789', 'UTF8')), 'hex'))
on conflict (name) do update set sha256 = excluded.sha256;
select pg_temp.as_nobody();
select ai_log('animateur', 'v1', 'claude-sonnet-5-5', 'ok', 900, 120, 0, 2100, 0.003, null,
              'cle-ia-de-test-assez-longue-pour-passer-0123456789',
              (select id from companies where join_code = 'DEMO-2026'));
reset role;
select pg_temp.check((select user_id is null and task = 'animateur' from ai_calls order by id desc limit 1),
                     'journal : tâche planifiée sans personne');

-- 2. Quotas : plafond par personne, puis par organisation.
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check(ai_consume('parse-action', 2, 100) and ai_consume('parse-action', 2, 100), 'quota : 2 appels sous le plafond');
select pg_temp.check(not ai_consume('parse-action', 2, 100), 'quota : le troisième est refusé');
select pg_temp.check(ai_consume('plan-coach', 2, 100), 'quota : compté par tâche');
reset role;
select pg_temp.check((select used from ai_quota where scope = 'user' and subject = '00000000-0000-0000-0000-000000000002'
                      and task = 'parse-action') = 2, 'quota : un refus ne consomme rien');
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.check(not ai_consume('parse-action', 10, 2), 'quota : plafond de l''organisation atteint pour un collègue');
reset role;

-- 3. Cache : clé de hachage, lecture par la session, expiration.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select ai_cache_put(repeat('a', 64), 'parse-action', '{"actions": [{"action": "velo", "quantity": 8}]}', 24);
select pg_temp.check(ai_cache_get(repeat('a', 64)) -> 'actions' -> 0 ->> 'action' = 'velo', 'cache : relu');
select pg_temp.check(ai_cache_get(repeat('b', 64)) is null, 'cache : clé absente');
select pg_temp.expect_error($$select ai_cache_put('pas-un-hash', 'x', '{}', 1)$$, '%', 'cache : clé contrôlée');
select pg_temp.check(not exists (select 1 from ai_cache), 'cache : table illisible directement');
reset role;
update ai_cache set expires_at = now() - interval '1 minute' where key = repeat('a', 64);
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check(ai_cache_get(repeat('a', 64)) is null, 'cache : expiré');
reset role;

-- 4. Suppression de compte : le journal garde la ligne sans la personne, les quotas partent.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000291', 'temp@demo.fr');
select pg_temp.as_user('00000000-0000-0000-0000-000000000291');
select join_company('DEMO-2026', null, 'Temp', true, true);
select ai_log('parse-action', 'v1', 'claude-haiku-5-5', 'ok');
select ai_consume('parse-action', 5, 100);
select delete_my_account();
reset role;
select pg_temp.check(not exists (select 1 from ai_calls where user_id = '00000000-0000-0000-0000-000000000291')
                     and not exists (select 1 from ai_quota where subject = '00000000-0000-0000-0000-000000000291'),
                     'suppression de compte : plus rien qui désigne la personne');
select set_config('request.jwt.claim.sub', '', false);
