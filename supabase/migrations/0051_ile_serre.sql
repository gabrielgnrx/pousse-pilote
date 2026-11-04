-- L'île, quatrième version : le défi décide quoi, les pousses décident combien.
--
-- 1. Débloquer une espèce. Au départ : bouleau (forêt), potager, fougère (plage), olivier (ruisseau),
--    plantés en graine sur l'île. Les fleurs d'activité s'ouvrent en essayant l'activité une fois
--    (saule : une action nature, tournesol : un meilleur choix au scanner, coquelicot : un bravo,
--    lavande : un quiz réussi, cactus : une habitude enregistrée). Les plantes communes et signature
--    de chaque zone s'ouvrent avec les actions de sa famille. Les plantes de défi s'ouvrent en
--    réussissant un défi (thème : zone, durée : rareté, difficulté : variante) ; le myosotis en le
--    recevant. Une espèce débloquée l'est pour toujours.
-- 2. Faire grandir avec ses pousses. Planter coûte 10 pousses (le premier exemplaire gagné en défi ou
--    reçu en cadeau est offert), puis chaque stade : 30, 60 et 100. Une plante adulte : 200 pousses.
--    Arracher une plante rend les pousses qu'elle a coûté. Le classement compte toujours les pousses
--    gagnées (member_points) : seul le solde à dépenser baisse.
-- 3. Les actions ne donnent plus de graines et la Graineterie ne vend plus rien : elle devient la Serre.
--    Les plantes déjà posées restent, à leur stade. Les plantes rares d'exploits et des graines mystère
--    se posent toujours une fois, adultes et offertes.
--
-- Une zone revit avec les stades des plantes de sa zone (16 stades : quatre plantes adultes).
-- Même règles que src/lib/game/island.ts et src/lib/game/catalog.ts.

alter table public.island_plants
  add column if not exists stage smallint not null default 1 check (stage between 1 and 4),
  add column if not exists spent integer not null default 0 check (spent >= 0),
  add column if not exists free boolean not null default false;

-- Les plantes déjà posées gardent leur taille : graines données → stade (1, 5, 15, 40 : stades 1 à 4).
update public.island_plants
set stage = case when rare or fed >= 40 then 4 when fed >= 15 then 3 when fed >= 5 then 2 else 1 end,
    free = true
where spent = 0;

-- Plus rien à vendre : les plantes communes et signature se débloquent par les actions de leur famille.
update public.island_catalog set price = null,
  unlock = case key
    when 'noisetier' then 2 when 'houx' then 4 when 'erable' then 8
    when 'groseillier' then 3 when 'courge' then 8 when 'pommier' then 15
    when 'oyat' then 1 when 'chardon' then 2 when 'pin_parasol' then 3
    when 'roseau' then 1 when 'iris' then 2 when 'aulne' then 3
    else unlock end
where kind in ('boutique', 'signature');
drop function if exists public.island_buy(text);

-- Un défi terminé sans succès ne donne plus de plante (il n'y a plus de plante commune à offrir).
-- Les départs déjà offerts.
create table if not exists public.island_starts (
  user_id uuid primary key references public.profiles on delete cascade,
  started_at timestamptz not null default now()
);
alter table public.island_starts enable row level security;

-- Coût du stade suivant (stade actuel 1 à 3) ; planter : 10.
create or replace function public.island_grow_cost(p_stage integer)
returns integer
language sql immutable set search_path = public
as $$
  select case p_stage when 1 then 30 when 2 then 60 when 3 then 100 end;
$$;

-- Pousses à dépenser : gagnées, moins ce que coûtent les plantes posées (et les achats de la v3).
create or replace function public.island_pousses(p_user uuid)
returns integer
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select greatest(0, public.member_points(p_user, null)
    - coalesce((select sum(cost) from public.island_inventory where user_id = p_user and source = 'achat'), 0)
    - coalesce((select sum(spent) from public.island_plants where user_id = p_user), 0))::integer;
$$;
revoke all on function public.island_pousses(uuid) from public;

-- Les espèces que je peux planter (hors plantes rares d'exploits, posées une fois).
create or replace function public.island_unlocked(p_user uuid, p_counts jsonb)
returns text[]
language sql stable security definer set search_path = public
as $$
  select array['transport', 'alimentation', 'consommation', 'logement']
    || array(select k from unnest(array['nature', 'scan', 'bravo', 'quiz', 'cap']) k
             where coalesce((p_counts->>k)::integer, 0) > 0)
    || array(select c.key from public.island_catalog c
             where c.kind in ('boutique', 'signature')
               and public.island_zone_seeds(p_counts, c.zone) >= c.unlock
             order by c.zone, c.unlock)
    || array(select distinct i.item from public.island_inventory i join public.island_catalog c on c.key = i.item
             where i.user_id = p_user and c.kind in ('defi', 'cadeau', 'boutique', 'signature')
               and not (c.kind in ('boutique', 'signature') and public.island_zone_seeds(p_counts, c.zone) >= c.unlock));
$$;
revoke all on function public.island_unlocked(uuid, jsonb) from public;

-- Exemplaires offerts encore à planter : récompenses, cadeaux et achats de la v3, moins ceux posés.
create or replace function public.island_free(p_user uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_object_agg(item, n), '{}'::jsonb) from (
    select i.item, count(*) - coalesce((select count(*) from public.island_plants p
                                        where p.user_id = p_user and p.species = i.item and p.free), 0) as n
    from public.island_inventory i join public.island_catalog c on c.key = i.item
    where i.user_id = p_user and c.kind <> 'visiteur'
    group by i.item) t
  where n > 0;
$$;
revoke all on function public.island_free(uuid) from public;

create or replace function public.island(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  g jsonb := public.garden(p_user);
  counts jsonb := (g->'counts') || jsonb_build_object('cap', (select count(*) from public.habit_checkins where user_id = p_user));
  me boolean := p_user = auth.uid();
begin
  return g || jsonb_build_object(
    'counts', counts,
    'plants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'species', p.species, 'rare', p.rare, 'x', p.x, 'z', p.z, 'fed', p.fed,
        'stage', p.stage, 'spent', p.spent, 'free', p.free,
        'planted_at', p.planted_at, 'grown_at', p.grown_at) order by p.planted_at)
      from public.island_plants p where p.user_id = p_user), '[]'::jsonb),
    -- Possédées : les visiteurs (migrateurs) s'y lisent.
    'inventory', coalesce((
      select jsonb_object_agg(i.item, i.n)
      from (select item, count(*) as n from public.island_inventory where user_id = p_user group by item) i), '{}'::jsonb),
    'unlocked', to_jsonb(public.island_unlocked(p_user, counts)),
    'free', public.island_free(p_user),
    'pousses', case when me then public.island_pousses(p_user) end,
    'recent', case when me then coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'item', r.item, 'source', r.source, 'at', r.created_at,
                                          'from', (select display_name from public.profiles where id = r.from_user))
                       order by r.created_at desc)
      from (select * from public.island_inventory
            where user_id = p_user and source <> 'achat' and created_at > now() - interval '30 days'
            order by created_at desc limit 12) r), '[]'::jsonb) end);
end;
$$;
revoke all on function public.island(uuid) from public;
revoke execute on function public.island(uuid) from anon;
grant execute on function public.island(uuid) to authenticated;

-- Planter une espèce débloquée sur une case libre de sa zone : offert s'il reste un exemplaire
-- gagné ou reçu, sinon 10 pousses. Les plantes rares d'exploits se posent une fois, adultes.
create or replace function public.island_plant(p_species text, p_x integer, p_z integer)
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me uuid := auth.uid();
  g jsonb;
  ex text;
  is_item boolean;
begin
  if me is null or not exists (select 1 from public.profiles where id = me) then
    raise exception 'not_member';
  end if;
  if not public.island_tile_ok(p_x, p_z) then
    raise exception 'off_island';
  end if;
  -- Deux plantations simultanées ne doivent pas dépenser les mêmes pousses.
  perform pg_advisory_xact_lock(hashtext('island:' || me::text));
  if exists (select 1 from public.island_plants where user_id = me and x = p_x and z = p_z) then
    raise exception 'tile_taken';
  end if;

  g := public.island(me);
  is_item := exists (select 1 from public.island_catalog where key = p_species);

  if (g->'unlocked') ? p_species then
    if not public.island_tile_fits(p_species, p_x, p_z) then
      raise exception 'wrong_zone';
    end if;
    if coalesce((g->'free'->>p_species)::integer, 0) > 0 then
      insert into public.island_plants (user_id, species, rare, x, z, stage, spent, free)
      values (me, p_species, is_item, p_x, p_z, 1, 0, true);
    else
      if public.island_pousses(me) < 10 then
        raise exception 'not_enough';
      end if;
      insert into public.island_plants (user_id, species, rare, x, z, stage, spent)
      values (me, p_species, is_item, p_x, p_z, 1, 10);
    end if;
  elsif is_item or p_species in ('transport', 'alimentation', 'consommation', 'logement', 'nature', 'scan', 'bravo', 'quiz', 'cap') then
    raise exception 'locked';
  else
    ex := public.island_rare_exploit(p_species);
    if not (coalesce((g->'exploits'->>ex)::boolean, false) or (ex is null and (g->'rares') ? p_species)) then
      raise exception 'locked';
    end if;
    if exists (select 1 from public.island_plants where user_id = me and species = p_species and rare) then
      raise exception 'already_planted';
    end if;
    insert into public.island_plants (user_id, species, rare, x, z, stage, free) values (me, p_species, true, p_x, p_z, 4, true);
  end if;

  return public.island(me);
end;
$$;
revoke all on function public.island_plant(text, integer, integer) from public;
revoke execute on function public.island_plant(text, integer, integer) from anon;
grant execute on function public.island_plant(text, integer, integer) to authenticated;

-- Faire grandir une de mes plantes d'un stade, avec mes pousses.
create or replace function public.island_grow(p_x integer, p_z integer)
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me uuid := auth.uid();
  here public.island_plants;
  cost integer;
begin
  if me is null or not exists (select 1 from public.profiles where id = me) then
    raise exception 'not_member';
  end if;
  perform pg_advisory_xact_lock(hashtext('island:' || me::text));
  select * into here from public.island_plants where user_id = me and x = p_x and z = p_z for update;
  if here.id is null then
    raise exception 'no_plant';
  end if;
  if here.stage >= 4 then
    raise exception 'adult';
  end if;
  cost := public.island_grow_cost(here.stage);
  if public.island_pousses(me) < cost then
    raise exception 'not_enough';
  end if;
  update public.island_plants set stage = stage + 1, spent = spent + cost, grown_at = now() where id = here.id;
  return public.island(me);
end;
$$;
revoke all on function public.island_grow(integer, integer) from public;
revoke execute on function public.island_grow(integer, integer) from anon;
grant execute on function public.island_grow(integer, integer) to authenticated;

-- Récupérer ce qui m'est dû : les quatre plantes de départ (une fois, si l'île est vide), les espèces
-- débloquées par les défis réussis depuis le lancement, les migrateurs de mon équipe.
create or replace function public.island_claim()
returns integer
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  c record;
  m jsonb;
  wk date;
  added integer := 0;
  n integer;
  launched timestamptz := (select launched_at from public.island_launch);
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;

  -- Les plantes de départ : une graine par zone, offerte, au plus près du centre.
  if not exists (select 1 from public.island_plants where user_id = me.id) then
    insert into public.island_starts (user_id) values (me.id) on conflict do nothing;
    if found then
      insert into public.island_plants (user_id, species, x, z, stage, free) values
        (me.id, 'transport', -1, -1, 1, true),
        (me.id, 'logement', 1, -1, 1, true),
        (me.id, 'consommation', 1, 1, 1, true),
        (me.id, 'alimentation', -1, 1, 1, true);
      added := added + 4;
    end if;
  else
    insert into public.island_starts (user_id) values (me.id) on conflict do nothing;
  end if;

  for c in
    select u.id, u.target, (u.ends_on - u.starts_on + 1) as days, t.category, t.level
    from public.user_challenges u join public.challenge_templates t on t.id = u.template_id
    where u.user_id = me.id and u.status = 'done' and u.done_at >= launched
  loop
    insert into public.island_inventory (user_id, item, source, ref)
    select me.id, r.item, 'defi', c.id::text || ':' || r.i
    from unnest(public.island_challenge_reward(c.category, c.days, c.target, c.level)) with ordinality as r(item, i)
    on conflict (user_id, source, ref) do nothing;
    get diagnostics n = row_count;
    added := added + n;
  end loop;

  if me.team_id is not null then
    foreach wk in array array[date_trunc('week', current_date)::date, date_trunc('week', current_date)::date - 7] loop
      m := public.island_migration(me.team_id, wk);
      if (m->>'done')::boolean and wk + 7 > launched::date then
        insert into public.island_inventory (user_id, item, source, ref)
        select p.id, m->>'bird', 'equipe', me.team_id::text || ':' || wk
        from public.profiles p where p.team_id = me.team_id
        on conflict (user_id, source, ref) do nothing;
        get diagnostics n = row_count;
        added := added + n;
      end if;
    end loop;
  end if;
  return added;
end;
$$;
revoke all on function public.island_claim() from public;
revoke execute on function public.island_claim() from anon;
grant execute on function public.island_claim() to authenticated;

-- Le myosotis offert : le message parle de pousses, plus de graines.
create or replace function public.island_gift(p_to uuid)
returns void
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;
  if p_to = me.id or not exists (select 1 from public.profiles where id = p_to and company_id = me.company_id) then
    raise exception 'not_colleague';
  end if;
  perform pg_advisory_xact_lock(hashtext('gift:' || me.id::text));
  if exists (select 1 from public.island_inventory
             where from_user = me.id and source = 'cadeau' and created_at::date = current_date) then
    raise exception 'already_gifted';
  end if;
  insert into public.island_inventory (user_id, item, source, ref, from_user)
  values (p_to, 'myosotis', 'cadeau', me.id::text || ':' || current_date, me.id);
  perform public.notify(p_to, 'cadeau_ile', me.id::text || ':' || current_date,
    me.display_name || ' t''offre un myosotis',
    'Le premier est offert : plante-le sur ton île. Trois myosotis attirent le rouge-gorge.', '/fil');
end;
$$;
revoke all on function public.island_gift(uuid) from public;
revoke execute on function public.island_gift(uuid) from anon;
grant execute on function public.island_gift(uuid) to authenticated;
