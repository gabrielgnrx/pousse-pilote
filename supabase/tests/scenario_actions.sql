-- Scénario « actions libres » (migration 0012), à jouer après scenario.sql, scenario_engagement.sql,
-- scenario_rappels.sql et scenario_jeu.sql, sur la même base.
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

-- 1. Petit geste du quotidien : 0 kg, 2 pousses, une fois par jour.
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.check((r->>'kg')::numeric = 0 and (r->>'points')::int = 2 and r->'challenge' = 'null'::jsonb,
                     'escaliers : 0 kg, 2 pousses, sans défi') from log_action('escaliers') r;
select pg_temp.expect_error($$select log_action('escaliers')$$, 'cap_reached', 'escaliers : une fois par jour');
select pg_temp.expect_error($$select log_action('inconnu')$$, 'unknown_action', 'action inconnue refusée');

-- 2. Déjà à vélo dans son bilan : l'action rapporte ses pousses, mais 0 kg (rien n'est remplacé).
select pg_temp.check((r->>'kg')::numeric = 0 and (r->>'points')::int > 0, 'vélo déjà déclaré : pousses, 0 kg')
from log_action('velo') r;

-- 3. En voiture dans son bilan : le vélo compte le CO₂ du trajet déclaré (10 km × 0,1106).
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select pg_temp.check((r->>'kg')::numeric = 1.106 and (r->>'month_count')::int = 1, 'vélo au lieu de la voiture : 1,106 kg')
from log_action('velo') r;
select log_action('velo');
select pg_temp.expect_error($$select log_action('transports')$$, 'cap_reached', 'trajets : 2 par jour, tous modes confondus');

-- 4. Un défi en cours sur la même action : l'action y compte.
select pg_temp.check((r->'challenge'->>'id') = '20000000-0000-0000-0000-000000000002'
                     and (r->'challenge'->>'done')::int = 1 + (select count(*) from validations
                       where challenge_id = '20000000-0000-0000-0000-000000000002' and status = 'valid')
                     and (r->'challenge'->>'target')::int = 5 and (r->>'kg')::numeric = 4.12,
                     'repas végé au lieu du bœuf : 4,12 kg, compte pour le défi en cours')
from log_action('vege', 'boeuf') r;
select pg_temp.check((select points from validations where user_id = auth.uid() and template_id = 'vege'
                      order by created_at desc limit 1) = 10, 'sans preuve : les pousses de l''action, sans bonus');

-- 5. Publier avec une photo : +5 pousses, visible dans le fil, une seule fois, par l'auteur seulement.
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.expect_error(
  $$select publish_action((select id from validations where user_id = '00000000-0000-0000-0000-000000000006'
                            and template_id = 'vege' order by created_at desc limit 1),
                          '00000000-0000-0000-0000-000000000003/x.jpg')$$,
  'nothing_to_publish', 'impossible de publier l''action d''un collègue');
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select pg_temp.expect_error(
  $$select publish_action((select id from validations where user_id = auth.uid() and template_id = 'vege'
                            order by created_at desc limit 1), '00000000-0000-0000-0000-000000000003/x.jpg')$$,
  'invalid_photo', 'photo d''un autre dossier refusée');
select pg_temp.check(v.points = 15 and v.visibility = 'company' and v.proof_level = 1, 'publiée : +5 pousses, dans le fil')
from publish_action((select id from validations where user_id = auth.uid() and template_id = 'vege'
                     order by created_at desc limit 1),
                    '00000000-0000-0000-0000-000000000006/repas.jpg', ' Lentilles ! ') v;
select pg_temp.expect_error(
  $$select publish_action((select id from validations where user_id = auth.uid() and template_id = 'vege'
                            order by created_at desc limit 1), '00000000-0000-0000-0000-000000000006/b.jpg')$$,
  'nothing_to_publish', 'une seule publication par action');

-- 6. Le compteur commun de l'entreprise.
select pg_temp.check((p->>'kg')::numeric >= 2.2 and (p->>'today_kg')::numeric >= 2.2
                     and (p->>'active_today')::int >= 2 and (p->>'my_kg')::numeric >= 2.2
                     and (p->>'goal_kg')::numeric >= 30, 'compteur de l''entreprise')
from company_pulse() p;

-- 7. Les actions libres comptent pour la série et pour la quête « défi ».
reset role;
select pg_temp.check(quest_done('00000000-0000-0000-0000-000000000005', 'defi'), 'quête défi remplie par une action libre');
select pg_temp.check(current_date in (select active_days('00000000-0000-0000-0000-000000000005')), 'jour actif');
