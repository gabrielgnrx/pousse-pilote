-- Scénario « quiz quotidien » (migrations 0014 et 0015), à jouer après les autres scénarios.
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

-- 1. La banque et le découpage : 10 par jour, jamais deux fois la même question.
select pg_temp.check((select count(*) from quiz_questions where active) >= 700, 'plus de 700 questions actives');
select pg_temp.check(not exists (select 1 from quiz_questions where active and id < 1000), 'anciennes questions faciles retirées');
select pg_temp.check(array_length(quiz_day_ids(current_date), 1) = 10, '10 questions par jour');
select pg_temp.check((select count(*) = count(distinct id) and count(*) = 700
                      from (select unnest(quiz_day_ids(current_date + i)) as id from generate_series(0, 69) i) x),
                     'aucune répétition sur 70 jours');
select pg_temp.check(quiz_day_ids(current_date) = quiz_day_ids(current_date), 'les mêmes 10 pour toute l''entreprise');
select pg_temp.check(not exists (select 1 from quiz_questions where active
                                 and (answer < 0 or answer >= array_length(choices, 1) or array_length(choices, 1) <> 4)),
                     'toutes les questions ont 4 choix et une bonne réponse valide');

create temp table today_q as
  select x.id, x.i, q.answer from unnest(quiz_day_ids(current_date)) with ordinality as x(id, i)
  join quiz_questions q on q.id = x.id;
grant select on today_q to authenticated;

-- 2. Jouer : la réponse reste cachée, une seule réponse par question, +1 par bonne réponse, +5 à 8/10.
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check(not ((today_quiz() -> 'current') ? 'answer'), 'réponse cachée avant de répondre');
select pg_temp.check((today_quiz() -> 'current' ->> 'id')::int = (select id from today_q where i = 1), 'première question en cours');
select pg_temp.expect_error($$select answer_quiz(1, 0)$$, '%not_today%', 'question d''un autre jour refusée');
do $$
declare r record;
begin
  for r in select * from today_q order by i loop
    -- 8 bonnes réponses, 2 fausses (les questions 3 et 7).
    perform answer_quiz(r.id, case when r.i in (3, 7) then (r.answer + 1) % 4 else r.answer end);
  end loop;
end $$;
select pg_temp.expect_error($$select answer_quiz((select id from today_q where i = 1), 0)$$, '%already_answered%', 'une seule réponse par question');
select pg_temp.check((today_quiz() ->> 'score')::int = 8 and (today_quiz() ->> 'answered')::int = 10
                     and today_quiz() -> 'current' = 'null'::jsonb, 'quiz terminé : 8/10');
select pg_temp.check(jsonb_array_length(today_quiz() -> 'done') = 10 and (today_quiz() -> 'done' -> 0) ? 'explanation',
                     'correction et explication des 10 questions');
reset role;
select pg_temp.check((select sum(points) from points_ledger where kind = 'quiz' and user_id = '00000000-0000-0000-0000-000000000004'
                      and created_at::date = current_date) >= 13, '8 bonnes réponses + bonus : 13 pousses');
select pg_temp.check(quest_done('00000000-0000-0000-0000-000000000004', 'quiz'), 'quête « termine le quiz » faite');
select pg_temp.check(goal_count('quiz', (select company_id from profiles where id = '00000000-0000-0000-0000-000000000004'),
                                '00000000-0000-0000-0000-000000000004', current_date, current_date) = 1, '8/10 : un quiz réussi');

-- 3. 6/10 : pas de bonus, pas de quiz réussi.
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
do $$
declare r record;
begin
  for r in select * from today_q order by i loop
    perform answer_quiz(r.id, case when r.i <= 6 then r.answer else (r.answer + 1) % 4 end);
  end loop;
end $$;
select pg_temp.check((today_quiz() ->> 'score')::int = 6 and (today_quiz() ->> 'finished')::int = 2, '6/10, deux collègues ont fini');
reset role;
select pg_temp.check(not exists (select 1 from points_ledger where user_id = '00000000-0000-0000-0000-000000000005'
                                 and kind = 'quiz' and points = 5 and created_at::date = current_date), 'pas de bonus à 6/10');
select pg_temp.check(goal_count('quiz', (select company_id from profiles where id = '00000000-0000-0000-0000-000000000005'),
                                '00000000-0000-0000-0000-000000000005', current_date, current_date) = 0, '6/10 : pas un quiz réussi');
