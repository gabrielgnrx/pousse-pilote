-- 0030 — Le fil : publier est toujours proposé, jamais automatique (v2, octobre 2026).
--
-- 0022 publiait tout (actions, défis lancés et réussis) pour qui avait dit oui une fois. Décision
-- produit : comme sur Strava, chaque publication est proposée et choisie au cas par cas.
--   - Actions : publish_action publie avec ou sans photo (la photo rapporte toujours +5 pousses).
--   - Défis : un défi lancé ou réussi n'apparaît dans le fil que si la personne l'a partagé
--     (share_challenge), événement par événement.
--   - Le réglage global share_feed ne publie plus rien (colonne gardée pour l'historique).

-- 1. Actions : la photo devient facultative.
drop function if exists public.publish_action(uuid, text, text);
create or replace function public.publish_action(p_validation uuid, p_photo_path text default null, p_caption text default null)
returns public.validations
language plpgsql security definer
set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  v public.validations;
begin
  if p_photo_path is not null and split_part(p_photo_path, '/', 1) <> auth.uid()::text then
    raise exception 'invalid_photo';
  end if;
  update public.validations
     set proof_photo_path = coalesce(p_photo_path, proof_photo_path),
         proof_level = case when p_photo_path is null then proof_level else greatest(proof_level, 1) end,
         points = points + case when p_photo_path is null then 0 else 5 end,
         caption = nullif(trim(left(coalesce(p_caption, ''), 280)), ''),
         visibility = 'company'
   where id = p_validation
     and user_id = auth.uid()
     and status = 'valid'
     and visibility = 'private'
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

-- 2. Défis : partage choisi, événement par événement.
alter table public.user_challenges add column if not exists shared_start_at timestamptz;
alter table public.user_challenges add column if not exists shared_done_at timestamptz;

create or replace function public.share_challenge(p_challenge uuid, p_event text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if p_event not in ('lance', 'reussi') then
    raise exception 'invalid_event';
  end if;
  update public.user_challenges
     set shared_start_at = case when p_event = 'lance' then coalesce(shared_start_at, now()) else shared_start_at end,
         shared_done_at = case when p_event = 'reussi' then coalesce(shared_done_at, now()) else shared_done_at end
   where id = p_challenge
     and user_id = auth.uid()
     and status <> 'abandoned'
     and (p_event = 'lance' or status = 'done');
  if not found then
    raise exception 'nothing_to_share';
  end if;
end;
$$;
revoke all on function public.share_challenge(uuid, text) from public;
grant execute on function public.share_challenge(uuid, text) to authenticated;

-- Les défis déjà partagés automatiquement restent visibles (ils l'étaient avec l'accord de la personne).
update public.user_challenges c
   set shared_start_at = c.created_at
  from public.profiles p
 where p.id = c.user_id and p.share_feed and p.feed_choice_at is not null
   and c.created_at >= p.feed_choice_at and c.shared_start_at is null;
update public.user_challenges c
   set shared_done_at = c.done_at
  from public.profiles p
 where p.id = c.user_id and p.share_feed and p.feed_choice_at is not null
   and c.done_at is not null and c.done_at >= p.feed_choice_at and c.shared_done_at is null;

-- Le guard de 0025 laisse passer les fonctions de la base (security definer) : share_challenge en est une.

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
  cross join lateral (values ('lance', c.shared_start_at), ('reussi', c.shared_done_at)) as e(event, at)
  where c.company_id = me.company_id
    and c.status <> 'abandoned'
    and e.at is not null and e.at > now() - interval '14 days'
    and (not p_team_only or p.team_id = me.team_id)
  order by e.at desc
  limit 30
$$;
revoke all on function public.company_challenge_feed(boolean) from public;
grant execute on function public.company_challenge_feed(boolean) to authenticated;

-- 3. Le réglage global ne publie plus rien : nouveaux profils à « non » par défaut.
alter table public.profiles alter column share_feed set default false;
