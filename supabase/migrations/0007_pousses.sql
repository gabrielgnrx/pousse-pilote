-- Pousse · les points s'appellent des « pousses », et on en gagne aussi chaque jour :
--   - quêtes du jour : valider un défi, ajouter une preuve, encourager un collègue ou garder le cap
--     → +15 pousses quand les trois sont faites ;
--   - série de jours actifs : +10 à 3 jours, +25 à 7, +50 à 14, +100 à 30.
-- Ces bonus sont écrits par la base (claim_daily_rewards), jamais par l'application.

alter table public.points_ledger drop constraint if exists points_ledger_kind_check;
alter table public.points_ledger add constraint points_ledger_kind_check
  check (kind in ('maintien', 'influence', 'temoin', 'quete', 'serie'));

-- Jours (heure de Paris) où une personne a fait quelque chose : défi validé, habitude gardée, bravo donné.
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
$$;
revoke all on function public.active_days(uuid) from public;

-- Série en cours : jours consécutifs actifs, jusqu'à aujourd'hui (ou hier si rien encore aujourd'hui).
create or replace function public.day_streak(p_user uuid)
returns table (streak integer, started_on date)
language plpgsql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  d date := current_date;
  n integer := 0;
begin
  if not exists (select 1 from public.active_days(p_user) a where a = d) then
    d := d - 1;
  end if;
  while exists (select 1 from public.active_days(p_user) a where a = d) loop
    n := n + 1;
    d := d - 1;
  end loop;
  return query select n, d + 1;
end;
$$;
revoke all on function public.day_streak(uuid) from public;

-- Relève les quêtes du jour et la série, crédite les bonus dus (une seule fois), et renvoie l'état.
create or replace function public.claim_daily_rewards()
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  q_defi boolean;
  q_preuve boolean;
  q_lien boolean;
  s record;
  m record;
  gained integer := 0;
  n integer;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;

  q_defi := exists (select 1 from public.validations
                    where user_id = me.id and status = 'valid' and day = current_date);
  q_preuve := exists (select 1 from public.validations
                      where user_id = me.id and status = 'valid' and day = current_date and proof_level > 0);
  q_lien := exists (select 1 from public.cheers where user_id = me.id and created_at::date = current_date)
         or exists (select 1 from public.habit_checkins where user_id = me.id and created_at::date = current_date);

  if q_defi and q_preuve and q_lien then
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
    'quests', jsonb_build_object('defi', q_defi, 'preuve', q_preuve, 'lien', q_lien),
    'quest_done', exists (select 1 from public.points_ledger where user_id = me.id and kind = 'quete'
                          and ref_id = md5(me.id::text || ':quete:' || current_date)::uuid),
    'streak', s.streak,
    'gained', gained);
end;
$$;

revoke all on function public.claim_daily_rewards() from public;
grant execute on function public.claim_daily_rewards() to authenticated;
