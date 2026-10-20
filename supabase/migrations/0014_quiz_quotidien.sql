-- Pousse · le quiz quotidien en 10 questions
--   1. Chaque jour, 10 questions, les mêmes pour toute l'entreprise, jamais déjà posées : la banque
--      (0015_quiz_banque.sql, plus de 750 questions calculées depuis les facteurs ADEME) est parcourue
--      dans un ordre fixe, 10 par jour, sans répétition avant d'avoir tout vu.
--   2. Des questions difficiles : choix proches (même ordre de grandeur), anciennes questions faciles retirées.
--   3. +1 pousse par bonne réponse, +5 de bonus à 8/10 ou plus.
--   4. Un « quiz réussi » = 7 bonnes réponses ou plus : c'est ce que comptent le défi collectif,
--      le défi d'équipe et le jardin. La quête du jour demande de terminer les 10 questions.

alter table public.quiz_questions add column if not exists active boolean not null default true;
-- Les 22 questions de départ, trop faciles, sortent de la rotation (elles restent pour l'historique).
update public.quiz_questions set active = false where id < 1000;

-- Une ligne par question répondue, plus une seule par jour.
alter table public.quiz_answers drop constraint if exists quiz_answers_pkey;
alter table public.quiz_answers add primary key (user_id, day, question_id);

drop function if exists public.answer_quiz(integer);
drop function if exists public.quiz_of_day(date);

-- Les 10 questions d'un jour : la banque mélangée une fois pour toutes, découpée en tranches de 10.
create or replace function public.quiz_day_ids(d date)
returns integer[]
language sql stable security definer set search_path = public
as $$
  with pool as (
    select id, (row_number() over (order by md5('pousse-quiz:' || id)) - 1)::integer as rn,
           count(*) over ()::integer as n
    from public.quiz_questions where active
  ), start as (
    select (((d - date '2026-10-20') * 10) % greatest(max(n), 1) + greatest(max(n), 1)) % greatest(max(n), 1) as s,
           greatest(max(n), 1) as n
    from pool
  )
  select array_agg(p.id order by ((p.rn - s.s) % s.n + s.n) % s.n)
  from pool p, start s
  where ((p.rn - s.s) % s.n + s.n) % s.n < 10
$$;
revoke all on function public.quiz_day_ids(date) from public;

-- Le quiz du jour de la personne connectée : ce qui est répondu (avec correction) et la question en cours.
create or replace function public.today_quiz()
returns jsonb
language plpgsql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  ids integer[];
  done jsonb;
  cur public.quiz_questions;
  n_done integer;
  score integer;
begin
  if auth.uid() is null then
    return null;
  end if;
  ids := public.quiz_day_ids(current_date);
  if ids is null or array_length(ids, 1) is null then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id, 'question', q.question, 'choices', to_jsonb(q.choices),
           'choice', a.choice, 'answer', q.answer, 'correct', a.correct, 'explanation', q.explanation,
           'good_pct', (select round(100.0 * count(*) filter (where x.correct) / nullif(count(*), 0))
                        from public.quiz_answers x join public.profiles p on p.id = x.user_id
                        where p.company_id = public.my_company_id() and x.day = current_date and x.question_id = q.id))
           order by array_position(ids, q.id)), '[]'::jsonb),
         count(*), count(*) filter (where a.correct)
    into done, n_done, score
  from public.quiz_answers a join public.quiz_questions q on q.id = a.question_id
  where a.user_id = auth.uid() and a.day = current_date and a.question_id = any (ids);

  select q.* into cur from unnest(ids) with ordinality as x(id, i)
  join public.quiz_questions q on q.id = x.id
  where not exists (select 1 from public.quiz_answers a
                    where a.user_id = auth.uid() and a.day = current_date and a.question_id = x.id)
  order by x.i
  limit 1;

  return jsonb_build_object(
    'day', current_date,
    'total', array_length(ids, 1),
    'answered', n_done,
    'score', score,
    'done', done,
    'current', case when cur.id is null then null
                    else jsonb_build_object('id', cur.id, 'question', cur.question, 'choices', to_jsonb(cur.choices)) end,
    -- Combien de collègues ont terminé aujourd'hui, et leur score moyen.
    'finished', (select count(*) from (select x.user_id from public.quiz_answers x join public.profiles p on p.id = x.user_id
                  where p.company_id = public.my_company_id() and x.day = current_date
                  group by x.user_id having count(*) >= array_length(ids, 1)) f),
    'avg_score', (select round(avg(s), 1) from (select count(*) filter (where x.correct) as s
                  from public.quiz_answers x join public.profiles p on p.id = x.user_id
                  where p.company_id = public.my_company_id() and x.day = current_date
                  group by x.user_id having count(*) >= array_length(ids, 1)) f));
end;
$$;
revoke all on function public.today_quiz() from public;
grant execute on function public.today_quiz() to authenticated;

create or replace function public.answer_quiz(p_question integer, p_choice integer)
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  q public.quiz_questions;
  ids integer[];
  ok boolean;
  n_done integer;
  score integer;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;
  ids := public.quiz_day_ids(current_date);
  if p_question is null or not coalesce(p_question = any (ids), false) then
    raise exception 'not_today';
  end if;
  select * into q from public.quiz_questions where id = p_question;
  if p_choice is null or p_choice < 0 or p_choice >= array_length(q.choices, 1) then
    raise exception 'invalid_choice';
  end if;
  ok := p_choice = q.answer;
  insert into public.quiz_answers (user_id, day, question_id, choice, correct)
  values (me.id, current_date, q.id, p_choice, ok)
  on conflict do nothing;
  if not found then
    raise exception 'already_answered';
  end if;
  if ok then
    insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
    values (me.id, me.company_id, 'quiz', 1, md5(me.id::text || ':quiz:' || current_date || ':' || q.id)::uuid)
    on conflict (user_id, kind, ref_id) do nothing;
  end if;
  select count(*), count(*) filter (where correct) into n_done, score
  from public.quiz_answers where user_id = me.id and day = current_date and question_id = any (ids);
  if n_done >= array_length(ids, 1) and score >= 8 then
    insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
    values (me.id, me.company_id, 'quiz', 5, md5(me.id::text || ':quizbonus:' || current_date)::uuid)
    on conflict (user_id, kind, ref_id) do nothing;
  end if;
  return public.today_quiz();
end;
$$;
revoke all on function public.answer_quiz(integer, integer) from public;
grant execute on function public.answer_quiz(integer, integer) to authenticated;

-- Ce qui compte un « quiz réussi » (7/10 ou plus) : défis collectif et d'équipe, jardin, quête du jour.

create or replace function public.garden(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  who public.profiles;
begin
  select * into who from public.profiles where id = p_user and company_id = public.my_company_id();
  if not found then
    raise exception 'not_found';
  end if;
  return jsonb_build_object(
    'name', who.display_name,
    'counts', jsonb_build_object(
      'transport', (select coalesce(sum(v.units), 0) from public.validations v join public.challenge_templates t on t.id = v.template_id
                    where v.user_id = p_user and v.status = 'valid' and t.category = 'transport'),
      'alimentation', (select coalesce(sum(v.units), 0) from public.validations v join public.challenge_templates t on t.id = v.template_id
                       where v.user_id = p_user and v.status = 'valid' and t.category = 'alimentation'),
      'consommation', (select coalesce(sum(v.units), 0) from public.validations v join public.challenge_templates t on t.id = v.template_id
                       where v.user_id = p_user and v.status = 'valid' and t.category = 'consommation'),
      'logement', (select coalesce(sum(v.units), 0) from public.validations v join public.challenge_templates t on t.id = v.template_id
                   where v.user_id = p_user and v.status = 'valid' and t.category = 'logement'),
      'scan', (select count(*) from public.product_swaps where user_id = p_user),
      'cap', (select count(*) from public.habit_checkins where user_id = p_user),
      'bravo', (select count(*) from public.cheers where user_id = p_user),
      'quiz', (select count(*) from (select day from public.quiz_answers where user_id = p_user and correct group by day having count(*) >= 7) x)),
    'exploits', jsonb_build_object(
      'serie30', exists (select 1 from public.points_ledger where user_id = p_user and kind = 'serie' and points = 100),
      'expert', exists (select 1 from public.user_challenges u join public.challenge_templates t on t.id = u.template_id
                        where u.user_id = p_user and u.status = 'done' and t.level = 'expert'),
      'collectif', exists (select 1 from public.points_ledger where user_id = p_user and kind = 'collectif'),
      'duel', exists (select 1 from public.points_ledger where user_id = p_user and kind = 'duel'),
      'inspire', exists (select 1 from public.points_ledger where user_id = p_user and kind = 'influence')),
    'rares', coalesce((select jsonb_agg(plant order by obtained_at) from public.garden_rares where user_id = p_user), '[]'::jsonb));
end;
$$;

create or replace function public.goal_count(p_kind text, p_company uuid, p_user uuid, p_from date, p_to date)
returns integer
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select (case p_kind
    when 'repas' then (select coalesce(sum(v.units), 0) from public.validations v
                       where v.company_id = p_company and (p_user is null or v.user_id = p_user) and v.status = 'valid'
                         and v.template_id in ('vege', 'vegetalien') and v.day between p_from and p_to)
    when 'trajets' then (select coalesce(sum(v.units), 0) from public.validations v
                         where v.company_id = p_company and (p_user is null or v.user_id = p_user) and v.status = 'valid'
                           and v.template_id in ('velo', 'transports', 'covoiturage') and v.day between p_from and p_to)
    when 'preuve' then (select count(*) from public.validations v
                        where v.company_id = p_company and (p_user is null or v.user_id = p_user) and v.status = 'valid'
                          and v.proof_level > 0 and v.day between p_from and p_to)
    when 'scan' then (select count(*) from public.product_swaps s
                      where s.company_id = p_company and (p_user is null or s.user_id = p_user)
                        and s.created_at::date between p_from and p_to)
    when 'quiz' then (select count(*) from (select q.user_id, q.day from public.quiz_answers q join public.profiles p on p.id = q.user_id
                      where p.company_id = p_company and (p_user is null or q.user_id = p_user)
                        and q.correct and q.day between p_from and p_to
                      group by q.user_id, q.day having count(*) >= 7) x)
    when 'bravo' then (select count(*) from public.cheers c join public.profiles p on p.id = c.user_id
                       where p.company_id = p_company and (p_user is null or c.user_id = p_user)
                         and c.created_at::date between p_from and p_to)
    else 0 end)::integer
$$;

create or replace function public.team_kind_count(p_kind text, p_team uuid, p_user uuid, p_from date, p_to date)
returns integer
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  with members as (
    select id from public.profiles where team_id = p_team and (p_user is null or id = p_user)
  )
  select (case p_kind
    when 'repas' then (select coalesce(sum(v.units), 0) from public.validations v
                       where v.user_id in (select id from members) and v.status = 'valid'
                         and v.template_id in ('vege', 'vegetalien') and v.day between p_from and p_to)
    when 'actions' then (select coalesce(sum(v.units), 0) from public.validations v
                         where v.user_id in (select id from members) and v.status = 'valid'
                           and v.day between p_from and p_to)
    when 'preuve' then (select count(*) from public.validations v
                        where v.user_id in (select id from members) and v.status = 'valid'
                          and v.proof_level > 0 and v.day between p_from and p_to)
    when 'quiz' then (select count(*) from (select q.user_id, q.day from public.quiz_answers q
                      where q.user_id in (select id from members) and q.correct and q.day between p_from and p_to
                      group by q.user_id, q.day having count(*) >= 7) x)
    when 'scan' then (select count(*) from public.product_swaps s
                      where s.user_id in (select id from members) and s.created_at::date between p_from and p_to)
    when 'bravo' then (select count(*) from public.cheers c
                       where c.user_id in (select id from members) and c.created_at::date between p_from and p_to)
    else 0 end)::integer
$$;

create or replace function public.quest_done(p_user uuid, p_quest text)
returns boolean
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select case p_quest
    when 'preuve' then exists (select 1 from public.validations v where v.user_id = p_user
                               and v.status = 'valid' and v.day = current_date and v.proof_level > 0)
    when 'defi' then exists (select 1 from public.validations v where v.user_id = p_user
                             and v.status = 'valid' and v.day = current_date)
    when 'expert' then exists (select 1 from public.validations v
                               join public.challenge_templates t on t.id = v.template_id
                               where v.user_id = p_user and v.status = 'valid'
                                 and v.day = current_date and t.level = 'expert')
    when 'scan' then exists (select 1 from public.product_scans s where s.user_id = p_user
                             and s.created_at::date = current_date)
    when 'meilleur_choix' then exists (select 1 from public.product_swaps s where s.user_id = p_user
                                       and s.created_at::date = current_date)
    when 'bravo' then exists (select 1 from public.cheers c where c.user_id = p_user
                              and c.created_at::date = current_date)
    when 'cap' then exists (select 1 from public.habit_checkins k where k.user_id = p_user
                            and k.created_at::date = current_date)
    when 'lancer' then exists (select 1 from public.user_challenges u where u.user_id = p_user
                               and u.created_at::date = current_date)
    when 'quiz' then (select count(*) from public.quiz_answers q where q.user_id = p_user and q.day = current_date
                      and q.question_id = any (public.quiz_day_ids(current_date))) >= 10
    else false end
$$;
revoke all on function public.goal_count(text, uuid, uuid, date, date) from public;
revoke all on function public.team_kind_count(text, uuid, uuid, date, date) from public;
revoke all on function public.quest_done(uuid, text) from public;
revoke all on function public.garden(uuid) from public;
grant execute on function public.garden(uuid) to authenticated;
