-- L'île : le jardin devient un lieu en 3D.
--
-- Chaque action déjà comptée par garden() donne une graine de l'espèce correspondante. Planter une graine
-- sur un emplacement libre crée une plante ; la planter sur une plante de la même espèce la fait grandir
-- (mêmes stades que le jardin : 1, 5, 15 et 40 graines). Une plante rare obtenue se pose une fois, adulte.
--
-- Le jeu ne crée ni pousses ni CO₂ : il dépense seulement des graines gagnées par de vraies actions.
-- Les écritures passent toutes par island_plant() ; la lecture est ouverte aux collègues (visite d'île).

create table if not exists public.island_plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  species text not null,
  rare boolean not null default false,
  x smallint not null,
  z smallint not null,
  fed integer not null default 1 check (fed >= 1),
  planted_at timestamptz not null default now(),
  grown_at timestamptz not null default now(),
  unique (user_id, x, z)
);
create index if not exists island_plants_user_species on public.island_plants (user_id, species);

alter table public.island_plants enable row level security;
drop policy if exists "île : celles de mon entreprise" on public.island_plants;
create policy "île : celles de mon entreprise" on public.island_plants
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = island_plants.user_id and p.company_id = public.my_company_id()));

-- L'île est un disque d'emplacements : x² + z² ≤ 10, soit 37 emplacements (même règle que lib/game/island.ts).
create or replace function public.island_tile_ok(p_x integer, p_z integer)
returns boolean
language sql immutable
as $$
  select p_x between -3 and 3 and p_z between -3 and 3 and p_x * p_x + p_z * p_z <= 10;
$$;

-- Les plantes rares et l'exploit qui les débloque (null : graine mystère, voir garden_rares).
create or replace function public.island_rare_exploit(p_species text)
returns text
language sql immutable
as $$
  select case p_species
    when 'chene' then 'serie30'
    when 'sequoia' then 'expert'
    when 'baobab' then 'collectif'
    when 'rosier' then 'duel'
    when 'saule' then 'inspire'
  end;
$$;

-- L'île de quelqu'un de mon entreprise : son jardin (compteurs, exploits, rares) et ses plantes posées.
create or replace function public.island(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
begin
  return public.garden(p_user) || jsonb_build_object(
    'plants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'species', p.species, 'rare', p.rare, 'x', p.x, 'z', p.z, 'fed', p.fed,
        'planted_at', p.planted_at, 'grown_at', p.grown_at) order by p.planted_at)
      from public.island_plants p where p.user_id = p_user), '[]'::jsonb));
end;
$$;
revoke all on function public.island(uuid) from public;
grant execute on function public.island(uuid) to authenticated;

-- Planter une graine en (x, z) : nouvelle plante sur un emplacement libre, ou une graine de plus pour la
-- plante de la même espèce qui y pousse déjà.
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

  g := public.garden(me);
  select * into here from public.island_plants where user_id = me and x = p_x and z = p_z for update;

  if g->'counts' ? p_species then
    select coalesce(sum(fed), 0) into spent from public.island_plants
    where user_id = me and species = p_species and not rare;
    if (g->'counts'->>p_species)::integer - spent <= 0 then
      raise exception 'no_seed';
    end if;
    if here.id is null then
      insert into public.island_plants (user_id, species, x, z) values (me, p_species, p_x, p_z);
    elsif here.species = p_species and not here.rare then
      update public.island_plants set fed = fed + 1, grown_at = now() where id = here.id;
    else
      raise exception 'tile_taken';
    end if;
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
grant execute on function public.island_plant(text, integer, integer) to authenticated;
