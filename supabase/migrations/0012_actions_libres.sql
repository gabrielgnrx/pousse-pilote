-- Pousse · actions enregistrées librement (bouton +)
--   1. Une action s'enregistre en un tap, sans défi ni preuve : elle rapporte ses pousses tout de suite.
--   2. Le CO₂ reste celui du bilan : une action qui ne remplace aucune habitude déclarée compte 0 kg.
--   3. Si un défi en cours porte sur la même action, elle y compte (pop-up « Continue comme ça »).
--   4. Petits gestes du quotidien (escaliers, gourde, ordinateur éteint) : 0 kg mesurable, 2 pousses.
--   5. Ajouter une photo après coup : +5 pousses et l'action est publiée dans le fil.
-- Les plafonds par jour restent ceux des défis : au-delà, rien n'est compté.

-- 1. Une validation n'est plus forcément rattachée à un défi -----------------------------------

alter table public.validations alter column challenge_id drop not null;

-- 2. Petits gestes du quotidien ----------------------------------------------------------------

alter table public.challenge_templates drop constraint if exists challenge_templates_category_check;
alter table public.challenge_templates add constraint challenge_templates_category_check
  check (category in ('transport', 'alimentation', 'consommation', 'logement', 'quotidien'));

insert into public.challenge_templates (id, category, title, points_per_unit, cap_group, cap_units, cap_window_days, level) values
  ('escaliers', 'quotidien', 'Escaliers plutôt que l''ascenseur',          2, 'escaliers', 1, 1, 'standard'),
  ('gourde',    'quotidien', 'Gourde ou tasse au lieu d''un gobelet jetable', 2, 'gourde',    1, 1, 'standard'),
  ('ecran',     'quotidien', 'Ordinateur éteint en partant le soir',       2, 'ecran',     1, 1, 'standard')
on conflict (id) do update set
  category = excluded.category, title = excluded.title, points_per_unit = excluded.points_per_unit,
  cap_group = excluded.cap_group, cap_units = excluded.cap_units,
  cap_window_days = excluded.cap_window_days, level = excluded.level;

-- 3. Enregistrer une action ---------------------------------------------------------------------

create or replace function public.log_action(p_template text, p_variant text default 'base')
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
  per_unit numeric := 0;
  used integer;
  v public.validations;
  done_units integer;
  challenge jsonb := null;
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

  -- Un défi en cours sur la même action ? L'action y compte.
  select * into c from public.user_challenges
  where user_id = me.id and template_id = t.id and variant = p_variant
    and status = 'active' and current_date between starts_on and ends_on
  order by created_at
  limit 1
  for update;

  insert into public.validations (
    challenge_id, user_id, company_id, team_id, template_id, variant, day, units,
    kg, points, proof_photo_path, witness_id, witness_status, proof_level, caption, visibility)
  values (
    c.id, me.id, me.company_id, me.team_id, t.id, p_variant, current_date, 1,
    round(per_unit, 3), t.points_per_unit, null, null, 'none', 0, null, 'private')
  returning * into v;

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
      'days', (select coalesce(jsonb_agg(distinct d.day), '[]'::jsonb)
               from public.validations d where d.challenge_id = c.id and d.status = 'valid'));
  end if;

  return jsonb_build_object(
    'id', v.id,
    'template_id', v.template_id,
    'variant', v.variant,
    'kg', v.kg,
    'points', v.points,
    'challenge', challenge,
    -- Combien de fois ce mois-ci, et le CO₂ cumulé de cette action.
    'month_count', (select count(*) from public.validations m
                    where m.user_id = me.id and m.status = 'valid' and m.template_id = t.id
                      and m.day >= date_trunc('month', current_date)::date),
    'month_kg', (select coalesce(sum(m.kg), 0) from public.validations m
                 where m.user_id = me.id and m.status = 'valid' and m.template_id = t.id
                   and m.day >= date_trunc('month', current_date)::date));
end;
$$;
revoke all on function public.log_action(text, text) from public;
grant execute on function public.log_action(text, text) to authenticated;

-- 4. Ajouter une photo après coup : +5 pousses et publication dans le fil ------------------------

create or replace function public.publish_action(p_validation uuid, p_photo_path text, p_caption text default null)
returns public.validations
language plpgsql security definer
set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  v public.validations;
begin
  if p_photo_path is null or split_part(p_photo_path, '/', 1) <> auth.uid()::text then
    raise exception 'invalid_photo';
  end if;
  update public.validations
     set proof_photo_path = p_photo_path,
         proof_level = greatest(proof_level, 1),
         points = points + 5,
         caption = nullif(trim(left(coalesce(p_caption, ''), 280)), ''),
         visibility = 'company'
   where id = p_validation
     and user_id = auth.uid()
     and status = 'valid'
     and proof_photo_path is null
     and day = current_date
  returning * into v;
  if v.id is null then
    raise exception 'nothing_to_publish';
  end if;
  return v;
end;
$$;
revoke all on function public.publish_action(uuid, text, text) from public;
grant execute on function public.publish_action(uuid, text, text) to authenticated;

-- 5. Accueil : le compteur commun de l'entreprise ----------------------------------------------
-- Total depuis le début du pilote, gain du jour, collègues actifs aujourd'hui, objectif,
-- ma part et mon rang dans mon équipe (en CO₂ évité). Uniquement des agrégats.

create or replace function public.company_pulse()
returns jsonb
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  with me as (
    select p.id, p.company_id, p.team_id, c.name, c.pilot_start, c.pilot_weeks
    from public.profiles p join public.companies c on c.id = p.company_id
    where p.id = auth.uid()
  ),
  vals as (
    select v.* from public.validations v, me
    where v.company_id = me.company_id and v.status = 'valid' and v.day >= me.pilot_start
  ),
  team_kg as (
    select v.user_id, sum(v.kg) as kg from vals v, me
    where me.team_id is not null and v.team_id = me.team_id
    group by v.user_id
  )
  select jsonb_build_object(
    'name', me.name,
    'kg', (select round(coalesce(sum(kg), 0), 1) from vals),
    'today_kg', (select round(coalesce(sum(kg), 0), 1) from vals where day = current_date),
    'active_today', (select count(distinct user_id) from vals where day = current_date),
    'participants', (select count(*) from public.profiles p where p.company_id = me.company_id),
    'goal_kg', greatest(30, 30 * (select count(*) from public.profiles p where p.company_id = me.company_id)),
    'ends_on', me.pilot_start + 7 * me.pilot_weeks - 1,
    'my_kg', (select round(coalesce(sum(kg), 0), 1) from vals where user_id = me.id),
    'team_rank', case when me.team_id is null then null else
      (select 1 + count(*) from team_kg where kg > coalesce((select kg from team_kg where user_id = me.id), 0)) end,
    'team_size', case when me.team_id is null then null else
      (select count(*) from public.profiles p where p.team_id = me.team_id) end)
  from me
$$;
revoke all on function public.company_pulse() from public;
grant execute on function public.company_pulse() to authenticated;
