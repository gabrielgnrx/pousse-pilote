-- Scénario « fiabilité » (migration 0018) : équipe verrouillée, alertes, tick, envoi des notifications.
-- Personnes 1 à 6 : équipe Data ; 7 et 11 à 15 : équipe Finance.
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
create function pg_temp.alerts(uid text, k text) returns integer language sql as $$
  select count(*)::integer from alerts where user_id = uid::uuid and kind = k
$$;
set client_min_messages = notice;

select pg_temp.as_admin();
update duels set status = 'done' where status in ('pending', 'active');
create temp table ids as
select (select t.id from teams t join companies c on c.id = t.company_id where c.join_code = 'DEMO-2026' and t.name = 'Data') as data_team,
       (select t.id from teams t join companies c on c.id = t.company_id where c.join_code = 'DEMO-2026' and t.name = 'Finance') as fin_team,
       date_trunc('week', current_date)::date + 7 as next_monday;
grant select on ids to authenticated;

-- 1. Équipe verrouillée.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.expect_error($$update profiles set team_id = (select fin_team from ids) where id = auth.uid()$$,
                            '%team_locked%', 'changer d''équipe soi-même : refusé');
select pg_temp.expect_error($$select join_company('DEMO-2026', (select fin_team from ids), 'Personne 1', true, true)$$,
                            '%team_locked%', 'repasser par l''inscription pour changer d''équipe : refusé');
select join_company('DEMO-2026', (select data_team from ids), 'Gabriel', true, true);
select pg_temp.check((select display_name from profiles where id = auth.uid()) = 'Gabriel', 'même équipe : le prénom se met à jour');
select pg_temp.as_admin();
update profiles set team_id = (select fin_team from ids) where id = '00000000-0000-0000-0000-000000000006';
select pg_temp.check((select team_id from profiles where id = '00000000-0000-0000-0000-000000000006') = (select fin_team from ids),
                     'depuis l''éditeur SQL, le pilote peut corriger une équipe');
update profiles set team_id = (select data_team from ids) where id = '00000000-0000-0000-0000-000000000006';
select pg_temp.expect_error($$update profiles set team_id = (select id from teams where name = 'Compta') where id = '00000000-0000-0000-0000-000000000006'$$,
                            '%unknown_team%', 'jamais une équipe d''une autre entreprise');

-- Cinq collègues de plus en Finance (classement : 5 participants minimum).
insert into auth.users (id, email) select ('00000000-0000-0000-0000-0000000000' || i)::uuid, 'f' || i || '@demo.fr' from generate_series(11, 15) i;
do $$
declare i int;
begin
  for i in 11..15 loop
    perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000' || i, false);
    perform join_company('DEMO-2026', (select fin_team from ids), 'Finance ' || i, true, true);
  end loop;
end $$;
select pg_temp.as_admin();

-- 2. Duels : chaque étape prévient la bonne personne.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select challenge_duel('00000000-0000-0000-0000-000000000011', 'repas', 3);
select pg_temp.as_admin();
select pg_temp.check(pg_temp.alerts('00000000-0000-0000-0000-000000000011', 'duel_invite') = 1, 'invitation : l''adversaire est prévenu');
select pg_temp.as_user('00000000-0000-0000-0000-000000000011');
select pg_temp.check((select count(*) from alerts) = 1, 'chacun ne voit que ses alertes');
select answer_duel((select id from duels where status = 'pending' and opponent = auth.uid()), true);
select pg_temp.as_admin();
select pg_temp.check(pg_temp.alerts('00000000-0000-0000-0000-000000000001', 'duel_accepte') = 1, 'acceptation : le challenger est prévenu');

select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select challenge_duel('00000000-0000-0000-0000-000000000012', 'repas', 3);
select pg_temp.as_admin();
update duels set created_at = now() - interval '2 days 1 hour' where challenger = '00000000-0000-0000-0000-000000000002' and status = 'pending';
select tick();
select pg_temp.check(pg_temp.alerts('00000000-0000-0000-0000-000000000012', 'duel_relance') = 1, 'plus que 24 h : relance');
update duels set created_at = now() - interval '4 days' where challenger = '00000000-0000-0000-0000-000000000002' and status = 'pending';
select tick();
select pg_temp.check((select status from duels where challenger = '00000000-0000-0000-0000-000000000002' order by created_at desc limit 1) = 'expired',
                     'tick : l''invitation expire sans que personne n''ouvre l''appli');
select pg_temp.check(pg_temp.alerts('00000000-0000-0000-0000-000000000012', 'duel_expire') = 1
                     and pg_temp.alerts('00000000-0000-0000-0000-000000000002', 'duel_expire') = 1, 'expiration : les deux sont prévenus');
select pg_temp.check((select body from alerts where user_id = '00000000-0000-0000-0000-000000000012' and kind = 'duel_expire') like '%−10 pousses%',
                     'l''alerte dit ce que ça coûte');
update duels set starts_on = current_date - 8, ends_on = current_date - 1 where status = 'active';
select tick();
select pg_temp.check(pg_temp.alerts('00000000-0000-0000-0000-000000000001', 'duel_fin') = 1
                     and pg_temp.alerts('00000000-0000-0000-0000-000000000011', 'duel_fin') = 1, 'fin du duel : résultat envoyé aux deux');

-- 3. Classement : prévenir l'équipe qui se fait dépasser.
delete from team_rank_state;
select tick();
select pg_temp.check((select count(*) from team_rank_state) = 2, 'rang de chaque équipe mémorisé');
select pg_temp.check((select count(*) from alerts where kind = 'equipe_depassee') = 0, 'premier passage : aucune alerte');
create temp table leader as
select (select team_id from team_rank_state where rank = 1) as first_team,
       (select team_id from team_rank_state where rank = 2) as second_team;
insert into points_ledger (user_id, company_id, kind, points, ref_id)
select p.id, p.company_id, 'quete', 5000, gen_random_uuid()
from profiles p where p.team_id = (select second_team from leader) limit 1;
select tick();
select pg_temp.check((select count(*) from alerts a join profiles p on p.id = a.user_id
                      where a.kind = 'equipe_depassee' and p.team_id = (select first_team from leader)) = 6,
                     'l''équipe dépassée est prévenue, chaque membre');
select pg_temp.check((select count(*) from alerts a join profiles p on p.id = a.user_id
                      where a.kind = 'equipe_depassee' and p.team_id = (select second_team from leader)) = 0,
                     'l''équipe qui passe devant ne reçoit rien');
select tick();
select pg_temp.check((select count(*) from alerts where kind = 'equipe_depassee') = 6, 'rejouer tick() : pas de doublon');

-- 4. Défi de la semaine : vote ouvert à 9 h, résultat à 14 h, réglé sans que personne n'ouvre le QG.
-- Un lundi après 9 h, les tick() ci-dessus ont déjà ouvert le vote du jour : on repart de zéro.
delete from alerts where kind in ('vote_ouvert', 'vote_resultat');
select tick_at((select next_monday from ids) + time '08:30');
select pg_temp.check((select count(*) from alerts where kind = 'vote_ouvert') = 0, 'avant 9 h : pas encore d''alerte');
select tick_at((select next_monday from ids) + time '09:05');
select pg_temp.check((select count(*) from alerts where kind = 'vote_ouvert') = 12, 'à 9 h : toute l''entreprise est prévenue du vote');
select tick_at((select next_monday from ids) + time '14:05');
select pg_temp.check((select count(*) from team_weeks where week_start = (select next_monday from ids) and chosen is not null) = 2,
                     'à 14 h : le défi est choisi pour chaque équipe');
select pg_temp.check((select count(*) from alerts where kind = 'vote_resultat') = 12, 'le résultat est envoyé');
select pg_temp.check((select count(*) from team_messages where team_id = (select data_team from ids) and user_id is null
                      and created_at = ((select next_monday from ids) + time '14:00') at time zone 'Europe/Paris') = 1,
                     'l''annonce est postée dans le chat');

-- 5. Défi perso : dernier jour.
-- Un lundi, un défi de 7 jours commencé aujourd'hui finit le lundi suivant, que l'étape 4 a simulé :
-- on repart de zéro pour ne compter que le défi ci-dessous.
delete from alerts where kind = 'defi_fin';
insert into user_challenges (id, user_id, company_id, template_id, variant, target, starts_on, ends_on)
select 'f0000000-0000-0000-0000-000000000001', id, company_id, 'vege', 'boeuf', 3, current_date - 6, current_date
from profiles where id = '00000000-0000-0000-0000-000000000003';
select tick_at(current_date + time '11:00');
select pg_temp.check(pg_temp.alerts('00000000-0000-0000-0000-000000000003', 'defi_fin') = 0, 'le matin : pas encore');
select tick_at(current_date + time '12:30');
select pg_temp.check((select title from alerts where user_id = '00000000-0000-0000-0000-000000000003' and kind = 'defi_fin') like 'Dernier jour : %',
                     'à midi : dernier jour du défi');

-- 6. Envoi : clé, heures calmes, une notification par heure.
insert into cron_keys (name, sha256) values ('notifier', encode(sha256(convert_to(repeat('k', 40), 'UTF8')), 'hex'))
on conflict (name) do update set sha256 = excluded.sha256;
insert into push_subscriptions (endpoint, user_id, p256dh, auth) values
  ('https://push.test/a', '00000000-0000-0000-0000-000000000003', 'x', 'y'),
  ('https://push.test/b', '00000000-0000-0000-0000-000000000003', 'x', 'y');
set role anon;
select pg_temp.expect_error($$select * from alerts_due('mauvaise-cle-mauvaise-cle-mauvaise-cle')$$, '%forbidden%', 'sans la bonne clé : refusé');
reset role;
select pg_temp.check((select count(*) from alerts_due_at(repeat('k', 40), current_date + time '22:00')) = 0, 'après 21 h : rien ne part');
select pg_temp.check((select count(*) from alerts_due_at(repeat('k', 40), current_date + time '10:00')) = 2, 'en journée : ses deux téléphones');
select alerts_pushed(repeat('k', 40), array['00000000-0000-0000-0000-000000000003'::uuid], array['https://push.test/b']);
select pg_temp.check((select count(*) from push_subscriptions where endpoint = 'https://push.test/b') = 0, 'abonnement refusé : retiré');
select pg_temp.check((select count(*) from alerts where user_id = '00000000-0000-0000-0000-000000000003' and pushed_at is null) = 0, 'ses alertes sont marquées envoyées');
select notify('00000000-0000-0000-0000-000000000003', 'test', '1', 'Encore une', 'x', '/fil');
select pg_temp.check((select count(*) from alerts_due_at(repeat('k', 40), current_date + time '10:00')) = 0, 'pas plus d''une notification par heure');
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.check((my_latest_alert() ->> 'title') like 'Dernier jour : %', 'le téléphone lit le texte de l''alerte envoyée');
select mark_alerts_seen();
select pg_temp.check((select count(*) from alerts where seen_at is null) = 0, 'ouvrir les notifications : tout est lu');
select pg_temp.as_admin();
