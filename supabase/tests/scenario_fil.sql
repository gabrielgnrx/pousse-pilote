-- Scénario « tout passe dans le fil » (migration 0022), après scenario_plusieurs.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
create function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;
create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'ÉCHEC : %', label; end if;
  raise notice 'ok : %', label;
end $$;
set client_min_messages = notice;

select pg_temp.as_admin();
select pg_temp.check((select count(*) from validations v join challenge_templates t on t.id = v.template_id
                      where t.requires_receipt and (v.proof_photo_path is not null or v.receipt_path is null)) = 0,
                     'les reçus existants sont rangés à part');
delete from validations where day = current_date and user_id in ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006');

-- 1. Sans choix fait, rien ne devient public.
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
create temp table r0 as select log_action('escaliers', 'base') as r;
select pg_temp.as_admin();
select pg_temp.check((select visibility from validations where id = (select (r ->> 'id')::uuid from r0)) = 'private',
                     'pas encore de choix : l''action reste privée');

-- 2. Après accord : chaque action va dans le fil.
update profiles set feed_choice_at = now() - interval '1 minute' where id in ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006');
update profiles set share_feed = false where id = '00000000-0000-0000-0000-000000000006';
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
create temp table r1 as select log_action('gourde', 'base') as r;
create temp table r2 as select log_action('appli_antigaspi', 'base', '00000000-0000-0000-0000-000000000005/recu.jpg') as r;
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
create temp table r3 as select log_action('gourde', 'base') as r;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from validations where id = (select (r ->> 'id')::uuid from r1)) = 1,
                     'un collègue voit l''action dans le fil');
select pg_temp.check((select count(*) from validations where id = (select (r ->> 'id')::uuid from r2)) = 1,
                     'l''achat via appli est dans le fil');
select pg_temp.check((select proof_photo_path from validations where id = (select (r ->> 'id')::uuid from r2)) is null,
                     'sans aucune photo lisible par les collègues');
select pg_temp.check((select receipt_path from validations where id = (select (r ->> 'id')::uuid from r2)) is not null,
                     'le chemin du reçu existe, mais la règle de lecture des photos ne regarde que proof_photo_path');
select pg_temp.check((select count(*) from validations where id = (select (r ->> 'id')::uuid from r3)) = 0,
                     'qui a dit non reste privé');
select pg_temp.as_admin();
select pg_temp.check((select receipt_path from validations where id = (select (r ->> 'id')::uuid from r2)) = '00000000-0000-0000-0000-000000000005/recu.jpg',
                     'le reçu est bien gardé, à part');

-- 3. Les défis lancés et réussis apparaissent aussi.
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
insert into user_challenges (id, user_id, company_id, template_id, variant, target, starts_on, ends_on)
select 'f1000000-0000-0000-0000-000000000005', id, company_id, 'escaliers', 'base', 2, current_date, current_date + 6
from profiles where id = auth.uid();
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from company_challenge_feed() where id = 'f1000000-0000-0000-0000-000000000005' and event = 'lance') = 1,
                     'un défi lancé apparaît dans le fil');
select pg_temp.as_admin();
update user_challenges set status = 'done' where id = 'f1000000-0000-0000-0000-000000000005';
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from company_challenge_feed() where id = 'f1000000-0000-0000-0000-000000000005' and event = 'reussi') = 1,
                     'un défi réussi aussi');
select pg_temp.check((select count(*) from company_challenge_feed() where user_id = '00000000-0000-0000-0000-000000000006') = 0,
                     'rien pour qui a dit non');
select pg_temp.check((select count(*) from company_challenge_feed() c join profiles p on p.id = c.user_id
                      where p.feed_choice_at is null) = 0, 'rien d''avant l''accord');
select pg_temp.as_user('00000000-0000-0000-0000-000000000010');
select pg_temp.check((select count(*) from company_challenge_feed()) = 0, 'rien pour une autre entreprise');
select pg_temp.as_admin();
