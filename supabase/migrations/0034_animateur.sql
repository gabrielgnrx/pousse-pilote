-- 0034 — L'animateur IA du QG d'équipe (v2, octobre 2026).
--
-- L'animateur est un participant du chat, signalé comme un bot (author_kind = 'animateur', avatar de la
-- mascotte). La base décide QUAND il parle (animator_due) et garantit la limite de fréquence :
--   - messages fixes : lundi 9 h (ouverture du vote), lundi 14 h (défi retenu), vendredi 16 h (bilan) ;
--   - messages spontanés (relance du mercredi, réaction à une série ou à un palier, météo) : au plus
--     un par jour et par équipe, garanti par un index unique.
-- L'application décide QUOI dire (texte rédigé par l'IA à partir d'agrégats d'équipe, ou gabarit).
-- Le vote ne se fait toujours que dans le chat, le lundi de 9 h à 14 h.

-- 1. Auteur des messages --------------------------------------------------------------------------------
alter table public.team_messages add column if not exists author_kind text not null default 'member'
  check (author_kind in ('member', 'pousse', 'animateur'));
update public.team_messages set author_kind = 'pousse' where user_id is null and author_kind = 'member';

-- 2. Ce que l'animateur a déjà dit ------------------------------------------------------------------------
create table if not exists public.animator_posts (
  id bigint generated always as identity primary key,
  team_id uuid not null references public.teams on delete cascade,
  day date not null,
  slot text not null check (slot in ('vote_open', 'vote_close', 'friday', 'midweek', 'reaction', 'meteo')),
  ref text not null default '',
  spontaneous boolean generated always as (slot in ('midweek', 'reaction', 'meteo')) stored,
  message_id uuid references public.team_messages on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
-- Un message fixe par créneau et par jour ; une réaction par palier ou par série (ref).
create unique index if not exists animator_posts_slot on public.animator_posts (team_id, day, slot) where not spontaneous;
create unique index if not exists animator_posts_ref on public.animator_posts (team_id, slot, ref) where ref <> '';
-- La limite de fréquence : au plus un message spontané par jour et par équipe.
create unique index if not exists animator_posts_spontaneous on public.animator_posts (team_id, day) where spontaneous;
alter table public.animator_posts enable row level security;

-- 3. Le défi d'équipe : l'annonce du lundi 14 h passe désormais par l'animateur ---------------------------
-- (même règlement qu'en 0021, sans le message fixe ; l'animateur poste l'annonce, ou son gabarit).
do $$
declare
  src text;
begin
  select pg_get_functiondef('public.settle_team_week(uuid, date, timestamp)'::regprocedure) into src;
  src := regexp_replace(src,
    $re$\s*insert into public\.team_messages \(company_id, team_id, user_id, body, created_at\)\s*values \(t_company, p_team, null,.*?\(p_week \+ time '14:00'\) at time zone 'Europe/Paris'\);$re$,
    E'\n      null; -- annonce postée par l''animateur (0034)', 's');
  if src !~ 'annonce postée par l''animateur' then
    raise exception 'settle_team_week : annonce introuvable, migration à revoir';
  end if;
  execute src;
end;
$$;

-- 4. Les rendez-vous de l'animateur -----------------------------------------------------------------------
-- Points CO₂ et rangs : seulement des agrégats d'équipe. Les prénoms ne sortent que pour le bilan du
-- vendredi, et seulement ceux des personnes qui ont publié dans le fil cette semaine.
create or replace function public.team_week_kg(p_team uuid, p_from date, p_to date)
returns numeric
language sql stable security definer set search_path = public
as $$
  select coalesce(round(sum(v.kg), 1), 0) from public.validations v
  join public.profiles p on p.id = v.user_id
  where p.team_id = p_team and v.status = 'valid' and v.day between p_from and p_to
$$;
revoke all on function public.team_week_kg(uuid, date, date) from public;

create or replace function public.team_rank(p_team uuid, p_since date)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with s as (
    select team_id, score, rank() over (order by score desc) as r, count(*) over () as n
    from public.team_scores((select company_id from public.teams where id = p_team), p_since))
  select coalesce((select jsonb_build_object('rank', r, 'teams', n) from s where team_id = p_team), '{}'::jsonb)
$$;
revoke all on function public.team_rank(uuid, date) from public;

create or replace function public.animator_due(p_token text, p_now timestamptz default now())
returns table (team_id uuid, company_id uuid, slot text, ref text, context jsonb)
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  t record;
  loc timestamp := p_now at time zone 'Europe/Paris';
  d date := (p_now at time zone 'Europe/Paris')::date;
  hm time := (p_now at time zone 'Europe/Paris')::time;
  dow integer := extract(isodow from (p_now at time zone 'Europe/Paris'));
  wk date := date_trunc('week', (p_now at time zone 'Europe/Paris'))::date;
  w public.team_weeks;
  posted_today boolean;
  members integer;
  cum numeric;
  palier numeric;
  streak integer;
  this_part integer;
  last_part integer;
begin
  if not public.cron_key_named('ia', p_token) then
    raise exception 'not_allowed';
  end if;

  for t in select tm.id, tm.company_id from public.teams tm
           where exists (select 1 from public.profiles p where p.team_id = tm.id) loop
    select count(*) into members from public.profiles p where p.team_id = t.id;

    -- Lundi 9 h : ouverture du vote (les 3 propositions sont tirées par settle_team_week).
    if dow = 1 and hm >= time '09:00' and hm < time '14:00'
       and not exists (select 1 from public.animator_posts a where a.team_id = t.id and a.day = d and a.slot = 'vote_open') then
      w := public.settle_team_week(t.id, wk, loc);
      if w.options is not null then
        team_id := t.id; company_id := t.company_id; slot := 'vote_open'; ref := '';
        context := jsonb_build_object(
          'members', members,
          'options', to_jsonb(w.options),
          'last_week', jsonb_build_object(
            'repas', public.team_kind_count('repas', t.id, null, wk - 7, wk - 1),
            'actions', public.team_kind_count('actions', t.id, null, wk - 7, wk - 1),
            'kg', public.team_week_kg(t.id, wk - 7, wk - 1)),
          'rank', public.team_rank(t.id, wk - 7));
        return next;
      end if;
    end if;

    -- Lundi 14 h : le défi retenu.
    if dow = 1 and hm >= time '14:00'
       and not exists (select 1 from public.animator_posts a where a.team_id = t.id and a.day = d and a.slot = 'vote_close') then
      w := public.settle_team_week(t.id, wk, loc);
      if w.chosen is not null then
        team_id := t.id; company_id := t.company_id; slot := 'vote_close'; ref := '';
        context := jsonb_build_object('members', members, 'chosen', w.chosen, 'target', w.target,
          'votes', (select count(*) from public.team_week_votes v where v.team_id = t.id and v.week_start = wk));
        return next;
      end if;
    end if;

    -- Vendredi 16 h : le bilan de la semaine.
    if dow = 5 and hm >= time '16:00'
       and not exists (select 1 from public.animator_posts a where a.team_id = t.id and a.day = d and a.slot = 'friday') then
      select * into w from public.team_weeks tw where tw.team_id = t.id and tw.week_start = wk;
      team_id := t.id; company_id := t.company_id; slot := 'friday'; ref := '';
      context := jsonb_build_object(
        'members', members,
        'kg', public.team_week_kg(t.id, wk, d),
        'actions', public.team_kind_count('actions', t.id, null, wk, d),
        'top', coalesce((select jsonb_agg(x.template_id order by x.n desc, x.template_id) from (
            select v.template_id, sum(v.units) as n from public.validations v join public.profiles p on p.id = v.user_id
            where p.team_id = t.id and v.status = 'valid' and v.day between wk and d
            group by v.template_id order by n desc, v.template_id limit 3) x), '[]'::jsonb),
        'chosen', w.chosen, 'target', w.target,
        'progress', case when w.chosen is not null then public.team_kind_count(w.chosen, t.id, null, wk, wk + 6) end,
        'rank', public.team_rank(t.id, wk),
        'rank_monday', (select a.meta->'rank' from public.animator_posts a where a.team_id = t.id and a.day = wk and a.slot = 'vote_open'),
        -- Félicitations nominatives : seulement les personnes qui ont publié dans le fil cette semaine.
        'publishers', coalesce((select jsonb_agg(distinct p.display_name) from public.validations v join public.profiles p on p.id = v.user_id
            where p.team_id = t.id and v.status = 'valid' and v.visibility = 'company' and v.day between wk and d), '[]'::jsonb));
      return next;
    end if;

    -- Messages spontanés : un par jour au plus, le plus utile d'abord.
    posted_today := exists (select 1 from public.animator_posts a where a.team_id = t.id and a.day = d and a.spontaneous);
    if posted_today or hm < time '10:00' or hm >= time '19:00' or dow > 5 then
      continue;
    end if;

    -- Réaction : un palier de CO₂ évité par l'équipe depuis le début.
    select coalesce(sum(v.kg), 0) into cum from public.validations v join public.profiles p on p.id = v.user_id
    where p.team_id = t.id and v.status = 'valid';
    select max(x) into palier from unnest(array[50, 100, 250, 500, 1000, 2500, 5000, 10000]::numeric[]) x where x <= cum;
    if palier is not null and not exists (select 1 from public.animator_posts a
                                          where a.team_id = t.id and a.slot = 'reaction' and a.ref = 'palier:' || palier) then
      team_id := t.id; company_id := t.company_id; slot := 'reaction'; ref := 'palier:' || palier;
      context := jsonb_build_object('kind', 'palier', 'kg', palier, 'members', members);
      return next;
      continue;
    end if;

    -- Réaction : une série d'au moins 7 jours avec au moins une action dans l'équipe (jusqu'à hier).
    select count(*) into streak from (
      select g::date as day from generate_series(d - 30, d - 1, interval '1 day') g) days
    where days.day > coalesce((
      select max(g2::date) from generate_series(d - 30, d - 1, interval '1 day') g2
      where not exists (select 1 from public.validations v join public.profiles p on p.id = v.user_id
                        where p.team_id = t.id and v.status = 'valid' and v.day = g2::date)), d - 31);
    if streak >= 7 and streak % 7 = 0 and not exists (select 1 from public.animator_posts a
                                    where a.team_id = t.id and a.slot = 'reaction' and a.ref = 'serie:' || (d - streak) || ':' || streak) then
      team_id := t.id; company_id := t.company_id; slot := 'reaction'; ref := 'serie:' || (d - streak) || ':' || streak;
      context := jsonb_build_object('kind', 'serie', 'days', streak, 'members', members);
      return next;
      continue;
    end if;

    -- Mercredi : relance si l'activité baisse nettement par rapport à la semaine dernière.
    if dow = 3 and hm >= time '11:00' then
      this_part := public.team_kind_count('actions', t.id, null, wk, d - 1);
      last_part := public.team_kind_count('actions', t.id, null, wk - 7, d - 8);
      if last_part >= 3 and this_part < 0.6 * last_part then
        team_id := t.id; company_id := t.company_id; slot := 'midweek'; ref := '';
        context := jsonb_build_object('this_week', this_part, 'last_week', last_part, 'members', members);
        return next;
        continue;
      end if;
    end if;

    -- Mardi et jeudi en fin d'après-midi : idée liée à la météo de demain (l'application consulte la
    -- prévision et ne poste que si elle s'y prête). Part des trajets en voiture déclarés dans l'équipe.
    if dow in (2, 4) and hm >= time '16:00' then
      team_id := t.id; company_id := t.company_id; slot := 'meteo'; ref := '';
      context := jsonb_build_object('members', members,
        'car_commuters', (select count(*) from public.habits h join public.profiles p on p.id = h.user_id
                          where p.team_id = t.id and h.commute_mode in ('voiture_seul', 'voiture_electrique')),
        'tomorrow', d + 1);
      return next;
    end if;
  end loop;
end;
$$;
revoke all on function public.animator_due(text, timestamptz) from public;
grant execute on function public.animator_due(text, timestamptz) to anon, authenticated;

-- 5. Poster un message de l'animateur ---------------------------------------------------------------------
create or replace function public.animator_post(p_token text, p_team uuid, p_slot text, p_ref text, p_body text,
                                                p_meta jsonb default '{}'::jsonb, p_now timestamptz default now())
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  m public.team_messages;
  body text := trim(coalesce(p_body, ''));
begin
  if not public.cron_key_named('ia', p_token) then
    raise exception 'not_allowed';
  end if;
  if char_length(body) = 0 or char_length(body) > 500 then
    raise exception 'invalid_message';
  end if;
  begin
    insert into public.animator_posts (team_id, day, slot, ref, meta)
    values (p_team, (p_now at time zone 'Europe/Paris')::date, p_slot, coalesce(p_ref, ''), coalesce(p_meta, '{}'::jsonb));
  exception when unique_violation then
    return false;  -- déjà dit aujourd'hui, ou limite de fréquence atteinte
  end;
  insert into public.team_messages (company_id, team_id, user_id, body, author_kind, created_at)
  select tm.company_id, tm.id, null, body, 'animateur', p_now from public.teams tm where tm.id = p_team
  returning * into m;
  update public.animator_posts set message_id = m.id
   where team_id = p_team and day = (p_now at time zone 'Europe/Paris')::date and slot = p_slot and ref = coalesce(p_ref, '')
     and message_id is null;
  return true;
end;
$$;
revoke all on function public.animator_post(text, uuid, text, text, text, jsonb, timestamptz) from public;
grant execute on function public.animator_post(text, uuid, text, text, text, jsonb, timestamptz) to anon, authenticated;
