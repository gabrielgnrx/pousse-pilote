-- Fonctions : appartenance, calcul du CO₂, validation des défis, statistiques d'équipe.
-- Le calcul du CO₂ se fait ici, côté base : le navigateur n'envoie jamais de chiffre de CO₂.

create or replace function public.my_company_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select company_id from public.profiles where id = auth.uid() $$;

-- CO₂ évité (kg) pour une unité de défi, selon les habitudes déclarées.
-- Doit rester identique à src/lib/co2/challenges.ts (unitImpact) ; 0 = pas éligible.
create or replace function public.unit_kg(p_template text, p_variant text, h public.habits)
returns numeric
language plpgsql immutable
as $$
declare
  car_thermique constant numeric := 0.1106;
  car_electrique constant numeric := 0.0121;
  covoiturage constant numeric := 0.0553;
  transit constant numeric := (0.0042 + 0.0066) / 2;  -- moyenne métro / RER
  avion_court constant numeric := 0.2242;
  tgv constant numeric := 0.0023;
  boeuf constant numeric := 4.97;
  vegetarien constant numeric := 0.85;
  autre_viande constant numeric := (1.65 + 1.46 + 1.46) / 3;  -- porc, poulet, saumon
  commute_factor numeric;
  has_commute boolean := h.commute_km > 0 and h.commute_days > 0;
begin
  commute_factor := case h.commute_mode
    when 'voiture_seul' then car_thermique
    when 'voiture_electrique' then car_electrique
    when 'covoiturage' then covoiturage
    when 'transports_en_commun' then transit
    else 0 end;

  case p_template
    when 'velo' then
      if has_commute and commute_factor > 0 then
        return h.commute_km * commute_factor;
      end if;
    when 'transports' then
      if has_commute and commute_factor > transit then
        return h.commute_km * (commute_factor - transit);
      end if;
    when 'covoiturage' then
      if has_commute and h.commute_mode in ('voiture_seul', 'voiture_electrique') then
        return h.commute_km * commute_factor / 2;
      end if;
    when 'train' then
      if h.short_flights_year > 0 and p_variant in ('300', '500', '800') then
        return p_variant::numeric * (avion_court - tgv);
      end if;
    when 'vege' then
      if p_variant = 'boeuf' and h.beef_meals_week > 0 then
        return boeuf - vegetarien;
      elsif p_variant = 'autre' and h.other_meat_meals_week > 0 then
        return autre_viande - vegetarien;
      end if;
    when 'moins_boeuf' then
      if h.beef_meals_week > 0 then
        return boeuf - autre_viande;
      end if;
    when 'occasion' then
      if h.new_clothes_year > 0 then
        return case p_variant
          when 'tshirt' then 6.43
          when 'chemise' then 13.2
          when 'chaussures' then 15
          when 'jean' then 25.1
          when 'pull' then 56.7
          when 'manteau' then 101
          else 0 end;
      end if;
    when 'chauffage' then
      if h.heating_kg_year > 0 then
        return h.heating_kg_year * 0.07 / 30;
      end if;
    else
      null;
  end case;
  return 0;
end;
$$;

-- Rejoindre une entreprise --------------------------------------------------

-- Lisible sans être connecté : nom de l'entreprise et équipes pour un code donné.
create or replace function public.company_by_code(p_code text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'email_domain', c.email_domain,
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by t.name)
      from public.teams t where t.company_id = c.id), '[]'::jsonb))
  from public.companies c
  where c.join_code = upper(trim(p_code))
$$;

create or replace function public.join_company(
  p_code text,
  p_team uuid,
  p_display_name text,
  p_consent_team_stats boolean,
  p_consent_feedback boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  c public.companies;
  user_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select * into c from public.companies where join_code = upper(trim(p_code));
  if not found then
    raise exception 'unknown_code';
  end if;
  select email into user_email from auth.users where id = auth.uid();
  if c.email_domain is not null
     and lower(split_part(user_email, '@', 2)) <> lower(c.email_domain) then
    raise exception 'wrong_email_domain';
  end if;
  if p_team is not null
     and not exists (select 1 from public.teams where id = p_team and company_id = c.id) then
    raise exception 'unknown_team';
  end if;

  insert into public.profiles (id, company_id, team_id, display_name, consent_data,
                               consent_team_stats, consent_feedback)
  values (auth.uid(), c.id, p_team, trim(p_display_name), true,
          coalesce(p_consent_team_stats, true), coalesce(p_consent_feedback, true))
  on conflict (id) do update set
    team_id = excluded.team_id,
    display_name = excluded.display_name,
    consent_team_stats = excluded.consent_team_stats,
    consent_feedback = excluded.consent_feedback
  where public.profiles.company_id = excluded.company_id;
end;
$$;

-- Valider une journée de défi ------------------------------------------------

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

  -- Plafond partagé par groupe (ex. 2 trajets domicile-travail par jour, tous défis confondus).
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
    allowed * t.points_per_unit + case when lvl > 0 then 5 else 0 end,
    p_photo_path, p_witness,
    case when p_witness is null then 'none' else 'pending' end,
    lvl, nullif(trim(p_caption), ''),
    -- Sans preuve, rien n'est publié.
    case when lvl > 0 and p_visibility = 'company' then 'company' else 'private' end)
  returning * into v;

  select coalesce(sum(units), 0) into done_units
  from public.validations where challenge_id = c.id and status = 'valid';
  if done_units >= c.target then
    update public.user_challenges set status = 'done' where id = c.id;
  end if;

  return v;
end;
$$;

-- Réponse du collègue témoin : un refus annule la validation.
create or replace function public.respond_witness(p_validation uuid, p_confirm boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.validations set
    witness_status = case when p_confirm then 'confirmed' else 'denied' end,
    status = case when p_confirm then status else 'rejected' end,
    kg = case when p_confirm then kg else 0 end,
    points = case when p_confirm then points else 0 end,
    visibility = case when p_confirm then visibility else 'private' end
  where id = p_validation
    and witness_id = auth.uid()
    and witness_status = 'pending';
  if not found then
    raise exception 'nothing_to_confirm';
  end if;
end;
$$;

-- Classement des équipes : seulement les équipes d'au moins 5 participants,
-- les plus petites sont regroupées, et un groupe de moins de 5 n'est pas affiché.
create or replace function public.team_stats(p_since date default null)
returns table (team_name text, participants integer, kg numeric, kg_per_person numeric, is_mine boolean)
language sql stable security definer set search_path = public
as $$
  with me as (
    select company_id, team_id from public.profiles where id = auth.uid()
  ),
  members as (
    select p.id, p.team_id
    from public.profiles p, me
    where p.company_id = me.company_id and p.consent_team_stats
  ),
  per_team as (
    select coalesce(t.name, 'Sans équipe') as name, m.team_id,
           count(*) as participants,
           coalesce(sum(vs.kg), 0) as kg
    from members m
    left join public.teams t on t.id = m.team_id
    left join lateral (
      select sum(v.kg) as kg from public.validations v
      where v.user_id = m.id and v.status = 'valid'
        and (p_since is null or v.day >= p_since)
    ) vs on true
    group by 1, 2
  ),
  grouped as (
    select case when participants >= 5 then name else 'Autres équipes' end as name,
           case when participants >= 5 then team_id end as team_id,
           participants, kg
    from per_team
  )
  select g.name,
         sum(g.participants)::integer,
         round(sum(g.kg), 1),
         round(sum(g.kg) / sum(g.participants), 1),
         coalesce(bool_or(g.team_id = (select team_id from me)), false)
  from grouped g
  group by g.name
  having sum(g.participants) >= 5
  order by 4 desc;
$$;

-- Total de l'entreprise (agrégé, sans détail individuel).
create or replace function public.company_stats()
returns table (participants integer, kg numeric)
language sql stable security definer set search_path = public
as $$
  select
    (select count(*)::integer from public.profiles where company_id = public.my_company_id()),
    coalesce((select round(sum(kg), 1) from public.validations
              where company_id = public.my_company_id() and status = 'valid'), 0)
$$;

-- Suppression du compte : profil, bilans, défis et validations partent en cascade.
-- Les réponses au questionnaire restent, détachées de la personne (user_id à null).
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

-- Droits d'exécution ----------------------------------------------------------

revoke all on function public.my_company_id() from public;
revoke all on function public.company_by_code(text) from public;
revoke all on function public.join_company(text, uuid, text, boolean, boolean) from public;
revoke all on function public.validate_challenge_day(uuid, integer, text, uuid, text, text) from public;
revoke all on function public.respond_witness(uuid, boolean) from public;
revoke all on function public.team_stats(date) from public;
revoke all on function public.company_stats() from public;
revoke all on function public.delete_my_account() from public;

grant execute on function public.company_by_code(text) to anon, authenticated;
grant execute on function public.my_company_id() to authenticated;
grant execute on function public.join_company(text, uuid, text, boolean, boolean) to authenticated;
grant execute on function public.validate_challenge_day(uuid, integer, text, uuid, text, text) to authenticated;
grant execute on function public.respond_witness(uuid, boolean) to authenticated;
grant execute on function public.team_stats(date) to authenticated;
grant execute on function public.company_stats() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
