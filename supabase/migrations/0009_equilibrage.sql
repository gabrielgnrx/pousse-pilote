-- Pousse · rééquilibrage du jeu
--   1. Une seule série : les jours actifs (le scanner compte aussi).
--   2. Pas de pousses sans preuve : le CO₂ évité est compté, les pousses non.
--   3. Garder le cap : 20 pousses par semaine au plus (2 habitudes récompensées).
--   4. Quêtes du jour variées : 3 tirées chaque matin parmi celles qui ont du sens pour la personne,
--      figées pour la journée (table daily_quests).

-- 1. Série ----------------------------------------------------------------------

create or replace function public.active_days(p_user uuid)
returns setof date
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select v.day from public.validations v where v.user_id = p_user and v.status = 'valid'
  union
  select k.created_at::date from public.habit_checkins k where k.user_id = p_user
  union
  select c.created_at::date from public.cheers c where c.user_id = p_user
  union
  select s.created_at::date from public.product_swaps s where s.user_id = p_user
  union
  select s.created_at::date from public.product_scans s where s.user_id = p_user
$$;
revoke all on function public.active_days(uuid) from public;

-- Ma série, en lecture seule (pour l'en-tête et le profil).
create or replace function public.my_day_streak()
returns integer
language sql stable security definer set search_path = public
as $$ select streak from public.day_streak(auth.uid()) $$;
revoke all on function public.my_day_streak() from public;
grant execute on function public.my_day_streak() to authenticated;

-- 2. Pas de pousses sans preuve ------------------------------------------------------

create or replace function public.validate_challenge_day(
  p_challenge uuid,
  p_units integer,
  p_photo_path text default null,
  p_witness uuid default null,
  p_caption text default null,
  p_visibility text default 'company')
returns public.validations
language plpgsql security definer
set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  c public.user_challenges;
  t public.challenge_templates;
  h public.habits;
  per_unit numeric;
  used integer;
  allowed integer;
  lvl smallint;
  v public.validations;
  done_units integer;
  inspirer uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;

  select * into c from public.user_challenges
  where id = p_challenge and user_id = me.id
  for update;
  if not found then
    raise exception 'challenge_not_found';
  end if;
  if c.status <> 'active' or current_date not between c.starts_on and c.ends_on then
    raise exception 'challenge_closed';
  end if;
  if p_units is null or p_units < 1 then
    raise exception 'invalid_units';
  end if;

  select * into t from public.challenge_templates where id = c.template_id;
  select * into h from public.habits where user_id = me.id;
  if not found then
    raise exception 'no_habits';
  end if;

  per_unit := public.unit_kg(c.template_id, c.variant, h);
  if per_unit <= 0 then
    raise exception 'not_eligible';
  end if;

  select coalesce(sum(val.units), 0) into used
  from public.validations val
  join public.challenge_templates tt on tt.id = val.template_id
  where val.user_id = me.id
    and val.status = 'valid'
    and tt.cap_group = t.cap_group
    and val.day > current_date - t.cap_window_days;
  allowed := least(p_units, t.cap_units - used);
  if allowed <= 0 then
    raise exception 'cap_reached';
  end if;

  if p_witness is not null and (
       p_witness = me.id
       or not exists (select 1 from public.profiles
                      where id = p_witness and company_id = me.company_id)) then
    raise exception 'invalid_witness';
  end if;
  if p_photo_path is not null and split_part(p_photo_path, '/', 1) <> me.id::text then
    raise exception 'invalid_photo';
  end if;

  lvl := (p_photo_path is not null)::int + (p_witness is not null)::int;

  insert into public.validations (
    challenge_id, user_id, company_id, team_id, template_id, variant, day, units,
    kg, points, proof_photo_path, witness_id, witness_status, proof_level, caption,
    visibility)
  values (
    c.id, me.id, me.company_id, me.team_id, c.template_id, c.variant, current_date, allowed,
    round(per_unit * allowed, 3),
    -- Sans preuve : CO₂ compté, aucune pousse (le classement ne récompense que le vérifiable).
    case when lvl > 0 then allowed * t.points_per_unit + 5 else 0 end,
    p_photo_path, p_witness,
    case when p_witness is null then 'none' else 'pending' end,
    lvl, nullif(trim(p_caption), ''),
    case when lvl > 0 and p_visibility = 'company' then 'company' else 'private' end)
  returning * into v;

  if c.inspired_by is not null and lvl > 0 then
    select user_id into inspirer from public.validations
    where id = c.inspired_by and company_id = me.company_id and user_id <> me.id;
    if inspirer is not null then
      insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
      values (inspirer, me.company_id, 'influence', 15, c.id)
      on conflict (user_id, kind, ref_id) do nothing;
    end if;
  end if;

  select coalesce(sum(units), 0) into done_units
  from public.validations where challenge_id = c.id and status = 'valid';
  if done_units >= c.target then
    update public.user_challenges set status = 'done' where id = c.id;
  end if;

  return v;
end;
$$;
revoke all on function public.validate_challenge_day(uuid, integer, text, uuid, text, text) from public;
grant execute on function public.validate_challenge_day(uuid, integer, text, uuid, text, text) to authenticated;

-- 3. Garder le cap : 2 habitudes récompensées par semaine (20 pousses) ---------------------

create or replace function public.keep_habit(p_habit text)
returns public.habit_checkins
language plpgsql security definer
set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  h public.habits;
  r public.habit_checkins;
  rewarded integer;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;
  select * into h from public.habits where user_id = me.id;
  if not found then
    raise exception 'no_habits';
  end if;
  if not (p_habit = any (public.kept_habits(h))) then
    raise exception 'not_kept_habit';
  end if;

  insert into public.habit_checkins (user_id, company_id, habit, week_start)
  values (me.id, me.company_id, p_habit, date_trunc('week', current_date)::date)
  on conflict (user_id, habit, week_start) do nothing
  returning * into r;
  if r.id is null then
    raise exception 'already_kept';
  end if;

  select count(*) into rewarded
  from public.points_ledger l join public.habit_checkins k on k.id = l.ref_id
  where l.user_id = me.id and l.kind = 'maintien' and k.week_start = r.week_start;
  if rewarded < 2 then
    insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
    values (me.id, me.company_id, 'maintien', 10, r.id);
  end if;
  return r;
end;
$$;

-- 4. Quêtes du jour variées ----------------------------------------------------------------

create table if not exists public.daily_quests (
  user_id uuid not null references public.profiles on delete cascade,
  day date not null,
  quests text[] not null,
  primary key (user_id, day)
);
alter table public.daily_quests enable row level security;
drop policy if exists "quêtes: les miennes" on public.daily_quests;
create policy "quêtes: les miennes" on public.daily_quests
  for select to authenticated using (user_id = auth.uid());

-- Une quête est-elle faite aujourd'hui ?
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
    else false end
$$;
revoke all on function public.quest_done(uuid, text) from public;

-- Tire les 3 quêtes du jour parmi celles qui ont du sens, une seule fois par jour.
create or replace function public.todays_quests(p_user uuid)
returns text[]
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  q text[];
  me public.profiles;
  h public.habits;
  pool text[] := array[]::text[];
  has_active boolean;
begin
  select quests into q from public.daily_quests where user_id = p_user and day = current_date;
  if found then
    return q;
  end if;
  select * into me from public.profiles where id = p_user;
  select * into h from public.habits where user_id = p_user;
  has_active := exists (select 1 from public.user_challenges where user_id = p_user and status = 'active'
                        and current_date between starts_on and ends_on);

  -- Toujours possibles
  pool := pool || array['scan', 'meilleur_choix'];
  if has_active then
    pool := pool || array['preuve'];
  else
    pool := pool || array['lancer'];
  end if;
  -- Selon le profil
  if exists (select 1 from public.user_challenges u join public.challenge_templates t on t.id = u.template_id
             where u.user_id = p_user and u.status = 'active' and t.level = 'expert') then
    pool := pool || array['expert'];
  end if;
  if h.user_id is not null and exists (
       select 1 from unnest(public.kept_habits(h)) k
       where not exists (select 1 from public.habit_checkins c where c.user_id = p_user and c.habit = k
                         and c.week_start = date_trunc('week', current_date)::date)) then
    pool := pool || array['cap'];
  end if;
  if exists (select 1 from public.validations v where v.company_id = me.company_id and v.user_id <> p_user
             and v.visibility = 'company' and v.status = 'valid' and v.created_at > now() - interval '7 days') then
    pool := pool || array['bravo'];
  end if;

  -- La quête « défi » (preuve, expert ou lancer) est toujours tirée en premier ; les deux autres au hasard du jour.
  select array_agg(x order by md5(p_user::text || current_date || x)) into q
  from unnest(pool) x where x not in ('preuve', 'lancer', 'expert');
  q := array[case when has_active then 'preuve' else 'lancer' end] || q[1:2];
  if 'expert' = any (pool) and has_active and get_byte(decode(md5(p_user::text || current_date), 'hex'), 0) % 2 = 0 then
    q[1] := 'expert';
  end if;

  insert into public.daily_quests (user_id, day, quests) values (p_user, current_date, q)
  on conflict (user_id, day) do nothing;
  return q;
end;
$$;
revoke all on function public.todays_quests(uuid) from public;

create or replace function public.claim_daily_rewards()
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  q text[];
  done jsonb := '{}'::jsonb;
  all_done boolean := true;
  x text;
  ok boolean;
  s record;
  m record;
  gained integer := 0;
  n integer;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;

  q := public.todays_quests(me.id);
  foreach x in array q loop
    ok := public.quest_done(me.id, x);
    done := done || jsonb_build_object(x, ok);
    all_done := all_done and ok;
  end loop;

  if all_done then
    insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
    values (me.id, me.company_id, 'quete', 15, md5(me.id::text || ':quete:' || current_date)::uuid)
    on conflict (user_id, kind, ref_id) do nothing;
    get diagnostics n = row_count;
    gained := gained + n * 15;
  end if;

  select * into s from public.day_streak(me.id);
  for m in select * from (values (3, 10), (7, 25), (14, 50), (30, 100)) as t(days, pts) loop
    if s.streak >= m.days then
      insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
      values (me.id, me.company_id, 'serie', m.pts,
              md5(me.id::text || ':serie:' || m.days || ':' || s.started_on)::uuid)
      on conflict (user_id, kind, ref_id) do nothing;
      get diagnostics n = row_count;
      gained := gained + n * m.pts;
    end if;
  end loop;

  return jsonb_build_object(
    'order', to_jsonb(q),
    'quests', done,
    'quest_done', all_done,
    'streak', s.streak,
    'gained', gained);
end;
$$;
revoke all on function public.claim_daily_rewards() from public;
grant execute on function public.claim_daily_rewards() to authenticated;
