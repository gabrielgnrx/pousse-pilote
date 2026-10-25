-- Scénario v2 (migration 0036) : quiz de la semaine, réponses cachées, pousses plafonnées.
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

-- 1. La tâche du lundi enregistre 5 questions au plus (6 envoyées), clé obligatoire.
select pg_temp.as_nobody();
select pg_temp.expect_error($$select quiz_week_insert('mauvaise-cle-mauvaise-cle-mauvaise-cle', current_date, '[]', 'v')$$, '%not_allowed%', 'sans clé : refusé');
select pg_temp.check(quiz_week_insert('cle-ia-de-test-assez-longue-pour-passer-0123456789',
  date_trunc('week', now() at time zone 'Europe/Paris')::date,
  (select jsonb_agg(jsonb_build_object(
     'question', 'Question numéro ' || i || ' sur le vélo ?', 'choices', jsonb_build_array('Oui', 'Non', 'Peut-être'),
     'answer', 0, 'explanation', 'Parce que la fiche le dit clairement.', 'source_kind', 'fiche', 'source_title', 'Vélo', 'source_url', ''))
   from generate_series(1, 6) i), 'quiz-semaine@1') = 5, '5 questions enregistrées au plus');
select pg_temp.check(quiz_week_insert('cle-ia-de-test-assez-longue-pour-passer-0123456789',
  date_trunc('week', now() at time zone 'Europe/Paris')::date, '[]', 'quiz-semaine@1') = 0, 'semaine déjà remplie : gardée');
reset role;

-- 2. La bonne réponse reste cachée tant qu'on n'a pas répondu ; la table est illisible.
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check(jsonb_array_length(week_quiz()) = 5 and week_quiz()->0->'answer' = 'null'::jsonb, 'réponse cachée avant de répondre');
select pg_temp.check(not exists (select 1 from quiz_week_questions), 'table des questions illisible');

-- 3. +2 par bonne réponse, plafonné à 10 par semaine ; une seule réponse par question.
create temp table qs as select (q->>'id')::bigint as id from jsonb_array_elements(week_quiz()) q;
select answer_week_quiz(id, 0) from qs;
select pg_temp.check((select count(*) = 5 from jsonb_array_elements(week_quiz()) q where (q->>'correct')::boolean and q->>'explanation' is not null),
                     'corrections visibles après réponse');
select pg_temp.expect_error($$select answer_week_quiz((select min(id) from qs), 0)$$, '%already_answered%', 'une seule réponse par question');
reset role;
select pg_temp.check((select sum(points) from points_ledger where user_id = '00000000-0000-0000-0000-000000000002' and kind = 'quiz'
                      and ref_id in (select md5('00000000-0000-0000-0000-000000000002:quizsemaine:' || id)::uuid from quiz_week_questions)) = 10,
                     'pousses du quiz de la semaine : 10 au plus');
select set_config('request.jwt.claim.sub', '', false);
