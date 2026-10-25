-- Scénario « QG de l'équipe » (migration 0013), à jouer après les autres scénarios, sur la même base.
-- L'équipe Data compte 6 membres (personnes 1 à 6) ; la personne 7 est dans l'équipe Finance.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
create function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;
create function pg_temp.as_admin(uid text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid, false);
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

-- 1. Le chat : visible par l'équipe seulement, signalé deux fois = masqué.
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check(m.body = 'Qui vient à vélo jeudi ?', 'message envoyé') from post_team_message('  Qui vient à vélo jeudi ?  ') m;
select pg_temp.expect_error($$select post_team_message('   ')$$, 'invalid_message', 'message vide refusé');
select pg_temp.expect_error($$insert into team_messages (company_id, team_id, user_id, body)
  select company_id, team_id, id, 'triche' from profiles where id = auth.uid()$$, '%row-level security%', 'pas d''écriture directe');
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from team_messages) = 1, 'un coéquipier voit le message');
select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
select pg_temp.check((select count(*) from team_messages) = 0, 'une autre équipe ne le voit pas');
select pg_temp.expect_error($$select report_team_message((select id from team_messages limit 1))$$, 'cannot_report', 'pas de signalement hors de son équipe');
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.expect_error($$select report_team_message((select id from team_messages limit 1))$$, 'cannot_report', 'pas de signalement de son propre message');
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select report_team_message((select id from team_messages limit 1));
select pg_temp.check((select count(*) from team_messages) = 1, 'un signalement : encore visible');
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select report_team_message((select id from team_messages limit 1));
select pg_temp.check((select count(*) from team_messages) = 0, 'deux signalements : masqué');

-- 2. Le vote du lundi (semaine du lundi 19 octobre 2026).
select pg_temp.as_admin('00000000-0000-0000-0000-000000000001');
select pg_temp.check(w->>'phase' = 'upcoming' and jsonb_array_length(w->'options') = 3
                     and (w->>'members')::int = 6, 'lundi 8 h : vote pas encore ouvert, 3 choix')
from my_team_week_at('2026-10-19 08:00') w;
select pg_temp.check(not exists (select 1 from team_weeks w, unnest(w.options) o where w.week_start = '2026-10-19' and o not in ('repas', 'actions', 'preuve', 'quiz', 'scan', 'bravo')),
                     'seulement des défis faisables par tous');
select pg_temp.expect_error($$select vote_team_week_at((select options[1] from team_weeks where week_start = '2026-10-19'), '2026-10-19 08:30')$$, 'vote_closed', 'pas de vote avant 9 h');
select pg_temp.expect_error($$select vote_team_week_at('trajets', '2026-10-19 10:00')$$, 'invalid_choice', 'choix hors liste refusé');
select pg_temp.check((w->>'my_vote') = (select options[1] from team_weeks where week_start = '2026-10-19') and w->>'phase' = 'open', 'vote à 10 h')
from vote_team_week_at((select options[1] from team_weeks where week_start = '2026-10-19'), '2026-10-19 10:00') w;
select pg_temp.check((w->>'my_vote') = (select options[2] from team_weeks where week_start = '2026-10-19'), 'on peut changer son vote')
from vote_team_week_at((select options[2] from team_weeks where week_start = '2026-10-19'), '2026-10-19 10:05') w;
select pg_temp.as_admin('00000000-0000-0000-0000-000000000002');
select vote_team_week_at((select options[2] from team_weeks where week_start = '2026-10-19'), '2026-10-19 11:00');
select pg_temp.as_admin('00000000-0000-0000-0000-000000000003');
select vote_team_week_at((select options[3] from team_weeks where week_start = '2026-10-19'), '2026-10-19 12:00');
select pg_temp.expect_error($$select vote_team_week_at((select options[1] from team_weeks where week_start = '2026-10-19'), '2026-10-19 14:00')$$, 'vote_closed', 'vote clos à 14 h');
select pg_temp.check(w->>'phase' = 'closed' and w->>'chosen' = (select options[2] from team_weeks where week_start = '2026-10-19')
                     and (w->>'target')::int = 6 * team_kind_per_member(w->>'chosen')
                     and (w->>'voters')::int = 3, 'à 14 h : le plus voté l''emporte, objectif = par membre × 6')
from my_team_week_at('2026-10-19 14:00') w;
select pg_temp.check((select count(*) from team_messages where user_id is null and body like 'Le vote est clos%') = 1,
                     'annonce de Pousse dans le chat, une seule fois');
select my_team_week_at('2026-10-19 15:00');
select pg_temp.check((select count(*) from team_messages where user_id is null) = 1, 'pas d''annonce en double');

-- 3. Objectif atteint : +30 pour chaque contributeur, une seule fois.
update team_weeks set chosen = 'actions', target = 1 where week_start = '2026-10-19';
-- Vu par la personne 1, qui a enregistré des actions cette semaine (la personne 3 n'en a pas toujours :
-- cela dépendait des tirages des scénarios précédents).
select pg_temp.as_admin('00000000-0000-0000-0000-000000000001');
select pg_temp.check((w->>'gained')::int = 30 and (w->>'mine')::int > 0, 'objectif atteint : +30 pour un contributeur')
from my_team_week_at('2026-10-20 12:00') w;
select pg_temp.check((w->>'gained')::int = 0, 'crédité une seule fois') from my_team_week_at('2026-10-20 12:05') w;
select pg_temp.check(not exists (select 1 from points_ledger where kind = 'equipe'
                                 and user_id = '00000000-0000-0000-0000-000000000007'), 'rien pour une autre équipe');

-- 4. La semaine suivante : le défi précédent ne revient pas tout de suite.
select my_team_week_at('2026-10-26 09:30');
select pg_temp.check(not ('actions' = any (options)), 'le défi de la semaine dernière n''est pas reproposé')
from team_weeks where week_start = '2026-10-26';
reset role;
