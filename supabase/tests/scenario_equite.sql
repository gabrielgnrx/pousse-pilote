-- Scénario « un jeu plus juste » (migration 0020), à jouer après scenario_fiabilite.
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
create function pg_temp.total(uid text) returns integer language sql as $$ select member_points(uid::uuid, null) $$;
set client_min_messages = notice;

select pg_temp.as_admin();
update duels set status = 'done' where status in ('pending', 'active');

-- 1. Classement : par participant, plus au total.
-- Finance compte 9 personnes et Data 6. Finance finit avec 100 pousses de plus au total, mais moins par personne.
insert into auth.users (id, email) select ('00000000-0000-0000-0000-0000000000' || i)::uuid, 'f' || i || '@demo.fr' from generate_series(16, 18) i;
do $$
declare i int;
begin
  for i in 16..18 loop
    perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000' || i, false);
    perform join_company('DEMO-2026', (select t.id from teams t where t.name = 'Finance'), 'Finance ' || i, true, true);
  end loop;
end $$;
select pg_temp.as_admin();
delete from points_ledger where kind = 'quete' and points = 5000;
insert into points_ledger (user_id, company_id, kind, points, ref_id)
select p.id, p.company_id, 'quete', 100, gen_random_uuid() from profiles p join teams t on t.id = p.team_id where t.name = 'Data';
insert into points_ledger (user_id, company_id, kind, points, ref_id)
select p.id, p.company_id, 'quete', 100 + (select coalesce(sum(member_points(x.id, null)), 0) from profiles x join teams tx on tx.id = x.team_id where tx.name = 'Data')::integer
       - (select coalesce(sum(member_points(x.id, null)), 0) from profiles x join teams tx on tx.id = x.team_id where tx.name = 'Finance')::integer,
       gen_random_uuid()
from profiles p join teams t on t.id = p.team_id where t.name = 'Finance' limit 1;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
create temp table ranking as select * from team_stats(null);
select pg_temp.check((select points from ranking where team_name = 'Finance') > (select points from ranking where team_name = 'Data'),
                     'Finance devant au total');
select pg_temp.check((select team_name from ranking limit 1) = 'Data', 'mais Data devant par personne : c''est l''ordre retenu');
select pg_temp.as_admin();

-- 2. Gestes à 0 kg : 5 pousses par jour au plus, tous confondus.
delete from validations where user_id = '00000000-0000-0000-0000-000000000004' and day = current_date;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check((log_action('compost', 'base') ->> 'points')::integer = 3, 'compost (0 kg) : 3 pousses');
select pg_temp.check((log_action('ramassage', 'base') ->> 'points')::integer = 2, 'ramassage (0 kg) : 2, le reste des 5 du jour');
select pg_temp.check((log_action('plantation', 'base') ->> 'points')::integer = 0, 'plantation (0 kg) : 0, plafond atteint');
select pg_temp.check((select count(*) from validations where user_id = auth.uid() and day = current_date) = 3,
                     'les trois gestes restent enregistrés (séries, quêtes, défis)');
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((select (r ->> 'points')::integer = 10 and (r ->> 'kg')::numeric > 0 from log_action('vege', 'autre') r),
                     'une action qui réduit vraiment l''empreinte : pousses entières');
select pg_temp.as_admin();

-- 3. Duels : refuser ou laisser expirer ne coûte rien, échouer coûte la mise (10).
-- Assez de pousses de côté pour qu'une perte se voie (le total ne passe jamais sous zéro).
insert into points_ledger (user_id, company_id, kind, points, ref_id)
select id, company_id, 'quete', 50, gen_random_uuid() from profiles
where id in ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000013');
create temp table base as select pg_temp.total('00000000-0000-0000-0000-000000000012') as p12,
                                 pg_temp.total('00000000-0000-0000-0000-000000000013') as p13,
                                 pg_temp.total('00000000-0000-0000-0000-000000000003') as p3;
grant select on base to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select challenge_duel('00000000-0000-0000-0000-000000000012', 'repas', 3);
select pg_temp.as_user('00000000-0000-0000-0000-000000000012');
select answer_duel((select id from duels where status = 'pending' and opponent = auth.uid()), false);
select pg_temp.as_admin();
select pg_temp.check(pg_temp.total('00000000-0000-0000-0000-000000000012') = (select p12 from base), 'refuser : rien de perdu');
select pg_temp.check((select body from alerts where user_id = '00000000-0000-0000-0000-000000000012' and kind = 'duel_invite'
                      order by created_at desc limit 1) like '%seulement si tu acceptes et échoues%', 'l''invitation explique la mise');

select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select challenge_duel('00000000-0000-0000-0000-000000000013', 'repas', 3);
select pg_temp.as_admin();
update duels set created_at = now() - interval '4 days' where opponent = '00000000-0000-0000-0000-000000000013' and status = 'pending';
select tick();
select pg_temp.check(pg_temp.total('00000000-0000-0000-0000-000000000013') = (select p13 from base), 'laisser expirer : rien de perdu');

select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select challenge_duel('00000000-0000-0000-0000-000000000013', 'scan', 5);
select pg_temp.as_user('00000000-0000-0000-0000-000000000013');
select answer_duel((select id from duels where status = 'pending' and opponent = auth.uid()), true);
select pg_temp.as_admin();
update duels set starts_on = current_date - 8, ends_on = current_date - 1 where status = 'active';
select tick();
select pg_temp.check(pg_temp.total('00000000-0000-0000-0000-000000000013') = (select p13 from base) - 10
                     and pg_temp.total('00000000-0000-0000-0000-000000000003') = (select p3 from base) - 10,
                     'échouer : chacun perd sa mise de 10');
select pg_temp.check((select body from alerts where user_id = '00000000-0000-0000-0000-000000000013' and kind = 'duel_fin'
                      order by created_at desc limit 1) = 'Objectif manqué : tu perds ta mise de 10 pousses.', 'le résultat le dit');
