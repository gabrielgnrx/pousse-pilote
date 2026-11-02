-- L'île, troisième version : deux façons d'obtenir des plantes, et l'équipe.
--
-- 1. La Graineterie : les pousses achètent des plantes communes (ouvertes à tous) et des plantes
--    signature (débloquées par les actions de la famille de la zone). Dépenser ne touche jamais au
--    classement : il compte les pousses gagnées (member_points), le solde à dépenser est à part.
-- 2. Les défis offrent ce qui ne s'achète pas : le thème choisit la zone, la durée la rareté
--    (7 jours : graine rare, 30 jours : plante spéciale, 90 jours : arbre remarquable), la difficulté
--    la variante (au moins 4 fois par semaine, ou un défi expert). Un défi arrivé à son terme sans être
--    réussi donne une plante commune de sa zone.
-- 3. L'équipe : le migrateur de la semaine se pose chez chaque membre qui contribue au défi voté au
--    QG ; s'il est accueilli par assez d'îles, il arrive dans le carnet de toute l'équipe. Chacun peut
--    offrir un myosotis par jour à un collègue de son entreprise.
--
-- Les plantes obtenues ainsi se posent une fois, adultes (rare = true dans island_plants), autant
-- de fois qu'on en possède. Même catalogue que src/lib/game/catalog.ts.

create table if not exists public.island_catalog (
  key text primary key,
  -- null : pousse partout (myosotis) ; un visiteur n'est pas planté.
  zone text check (zone in ('foret', 'potager', 'plage', 'ruisseau')),
  kind text not null check (kind in ('boutique', 'signature', 'defi', 'cadeau', 'visiteur')),
  tier text not null,
  price integer check (price > 0),
  -- Plante signature : graines de la famille de la zone à avoir gagnées.
  unlock integer check (unlock > 0)
);
alter table public.island_catalog enable row level security;
drop policy if exists "catalogue : lisible" on public.island_catalog;
create policy "catalogue : lisible" on public.island_catalog for select to authenticated using (true);

insert into public.island_catalog (key, zone, kind, tier, price, unlock) values
  ('noisetier', 'foret', 'boutique', 'commune', 40, null),
  ('houx', 'foret', 'boutique', 'commune', 30, null),
  ('erable', 'foret', 'signature', 'signature', 100, 10),
  ('groseillier', 'potager', 'boutique', 'commune', 30, null),
  ('courge', 'potager', 'boutique', 'commune', 40, null),
  ('pommier', 'potager', 'signature', 'signature', 100, 10),
  ('oyat', 'plage', 'boutique', 'commune', 30, null),
  ('chardon', 'plage', 'boutique', 'commune', 40, null),
  ('pin_parasol', 'plage', 'signature', 'signature', 100, 5),
  ('roseau', 'ruisseau', 'boutique', 'commune', 30, null),
  ('iris', 'ruisseau', 'boutique', 'commune', 40, null),
  ('aulne', 'ruisseau', 'signature', 'signature', 100, 4),
  ('muguet', 'foret', 'defi', 'rare', null, null),
  ('merisier', 'foret', 'defi', 'speciale', null, null),
  ('merisier_fleurs', 'foret', 'defi', 'fleurie', null, null),
  ('hetre', 'foret', 'defi', 'remarquable', null, null),
  ('capucine', 'potager', 'defi', 'rare', null, null),
  ('figuier', 'potager', 'defi', 'speciale', null, null),
  ('figuier_fruits', 'potager', 'defi', 'fleurie', null, null),
  ('chataignier', 'potager', 'defi', 'remarquable', null, null),
  ('lys_sable', 'plage', 'defi', 'rare', null, null),
  ('tamaris', 'plage', 'defi', 'speciale', null, null),
  ('tamaris_fleurs', 'plage', 'defi', 'fleurie', null, null),
  ('chene_liege', 'plage', 'defi', 'remarquable', null, null),
  ('salicaire', 'ruisseau', 'defi', 'rare', null, null),
  ('saule_marsault', 'ruisseau', 'defi', 'speciale', null, null),
  ('saule_chatons', 'ruisseau', 'defi', 'fleurie', null, null),
  ('platane', 'ruisseau', 'defi', 'remarquable', null, null),
  ('myosotis', null, 'cadeau', 'amitie', null, null),
  ('cigogne', null, 'visiteur', 'visiteur', null, null),
  ('grue', null, 'visiteur', 'visiteur', null, null),
  ('hirondelles', null, 'visiteur', 'visiteur', null, null),
  ('oies', null, 'visiteur', 'visiteur', null, null)
on conflict (key) do update set zone = excluded.zone, kind = excluded.kind, tier = excluded.tier,
  price = excluded.price, unlock = excluded.unlock;

-- Ce que chacun possède : achats, récompenses de défis et d'équipe, cadeaux reçus.
create table if not exists public.island_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  item text not null references public.island_catalog,
  source text not null check (source in ('achat', 'defi', 'equipe', 'cadeau')),
  -- Une récompense n'est donnée qu'une fois par référence (défi, semaine d'équipe, cadeau du jour).
  ref text not null,
  cost integer not null default 0 check (cost >= 0),
  from_user uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, source, ref)
);
create index if not exists island_inventory_user on public.island_inventory (user_id, item);
create index if not exists island_inventory_from on public.island_inventory (from_user, created_at) where from_user is not null;
alter table public.island_inventory enable row level security;
drop policy if exists "inventaire : le mien" on public.island_inventory;
create policy "inventaire : le mien" on public.island_inventory
  for select to authenticated using (user_id = auth.uid());

-- La zone d'une espèce ou d'une plante du catalogue (null : elle pousse partout).
create or replace function public.island_species_zone(p_species text)
returns text
language sql stable set search_path = public
as $$
  select case
    when p_species in ('transport', 'nature') then 'foret'
    when p_species = 'alimentation' then 'potager'
    when p_species = 'consommation' then 'plage'
    when p_species = 'logement' then 'ruisseau'
    else (select zone from public.island_catalog where key = p_species)
  end;
$$;

create or replace function public.island_tile_fits(p_species text, p_x integer, p_z integer)
returns boolean
language sql stable set search_path = public
as $$
  select public.island_species_zone(p_species) is null
      or public.island_tile_zone(p_x, p_z) is null
      or public.island_species_zone(p_species) = public.island_tile_zone(p_x, p_z);
$$;

-- Les graines de la famille d'une zone gagnées par des actions (débloque ses plantes signature).
create or replace function public.island_zone_seeds(p_counts jsonb, p_zone text)
returns integer
language sql immutable set search_path = public
as $$
  select case p_zone
    when 'foret' then coalesce((p_counts->>'transport')::integer, 0) + coalesce((p_counts->>'nature')::integer, 0)
    when 'potager' then coalesce((p_counts->>'alimentation')::integer, 0)
    when 'plage' then coalesce((p_counts->>'consommation')::integer, 0)
    when 'ruisseau' then coalesce((p_counts->>'logement')::integer, 0)
    else 0
  end;
$$;

-- Pousses à dépenser : les pousses gagnées, moins les achats de la Graineterie.
create or replace function public.island_pousses(p_user uuid)
returns integer
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select greatest(0, public.member_points(p_user, null)
    - coalesce((select sum(cost) from public.island_inventory where user_id = p_user and source = 'achat'), 0))::integer;
$$;
revoke all on function public.island_pousses(uuid) from public;

-- La zone d'un thème de défi (catégorie du modèle).
create or replace function public.island_category_zone(p_category text)
returns text
language sql immutable set search_path = public
as $$
  select case p_category
    when 'alimentation' then 'potager'
    when 'consommation' then 'plage'
    when 'logement' then 'ruisseau'
    else 'foret'
  end;
$$;

-- Ce que rapporte un défi réussi : thème → zone, durée → rareté, difficulté → variante.
-- Même règle que challengeReward() dans src/lib/game/catalog.ts.
create or replace function public.island_challenge_reward(p_category text, p_days integer, p_target integer, p_level text)
returns text[]
language sql immutable set search_path = public
as $$
  with z as (select public.island_category_zone(p_category) as zone),
  k as (
    select zone,
           (p_level = 'expert' or p_target * 7 >= 4 * greatest(p_days, 1)) as costaud,
           case when p_days <= 13 then 'court' when p_days <= 59 then 'mois' else 'saison' end as duree
    from z
  ),
  items as (
    select zone,
      case zone when 'foret' then 'muguet' when 'potager' then 'capucine' when 'plage' then 'lys_sable' else 'salicaire' end as rare,
      case zone when 'foret' then 'merisier' when 'potager' then 'figuier' when 'plage' then 'tamaris' else 'saule_marsault' end as speciale,
      case zone when 'foret' then 'merisier_fleurs' when 'potager' then 'figuier_fruits' when 'plage' then 'tamaris_fleurs' else 'saule_chatons' end as fleurie,
      case zone when 'foret' then 'hetre' when 'potager' then 'chataignier' when 'plage' then 'chene_liege' else 'platane' end as remarquable,
      costaud, duree
    from k
  )
  select case
    when duree = 'court' then case when costaud then array[rare, rare] else array[rare] end
    when duree = 'mois' then array[case when costaud then fleurie else speciale end]
    else case when costaud then array[remarquable, fleurie] else array[remarquable] end
  end
  from items;
$$;

-- Consolation d'un défi arrivé à son terme sans être réussi : une plante commune de sa zone.
create or replace function public.island_consolation(p_category text)
returns text
language sql immutable set search_path = public
as $$
  select case public.island_category_zone(p_category)
    when 'foret' then 'houx' when 'potager' then 'groseillier' when 'plage' then 'oyat' else 'roseau' end;
$$;

-- Le migrateur d'une équipe pour une semaine : il change chaque semaine, se pose chez chaque membre
-- qui contribue au défi voté, et arrive chez tous si assez d'îles l'ont accueilli.
create or replace function public.island_migration(p_team uuid, p_week date)
returns jsonb
language plpgsql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  w public.team_weeks;
  members integer;
  needed integer;
  bird text := (array['cigogne', 'grue', 'hirondelles', 'oies'])[1 + (((p_week - date '2026-01-05') / 7) % 4 + 4) % 4];
  hosts jsonb;
begin
  select * into w from public.team_weeks where team_id = p_team and week_start = p_week;
  select count(*) into members from public.profiles where team_id = p_team;
  needed := case when members <= 2 then members else greatest(2, ceil(members * 0.6)::integer) end;
  if w.chosen is null then
    hosts := '[]'::jsonb;
  else
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name) order by p.display_name), '[]'::jsonb)
    into hosts
    from public.profiles p
    where p.team_id = p_team and public.team_kind_count(w.chosen, p_team, p.id, p_week, p_week + 6) > 0;
  end if;
  return jsonb_build_object(
    'bird', bird,
    'week', p_week,
    'kind', w.chosen,
    'members', members,
    'needed', needed,
    'hosts', hosts,
    'done', w.chosen is not null and members > 0 and jsonb_array_length(hosts) >= needed);
end;
$$;
revoke all on function public.island_migration(uuid, date) from public;

-- L'île de quelqu'un de mon entreprise, avec ce qu'elle possède encore à poser. Pour moi seulement :
-- le solde de pousses et les dernières récompenses reçues.
create or replace function public.island(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  g jsonb := public.garden(p_user);
  me boolean := p_user = auth.uid();
begin
  return g || jsonb_build_object(
    'counts', (g->'counts') || jsonb_build_object('cap', (select count(*) from public.habit_checkins where user_id = p_user)),
    'plants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'species', p.species, 'rare', p.rare, 'x', p.x, 'z', p.z, 'fed', p.fed,
        'planted_at', p.planted_at, 'grown_at', p.grown_at) order by p.planted_at)
      from public.island_plants p where p.user_id = p_user), '[]'::jsonb),
    -- Par plante du catalogue : possédées moins posées (les visiteurs ne se posent pas).
    'inventory', coalesce((
      select jsonb_object_agg(i.item, i.n - coalesce((select count(*) from public.island_plants p
                                                      where p.user_id = p_user and p.rare and p.species = i.item), 0))
      from (select item, count(*) as n from public.island_inventory where user_id = p_user group by item) i), '{}'::jsonb),
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

-- Planter : une graine gagnée par une action, une plante du catalogue possédée, ou une plante rare.
create or replace function public.island_plant(p_species text, p_x integer, p_z integer)
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me uuid := auth.uid();
  g jsonb;
  ex text;
  spent integer;
  item public.island_catalog;
  here public.island_plants;
begin
  if me is null or not exists (select 1 from public.profiles where id = me) then
    raise exception 'not_member';
  end if;
  if not public.island_tile_ok(p_x, p_z) then
    raise exception 'off_island';
  end if;
  -- Deux plantations simultanées ne doivent pas dépenser la même graine.
  perform pg_advisory_xact_lock(hashtext('island:' || me::text));

  g := public.island(me);
  select * into here from public.island_plants where user_id = me and x = p_x and z = p_z for update;
  select * into item from public.island_catalog where key = p_species;

  if g->'counts' ? p_species then
    select coalesce(sum(fed), 0) into spent from public.island_plants
    where user_id = me and species = p_species and not rare;
    if (g->'counts'->>p_species)::integer - spent <= 0 then
      raise exception 'no_seed';
    end if;
    if here.id is null then
      if not public.island_tile_fits(p_species, p_x, p_z) then
        raise exception 'wrong_zone';
      end if;
      insert into public.island_plants (user_id, species, x, z) values (me, p_species, p_x, p_z);
    elsif here.species = p_species and not here.rare then
      update public.island_plants set fed = fed + 1, grown_at = now() where id = here.id;
    else
      raise exception 'tile_taken';
    end if;
  elsif item.key is not null then
    if item.kind = 'visiteur' or coalesce((g->'inventory'->>p_species)::integer, 0) <= 0 then
      raise exception 'no_seed';
    end if;
    if here.id is not null then
      raise exception 'tile_taken';
    end if;
    if not public.island_tile_fits(p_species, p_x, p_z) then
      raise exception 'wrong_zone';
    end if;
    insert into public.island_plants (user_id, species, rare, x, z) values (me, p_species, true, p_x, p_z);
  else
    ex := public.island_rare_exploit(p_species);
    if not (coalesce((g->'exploits'->>ex)::boolean, false) or (ex is null and (g->'rares') ? p_species)) then
      raise exception 'no_seed';
    end if;
    if exists (select 1 from public.island_plants where user_id = me and species = p_species and rare) then
      raise exception 'already_planted';
    end if;
    if here.id is not null then
      raise exception 'tile_taken';
    end if;
    insert into public.island_plants (user_id, species, rare, x, z) values (me, p_species, true, p_x, p_z);
  end if;

  return public.island(me);
end;
$$;
revoke all on function public.island_plant(text, integer, integer) from public;
revoke execute on function public.island_plant(text, integer, integer) from anon;
grant execute on function public.island_plant(text, integer, integer) to authenticated;

-- Acheter une plante à la Graineterie.
create or replace function public.island_buy(p_item text)
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me uuid := auth.uid();
  item public.island_catalog;
begin
  if me is null or not exists (select 1 from public.profiles where id = me) then
    raise exception 'not_member';
  end if;
  select * into item from public.island_catalog where key = p_item;
  if item.key is null or item.kind not in ('boutique', 'signature') then
    raise exception 'not_for_sale';
  end if;
  -- Deux achats simultanés ne doivent pas dépenser les mêmes pousses.
  perform pg_advisory_xact_lock(hashtext('island:' || me::text));
  if item.kind = 'signature'
     and public.island_zone_seeds(public.island(me)->'counts', item.zone) < item.unlock then
    raise exception 'locked';
  end if;
  if public.island_pousses(me) < item.price then
    raise exception 'not_enough';
  end if;
  insert into public.island_inventory (user_id, item, source, ref, cost)
  values (me, item.key, 'achat', gen_random_uuid()::text, item.price);
  return public.island(me);
end;
$$;
revoke all on function public.island_buy(text) from public;
revoke execute on function public.island_buy(text) from anon;
grant execute on function public.island_buy(text) to authenticated;

-- Récupérer ce qui m'est dû : récompenses des défis réussis, consolation des défis terminés sans
-- succès (depuis 30 jours), migrateurs de mon équipe (cette semaine et la précédente).
-- Appelée à l'ouverture de l'île : rejouée, elle ne donne rien deux fois. Rend le nombre de nouveautés.
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
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;

  for c in
    select u.id, u.status, u.target, (u.ends_on - u.starts_on + 1) as days, t.category, t.level
    from public.user_challenges u join public.challenge_templates t on t.id = u.template_id
    where u.user_id = me.id
      and (u.status = 'done' or (u.status = 'active' and u.ends_on < current_date and u.ends_on >= current_date - 30))
  loop
    if c.status = 'done' then
      insert into public.island_inventory (user_id, item, source, ref)
      select me.id, r.item, 'defi', c.id::text || ':' || r.i
      from unnest(public.island_challenge_reward(c.category, c.days, c.target, c.level)) with ordinality as r(item, i)
      on conflict (user_id, source, ref) do nothing;
    else
      insert into public.island_inventory (user_id, item, source, ref)
      values (me.id, public.island_consolation(c.category), 'defi', c.id::text || ':consolation')
      on conflict (user_id, source, ref) do nothing;
    end if;
    get diagnostics n = row_count;
    added := added + n;
  end loop;

  if me.team_id is not null then
    foreach wk in array array[date_trunc('week', current_date)::date, date_trunc('week', current_date)::date - 7] loop
      m := public.island_migration(me.team_id, wk);
      if (m->>'done')::boolean then
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

-- Le jardin de mon équipe : le migrateur de la semaine, le bosquet (défis de la semaine réussis) et
-- les collègues à qui offrir un myosotis aujourd'hui.
create or replace function public.team_garden()
returns jsonb
language plpgsql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  wk date := date_trunc('week', current_date)::date;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;
  return jsonb_build_object(
    'migration', case when me.team_id is not null then public.island_migration(me.team_id, wk) end,
    'grove', case when me.team_id is null then 0 else (
      select count(*) from public.team_weeks w
      where w.team_id = me.team_id and w.chosen is not null and w.target is not null
        and public.team_kind_count(w.chosen, me.team_id, null, w.week_start, w.week_start + 6) >= w.target) end,
    'gifted_today', exists (select 1 from public.island_inventory
                            where from_user = me.id and source = 'cadeau' and created_at::date = current_date),
    'colleagues', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'team', p.team_id = me.team_id)
                       order by p.team_id = me.team_id desc, p.display_name)
      from public.profiles p where p.company_id = me.company_id and p.id <> me.id), '[]'::jsonb));
end;
$$;
revoke all on function public.team_garden() from public;
revoke execute on function public.team_garden() from anon;
grant execute on function public.team_garden() to authenticated;

-- Offrir un myosotis à un collègue de mon entreprise : un par jour.
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
    'Il t''attend dans tes graines : plante-le sur ton île. Trois myosotis attirent le rouge-gorge.', '/fil');
end;
$$;
revoke all on function public.island_gift(uuid) from public;
revoke execute on function public.island_gift(uuid) from anon;
grant execute on function public.island_gift(uuid) to authenticated;
