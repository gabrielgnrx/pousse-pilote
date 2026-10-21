-- Pousse · tout passe dans le fil
--   Chaque action enregistrée et chaque défi (lancé, réussi) apparaissent dans le fil de l'entreprise,
--   pour qui a dit oui (profiles.share_feed, choix daté par feed_choice_at). Rien de ce qui précède ce
--   choix n'est rendu public. Les reçus d'achat sont rangés à part (receipt_path) : jamais lisibles par
--   les collègues, même quand l'achat est dans le fil.

alter table public.profiles add column if not exists share_feed boolean not null default true;
alter table public.profiles add column if not exists feed_choice_at timestamptz;
alter table public.validations add column if not exists receipt_path text;
alter table public.user_challenges add column if not exists done_at timestamptz;

-- 1. Les reçus : leur propre colonne, que la règle de lecture des photos ne consulte pas --------------

create or replace function public.check_receipt()
returns trigger
language plpgsql set search_path = public
as $$
begin
  -- Effacer un reçu après 90 jours (purge) reste possible ; l'enregistrer sans reçu, non.
  if tg_op = 'UPDATE' and new.receipt_path is null then
    return new;
  end if;
  if exists (select 1 from public.challenge_templates t where t.id = new.template_id and t.requires_receipt) then
    if new.receipt_path is null then
      raise exception 'receipt_required';
    end if;
    if split_part(new.receipt_path, '/', 1) <> new.user_id::text then
      raise exception 'invalid_photo';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists validations_receipt on public.validations;
create trigger validations_receipt
  before insert or update of receipt_path on public.validations
  for each row execute function public.check_receipt();

update public.validations v
   set receipt_path = v.proof_photo_path, proof_photo_path = null
  from public.challenge_templates t
 where t.id = v.template_id and t.requires_receipt and v.proof_photo_path is not null and v.receipt_path is null;

-- log_action : le reçu va dans receipt_path

create or replace function public.log_action(p_template text, p_variant text default 'base', p_receipt text default null)
returns jsonb
language plpgsql security definer
set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  t public.challenge_templates;
  h public.habits;
  c public.user_challenges;
  d public.duels;
  w public.team_weeks;
  wk date := date_trunc('week', current_date)::date;
  per_unit numeric := 0;
  used integer;
  pts integer;
  mult numeric := 1;
  boost text := null;
  team_before integer;
  v public.validations;
  done_units integer;
  challenge jsonb := null;
  duel jsonb := null;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;

  select * into t from public.challenge_templates where id = p_template and active;
  if not found then
    raise exception 'unknown_action';
  end if;
  p_variant := coalesce(nullif(trim(p_variant), ''), 'base');
  if t.requires_receipt and p_receipt is null then
    raise exception 'receipt_required';
  end if;
  if p_receipt is not null and split_part(p_receipt, '/', 1) <> me.id::text then
    raise exception 'invalid_photo';
  end if;

  -- Plafond partagé du groupe, comme pour les défis.
  select coalesce(sum(val.units), 0) into used
  from public.validations val
  join public.challenge_templates tt on tt.id = val.template_id
  where val.user_id = me.id
    and val.status = 'valid'
    and tt.cap_group = t.cap_group
    and val.day > current_date - t.cap_window_days;
  if used >= t.cap_units then
    raise exception 'cap_reached';
  end if;

  -- Le CO₂ vient du bilan : 0 kg si l'action ne remplace aucune habitude déclarée.
  select * into h from public.habits where user_id = me.id;
  if found then
    per_unit := public.unit_kg(t.id, p_variant, h);
  end if;

  -- Gestes à 0 kg : 5 pousses par jour au plus, tous confondus. Un achat avec reçu n'est pas plafonné.
  pts := t.points_per_unit;
  if round(per_unit, 3) = 0 and not t.requires_receipt then
    pts := least(pts, greatest(0, 5 - (
      select coalesce(sum(z.points), 0) from public.validations z
      join public.challenge_templates zt on zt.id = z.template_id
      where z.user_id = me.id and z.status = 'valid' and z.day = current_date and z.kg = 0
        and not zt.requires_receipt)));
  end if;

  -- Un défi perso en cours sur la même action ? L'action y compte.
  select * into c from public.user_challenges
  where user_id = me.id and template_id = t.id and variant = p_variant
    and status = 'active' and current_date between starts_on and ends_on
  order by created_at
  limit 1
  for update;

  -- Le défi d'équipe de la semaine, pour voir si l'action le fait avancer.
  if me.team_id is not null then
    select * into w from public.team_weeks where team_id = me.team_id and week_start = wk and chosen is not null;
    if found then
      team_before := public.team_kind_count(w.chosen, me.team_id, me.id, wk, wk + 6);
    end if;
  end if;

  insert into public.validations (
    challenge_id, user_id, company_id, team_id, template_id, variant, day, units,
    kg, points, proof_photo_path, receipt_path, witness_id, witness_status, proof_level, caption, visibility)
  values (
    c.id, me.id, me.company_id, me.team_id, t.id, p_variant, current_date, 1,
    round(per_unit, 3), pts, null, p_receipt, null, 'none', case when p_receipt is null then 0 else 1 end, null, 'private')
  returning * into v;

  -- À plusieurs, ça rapporte plus : ×2 pour le défi d'équipe, sinon ×1,5 pour un duel en cours.
  if team_before is not null and public.team_kind_count(w.chosen, me.team_id, me.id, wk, wk + 6) > team_before then
    mult := 2;
    boost := 'equipe';
  end if;
  select * into d from public.duels
  where me.id in (challenger, opponent) and status = 'active' and kind = 'action' and template_id = t.id
    and current_date between starts_on and ends_on
  order by created_at
  limit 1;
  if found then
    if boost is null then
      mult := 1.5;
      boost := 'duel';
    end if;
    duel := jsonb_build_object(
      'other_name', (select display_name from public.profiles
                     where id = case when d.challenger = me.id then d.opponent else d.challenger end),
      'mine', public.duel_progress(d, me.id),
      'theirs', public.duel_progress(d, case when d.challenger = me.id then d.opponent else d.challenger end),
      'target', d.target,
      'ends_on', d.ends_on,
      'stakes', d.stakes);
  end if;
  if mult > 1 and pts > 0 then
    update public.validations set points = round(pts * mult)::integer where id = v.id returning * into v;
  end if;

  if c.id is not null then
    select coalesce(sum(units), 0) into done_units
    from public.validations where challenge_id = c.id and status = 'valid';
    if done_units >= c.target then
      update public.user_challenges set status = 'done' where id = c.id;
    end if;
    challenge := jsonb_build_object(
      'id', c.id,
      'target', c.target,
      'done', done_units,
      'starts_on', c.starts_on,
      'ends_on', c.ends_on,
      'days', (select coalesce(jsonb_agg(distinct dd.day), '[]'::jsonb)
               from public.validations dd where dd.challenge_id = c.id and dd.status = 'valid'));
  end if;

  return jsonb_build_object(
    'id', v.id,
    'template_id', v.template_id,
    'variant', v.variant,
    'kg', v.kg,
    'points', v.points,
    'base_points', pts,
    'multiplier', mult,
    'boost', boost,
    'duel', duel,
    'receipt', p_receipt is not null,
    'challenge', challenge,
    'month_count', (select count(*) from public.validations m
                    where m.user_id = me.id and m.status = 'valid' and m.template_id = t.id
                      and m.day >= date_trunc('month', current_date)::date),
    'month_kg', (select coalesce(sum(m.kg), 0) from public.validations m
                 where m.user_id = me.id and m.status = 'valid' and m.template_id = t.id
                   and m.day >= date_trunc('month', current_date)::date));
end;
$$;
revoke all on function public.log_action(text, text, text) from public;
grant execute on function public.log_action(text, text, text) to authenticated;

-- 2. Tout ce qui est enregistré passe dans le fil, pour qui l'a accepté ----------------------------

create or replace function public.share_to_feed()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.visibility = 'private' and exists (
       select 1 from public.profiles p
       where p.id = new.user_id and p.share_feed and p.feed_choice_at is not null) then
    new.visibility := 'company';
  end if;
  return new;
end;
$$;
revoke all on function public.share_to_feed() from public;
drop trigger if exists validations_share_to_feed on public.validations;
create trigger validations_share_to_feed
  before insert on public.validations
  for each row execute function public.share_to_feed();

-- Le jour où un défi est réussi, pour l'annoncer dans le fil.
create or replace function public.challenge_done_at()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    new.done_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists user_challenges_done_at on public.user_challenges;
create trigger user_challenges_done_at
  before update of status on public.user_challenges
  for each row execute function public.challenge_done_at();

-- Les défis lancés et réussis des collègues, pour le fil (14 derniers jours, après leur accord).
create or replace function public.company_challenge_feed(p_team_only boolean default false)
returns table (id uuid, user_id uuid, display_name text, team_name text, template_id text, variant text,
               target integer, done integer, status text, event text, at timestamptz, duel_with text, ends_on date)
language sql stable security definer set search_path = public
as $$
  with me as (select company_id, team_id from public.profiles where id = auth.uid())
  select c.id, c.user_id, p.display_name, t.name, c.template_id, c.variant, c.target,
         coalesce((select sum(v.units) from public.validations v where v.challenge_id = c.id and v.status = 'valid'), 0)::integer,
         c.status, e.event, e.at,
         (select o.display_name from public.duels d
          join public.profiles o on o.id = case when d.challenger = c.user_id then d.opponent else d.challenger end
          where d.challenge_id = c.id and d.status in ('pending', 'active', 'done')
          order by d.created_at desc limit 1),
         c.ends_on
  from public.user_challenges c
  join public.profiles p on p.id = c.user_id
  left join public.teams t on t.id = p.team_id
  cross join me
  cross join lateral (values ('lance', c.created_at), ('reussi', c.done_at)) as e(event, at)
  where c.company_id = me.company_id
    and c.status <> 'abandoned'
    and p.share_feed and p.feed_choice_at is not null
    and e.at is not null and e.at >= p.feed_choice_at and e.at > now() - interval '14 days'
    and (not p_team_only or p.team_id = me.team_id)
  order by e.at desc
  limit 30
$$;
revoke all on function public.company_challenge_feed(boolean) from public;
grant execute on function public.company_challenge_feed(boolean) to authenticated;
