-- Rappels push : abonnements cloisonnés, clé du cron, une relance par jour, seulement si rien fait aujourd'hui.
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
create function pg_temp.expect_error(q text, msg text, label text) returns void language plpgsql as $$
begin
  execute q;
  raise exception 'ÉCHEC : % (aucune erreur)', label;
exception when others then
  if sqlerrm like 'ÉCHEC%' or position(msg in sqlerrm) = 0 then raise; end if;
  raise notice 'ok : %', label;
end $$;

insert into cron_keys values ('rappels', encode(sha256(convert_to('cle-de-test-cle-de-test-cle-de-test', 'UTF8')), 'hex'));

-- Chacun inscrit son téléphone, et ne voit que le sien.
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
insert into push_subscriptions (endpoint, user_id, p256dh, auth) values ('https://push.test/hugo', auth.uid(), 'k', 'a');
do $$ begin
  insert into push_subscriptions (endpoint, user_id, p256dh, auth)
  values ('https://push.test/faux', '00000000-0000-0000-0000-000000000003', 'k', 'a');
  raise exception 'ÉCHEC : abonnement au nom d''un autre';
exception when insufficient_privilege then raise notice 'ok : pas d''abonnement au nom d''un autre';
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
insert into push_subscriptions (endpoint, user_id, p256dh, auth) values ('https://push.test/ines', auth.uid(), 'k', 'a');
select pg_temp.check((select count(*) from push_subscriptions) = 1, 'je ne vois que mon abonnement');
select pg_temp.check((my_reminder()->>'active_today')::boolean, 'Inès a déjà agi aujourd''hui (scanner)');
reset role;

create temp table hugo as select exists (select 1 from active_days('00000000-0000-0000-0000-000000000005') a where a = current_date) as active;
grant select on hugo to anon;

-- Le cron, sans session : il lui faut la bonne clé.
set role anon;
select pg_temp.expect_error($$select * from reminders_due('mauvaise-cle-mauvaise-cle-mauvaise-cle')$$, 'forbidden', 'clé du cron vérifiée');
select pg_temp.check((select count(*) from push_subscriptions) = 0, 'abonnements invisibles sans session');
create temp table due as select * from reminders_due('cle-de-test-cle-de-test-cle-de-test');
select pg_temp.check(not exists (select 1 from due where endpoint = 'https://push.test/ines'), 'pas de rappel à qui a déjà agi aujourd''hui');
select pg_temp.check(
  exists (select 1 from due where endpoint = 'https://push.test/hugo')
  = not (select active from hugo),
  'rappel à Hugo seulement s''il n''a rien fait aujourd''hui');
select reminders_sent('cle-de-test-cle-de-test-cle-de-test', array['https://push.test/hugo'], array['https://push.test/ines']);
select pg_temp.check(not exists (select 1 from reminders_due('cle-de-test-cle-de-test-cle-de-test')), 'une seule relance par jour');
reset role;
select pg_temp.check(not exists (select 1 from push_subscriptions where endpoint = 'https://push.test/ines'), 'abonnement expiré retiré');

delete from push_subscriptions;
delete from cron_keys;
\echo 'Tous les tests du scénario rappels sont passés.'
