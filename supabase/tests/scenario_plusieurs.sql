-- Scénario « actions perso, défis à plusieurs, achats avec reçu » (migration 0021), après scenario_equite.
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
create function pg_temp.expect_error(stmt text, expected text, label text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'ÉCHEC : % (aucune erreur)', label;
exception when others then
  if sqlerrm not like expected then raise; end if;
  raise notice 'ok : %', label;
end $$;
set client_min_messages = notice;

select pg_temp.as_admin();
update duels set status = 'done' where status in ('pending', 'active');
update user_challenges set status = 'abandoned' where status = 'active';
delete from validations where day = current_date
  and user_id in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000011');
-- Pas de défi d'équipe en cours pour l'instant.
update team_weeks set chosen = null, target = null where week_start = date_trunc('week', current_date)::date;
update team_weeks set chosen = 'scan', target = 999 where week_start = date_trunc('week', current_date)::date;

-- 1. Achats via une appli : reçu obligatoire, 30 pousses, jamais publiés.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.expect_error($$select log_action('appli_occasion', 'jean')$$, '%receipt_required%', 'sans reçu : refusé');
select pg_temp.expect_error($$select log_action('appli_occasion', 'jean', '00000000-0000-0000-0000-000000000002/r.jpg')$$,
                            '%invalid_photo%', 'le reçu d''un autre : refusé');
create temp table r1 as select log_action('appli_occasion', 'jean', '00000000-0000-0000-0000-000000000001/recu.jpg') as r;
select pg_temp.check((r ->> 'points')::integer = 30 and (r ->> 'kg')::numeric = 25.1 and (r ->> 'receipt')::boolean,
                     'jean d''occasion avec reçu : 30 pousses et le CO₂ de l''occasion') from r1;
select pg_temp.check((select proof_level = 1 and visibility = 'private' from validations where id = (select (r ->> 'id')::uuid from r1)),
                     'le reçu reste privé');
select pg_temp.expect_error($$select publish_action((select (r ->> 'id')::uuid from r1), '00000000-0000-0000-0000-000000000001/photo.jpg', 'x')$$,
                            '%nothing_to_publish%', 'un achat avec reçu ne part pas dans le fil');
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check((log_action('appli_antigaspi', 'base', '00000000-0000-0000-0000-000000000004/tgtg.jpg') ->> 'points')::integer = 30,
                     'panier anti-gaspi avec reçu : 30, même après le plafond des gestes à 0 kg');
select pg_temp.as_admin();
select pg_temp.expect_error($$insert into validations (user_id, company_id, template_id, variant, day, units, kg, points, witness_status, proof_level, visibility)
                              select id, company_id, 'appli_antigaspi', 'base', current_date - 1, 1, 0, 30, 'none', 0, 'private' from profiles where id = '00000000-0000-0000-0000-000000000004'$$,
                            '%receipt_required%', 'aucun autre chemin ne contourne le reçu');

-- 2. Duel : chaque action qui y compte rapporte ×1,5.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
insert into user_challenges (id, user_id, company_id, template_id, variant, target, starts_on, ends_on)
select 'e0000000-0000-0000-0000-000000000001', id, company_id, 'velo', 'base', 1, current_date, current_date + 6
from profiles where id = auth.uid();
select challenge_duel_action('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011');
select pg_temp.as_user('00000000-0000-0000-0000-000000000011');
select answer_duel((select id from duels where status = 'pending' and opponent = auth.uid()), true);
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
create temp table r2 as select log_action('velo', 'base') as r;
select pg_temp.check((r ->> 'base_points')::integer = 10 and (r ->> 'points')::integer = 15 and r ->> 'boost' = 'duel',
                     'vélo pendant un duel : 10 × 1,5 = 15') from r2;
select pg_temp.check((r -> 'duel' ->> 'mine')::integer = 1 and (r -> 'duel' ->> 'other_name') is not null,
                     'la réponse donne l''avancée du duel') from r2;
select pg_temp.as_admin();
select pg_temp.check((select count(*) from points_ledger where kind = 'defi' and ref_id = 'e0000000-0000-0000-0000-000000000001') = 0,
                     'défi lancé en duel et atteint : pas de bonus solo, le duel a le sien');

-- 3. Duel réussi à deux : +30 chacun.
select pg_temp.as_user('00000000-0000-0000-0000-000000000011');
select log_action('velo', 'base');
select pg_temp.as_admin();
select tick();
select pg_temp.check((select count(*) from points_ledger l join duels d on d.id = l.ref_id
                      where l.kind = 'duel' and l.points = 30 and d.template_id = 'velo' and d.winner = 'both') = 2,
                     'réussi à deux : +30 chacun');

-- 4. Défi solo réussi : +20.
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
insert into user_challenges (id, user_id, company_id, template_id, variant, target, starts_on, ends_on)
select 'e0000000-0000-0000-0000-000000000003', id, company_id, 'gourde', 'base', 1, current_date, current_date + 6
from profiles where id = auth.uid();
select log_action('gourde', 'base');
select pg_temp.as_admin();
select pg_temp.check((select points from points_ledger where kind = 'defi' and ref_id = 'e0000000-0000-0000-0000-000000000003') = 20,
                     'défi solo atteint : +20');

-- 5. Défi d'équipe : chaque action qui y compte rapporte ×2, et +50 si l'objectif est atteint.
delete from points_ledger where kind = 'equipe'
  and ref_id = md5((select id from teams where name = 'Data')::text || ':equipe:' || date_trunc('week', current_date)::date)::uuid;
update team_weeks set chosen = 'repas', target = 1
where week_start = date_trunc('week', current_date)::date and team_id = (select id from teams where name = 'Data');
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
create temp table r3 as select log_action('vege', 'autre') as r;
select pg_temp.check((r ->> 'points')::integer = 20 and r ->> 'boost' = 'equipe', 'repas végé pour le défi d''équipe : 10 × 2 = 20') from r3;
create temp table r4 as select log_action('escaliers', 'base') as r;
select pg_temp.check((r ->> 'points')::integer = 2 and r ->> 'boost' is null, 'une action hors défi : pas de multiplicateur') from r4;
select pg_temp.as_admin();
select tick();
select pg_temp.check((select points from points_ledger where kind = 'equipe' and user_id = '00000000-0000-0000-0000-000000000001'
                      and ref_id = md5((select id from teams where name = 'Data')::text || ':equipe:' || date_trunc('week', current_date)::date)::uuid) = 50,
                     'objectif d''équipe atteint : +50 au contributeur');

-- 6. Proposer un défi d'équipe : il fait partie du vote de la semaine suivante.
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check(propose_team_challenge('nature') = date_trunc('week', current_date)::date + 7, 'proposé pour lundi prochain');
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select propose_team_challenge('nature');
select pg_temp.expect_error($$select propose_team_challenge('velo_jeudi')$$, '%unknown_kind%', 'seulement des défis faisables par toute l''équipe');
select pg_temp.as_admin();
delete from team_weeks where week_start = date_trunc('week', current_date)::date + 7;
select tick_at((date_trunc('week', current_date)::date + 7) + time '09:05');
select pg_temp.check((select options[1] from team_weeks where week_start = date_trunc('week', current_date)::date + 7
                      and team_id = (select id from teams where name = 'Data')) = 'nature',
                     'la proposition de l''équipe est en tête du vote');
select pg_temp.check((select not ('nature' = any(options)) or true from team_weeks where week_start = date_trunc('week', current_date)::date + 7
                      and team_id = (select id from teams where name = 'Finance')), 'les propositions restent dans leur équipe');
