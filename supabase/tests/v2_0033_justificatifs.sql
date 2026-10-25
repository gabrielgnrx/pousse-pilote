-- Scénario v2 (migration 0033) : verdicts des justificatifs, écrits par le serveur seulement.
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

-- Nora enregistre un train avec son billet : vérification en attente.
select pg_temp.as_user('00000000-0000-0000-0000-000000000281');
create temp table logged as select log_action_slug('train', 300, '00000000-0000-0000-0000-000000000281/billet-1.jpg') as j;
reset role;
create temp table train as
  select id, points, kg from validations where id = ((select j from logged)->>'id')::uuid;
grant select on train to public;
select pg_temp.check((select proof_status = 'pending' from validations where id = (select id from train)), 'billet déposé : vérification en attente');

-- 1. Un salarié ne peut pas écrire son verdict.
select pg_temp.as_user('00000000-0000-0000-0000-000000000281');
select pg_temp.expect_error(format($$select record_proof_verdict(%L, 'accepted', 'conforme', 'm', 'v')$$, (select id from train)),
                            '%permission denied%', 'verdict par le salarié : refusé');
reset role;

-- 2. Doute : pousses mises de côté, CO₂ gardé ; une seconde photo est possible.
set role service_role;
select record_proof_verdict((select id from train), 'needs_review', 'illisible', 'claude-haiku-5-5', 'proof-check@1');
reset role;
select pg_temp.check((select v.points = 0 and v.kg = t.kg and v.status = 'valid' and v.proof_status = 'needs_review'
                      from validations v, train t where v.id = t.id), 'doute : pousses de côté, CO₂ gardé');
select pg_temp.as_user('00000000-0000-0000-0000-000000000281');
select pg_temp.expect_error(format($$select resubmit_proof(%L, 'autre/photo.jpg')$$, (select id from train)), '%invalid_photo%', 'photo d''un autre dossier : refusée');
select resubmit_proof((select id from train), '00000000-0000-0000-0000-000000000281/billet-2.jpg');
reset role;
select pg_temp.check((select proof_status = 'pending' from validations where id = (select id from train)), 'seconde photo : de nouveau en attente');

-- 3. Acceptée : les pousses reviennent, le justificatif est à effacer.
set role service_role;
create temp table ok as select record_proof_verdict((select id from train), 'accepted', 'conforme', 'claude-haiku-5-5', 'proof-check@1') as j;
reset role;
select pg_temp.check((select v.points = t.points and v.proof_status = 'accepted' and v.receipt_path is null
                      from validations v, train t where v.id = t.id), 'acceptée : pousses rendues, chemin effacé');
select pg_temp.check((select j->>'photo_to_delete' like '%/billet-2.jpg' from ok), 'acceptée : photo à supprimer du stockage');
select pg_temp.check((select count(*) = 2 and bool_and(reason_code ~ '^[a-z_]+$') from proof_checks where validation_id = (select id from train)),
                     'journal des verdicts, sans donnée lue sur le billet');
set role service_role;
select pg_temp.expect_error(format($$select record_proof_verdict(%L, 'accepted', 'conforme', 'm', 'v')$$, (select id from train)),
                            '%nothing_to_check%', 'pas de second verdict sans nouvelle photo');
reset role;

-- 4. Rejetée : l'action est annulée.
select pg_temp.as_user('00000000-0000-0000-0000-000000000281');
create temp table r as select log_action_slug('reparation_ordinateur', 1, '00000000-0000-0000-0000-000000000281/facture.jpg') as j;
grant select on r to public;
reset role;
set role service_role;
select record_proof_verdict(((select j from r)->>'id')::uuid, 'rejected', 'pas_un_justificatif', 'claude-haiku-5-5', 'proof-check@1');
reset role;
select pg_temp.check((select status = 'rejected' and proof_status = 'rejected' and receipt_path is null
                      from validations where id = ((select j from r)->>'id')::uuid), 'rejetée : action annulée, photo à effacer');
select set_config('request.jwt.claim.sub', '', false);

-- 5. La personne est prévenue des verdicts « à renvoyer » et « rejeté ».
select pg_temp.check((select count(*) = 2 from alerts where user_id = '00000000-0000-0000-0000-000000000281' and kind = 'justificatif'),
                     'verdicts notifiés');
-- 6. Journal du serveur : réservé à la clé de service.
select pg_temp.as_user('00000000-0000-0000-0000-000000000281');
select pg_temp.expect_error($$select ai_log_service(null, 'proof-check', 'v1', 'm', 'ok')$$, '%permission denied%', 'journal du serveur : interdit aux salariés');
reset role;
select set_config('request.jwt.claim.sub', '', false);
