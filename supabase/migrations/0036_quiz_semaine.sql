-- 0036 — Le quiz de la semaine, généré à partir des fiches et des bonnes nouvelles (v2, octobre 2026).
--
-- Chaque lundi, une tâche planifiée génère quelques questions à partir des fiches gestes et des
-- bonnes nouvelles de la semaine. Chaque question garde sa source et la phrase qui justifie la réponse ;
-- l'application ne publie que les questions relues (réponse justifiée par la source). La base vérifie
-- encore la forme, et plafonne les pousses : +2 par bonne réponse, 10 par semaine au plus.

create table if not exists public.quiz_week_questions (
  id bigint generated always as identity primary key,
  week_start date not null,
  position smallint not null check (position between 1 and 10),
  question text not null check (char_length(question) between 10 and 220),
  choices text[] not null check (array_length(choices, 1) between 2 and 4),
  answer smallint not null,
  explanation text not null check (char_length(explanation) between 10 and 400),
  source_kind text not null check (source_kind in ('fiche', 'actu')),
  source_title text not null check (char_length(source_title) <= 200),
  source_url text check (source_url is null or source_url ~ '^https://'),
  prompt_version text not null,
  created_at timestamptz not null default now(),
  check (answer >= 0 and answer < array_length(choices, 1)),
  unique (week_start, position)
);
alter table public.quiz_week_questions enable row level security;
-- Personne ne lit la table (la bonne réponse y est) : tout passe par week_quiz().

create table if not exists public.quiz_week_answers (
  user_id uuid not null references public.profiles on delete cascade,
  question_id bigint not null references public.quiz_week_questions on delete cascade,
  choice smallint not null,
  correct boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
alter table public.quiz_week_answers enable row level security;
drop policy if exists "quiz semaine: mes réponses" on public.quiz_week_answers;
create policy "quiz semaine: mes réponses" on public.quiz_week_answers for select to authenticated using (user_id = auth.uid());

-- Le quiz de la semaine de la personne connectée : réponses et explications seulement une fois répondu.
create or replace function public.week_quiz()
returns jsonb
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id,
      'question', q.question,
      'choices', to_jsonb(q.choices),
      'source_kind', q.source_kind,
      'source_title', q.source_title,
      'source_url', q.source_url,
      'my_choice', a.choice,
      'correct', a.correct,
      'answer', case when a.user_id is not null then q.answer end,
      'explanation', case when a.user_id is not null then q.explanation end)
    order by q.position), '[]'::jsonb)
  from public.quiz_week_questions q
  left join public.quiz_week_answers a on a.question_id = q.id and a.user_id = auth.uid()
  where q.week_start = date_trunc('week', current_date)::date and auth.uid() is not null
$$;
revoke all on function public.week_quiz() from public;
grant execute on function public.week_quiz() to authenticated;

create or replace function public.answer_week_quiz(p_question bigint, p_choice integer)
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  q public.quiz_week_questions;
  ok boolean;
  earned integer;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;
  select * into q from public.quiz_week_questions where id = p_question and week_start = date_trunc('week', current_date)::date;
  if not found then
    raise exception 'not_this_week';
  end if;
  if p_choice is null or p_choice < 0 or p_choice >= array_length(q.choices, 1) then
    raise exception 'invalid_choice';
  end if;
  ok := p_choice = q.answer;
  insert into public.quiz_week_answers (user_id, question_id, choice, correct)
  values (me.id, q.id, p_choice, ok)
  on conflict do nothing;
  if not found then
    raise exception 'already_answered';
  end if;
  -- +2 par bonne réponse, plafonné à 10 pousses par semaine.
  select coalesce(sum(l.points), 0) into earned from public.points_ledger l
  where l.user_id = me.id and l.kind = 'quiz' and l.ref_id in (
    select md5(me.id::text || ':quizsemaine:' || qq.id)::uuid from public.quiz_week_questions qq where qq.week_start = q.week_start);
  if ok and earned < 10 then
    insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
    values (me.id, me.company_id, 'quiz', least(2, 10 - earned), md5(me.id::text || ':quizsemaine:' || q.id)::uuid)
    on conflict (user_id, kind, ref_id) do nothing;
  end if;
  return public.week_quiz();
end;
$$;
revoke all on function public.answer_week_quiz(bigint, integer) from public;
grant execute on function public.answer_week_quiz(bigint, integer) to authenticated;

-- La tâche du lundi enregistre les questions relues (clé « ia ») ; une semaine déjà remplie est gardée.
create or replace function public.quiz_week_insert(p_token text, p_week date, p_questions jsonb, p_version text)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  q jsonb;
  n integer := 0;
begin
  if not public.cron_key_named('ia', p_token) then
    raise exception 'not_allowed';
  end if;
  if exists (select 1 from public.quiz_week_questions where week_start = p_week) then
    return 0;
  end if;
  for q in select * from jsonb_array_elements(p_questions) loop
    exit when n >= 5;
    n := n + 1;
    insert into public.quiz_week_questions (week_start, position, question, choices, answer, explanation, source_kind,
                                            source_title, source_url, prompt_version)
    values (p_week, n, q->>'question', array(select jsonb_array_elements_text(q->'choices')), (q->>'answer')::smallint,
            q->>'explanation', q->>'source_kind', left(q->>'source_title', 200), nullif(q->>'source_url', ''), p_version);
  end loop;
  return n;
end;
$$;
revoke all on function public.quiz_week_insert(text, date, jsonb, text) from public;
grant execute on function public.quiz_week_insert(text, date, jsonb, text) to anon, authenticated;
