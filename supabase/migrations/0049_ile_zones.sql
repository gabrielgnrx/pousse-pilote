-- L'île en zones (restaurer l'île) : chaque famille d'actions fait revivre sa zone.
--
-- Une case appartient à la zone vers laquelle elle pointe depuis le centre, vue de trois quarts
-- (même calcul que zoneOfTile() dans src/lib/game/island.ts) : 9 cases par zone, la case centrale
-- accueille toutes les espèces. Trajets et nature → forêt, repas → potager, achats évités → plage,
-- maison → ruisseau ; les fleurs et les plantes rares poussent partout.
-- Les plantes déjà posées ailleurs restent où elles sont (on peut toujours les faire grandir).

create or replace function public.island_tile_zone(p_x integer, p_z integer)
returns text
language sql immutable set search_path = public
as $$
  select case
    when p_x = 0 and p_z = 0 then null
    else (
      select case
        when a >= -145 and a < -54 then 'foret'
        when a >= -54 and a < 35 then 'ruisseau'
        when a >= 35 and a < 125 then 'plage'
        else 'potager'
      end
      from (select degrees(atan2(((p_x + p_z) * 19)::float8 / 0.56, ((p_x - p_z) * 34)::float8)) as a) t)
  end;
$$;

create or replace function public.island_species_zone(p_species text)
returns text
language sql immutable set search_path = public
as $$
  select case
    when p_species in ('transport', 'nature') then 'foret'
    when p_species = 'alimentation' then 'potager'
    when p_species = 'consommation' then 'plage'
    when p_species = 'logement' then 'ruisseau'
  end;
$$;

create or replace function public.island_tile_fits(p_species text, p_x integer, p_z integer)
returns boolean
language sql immutable set search_path = public
as $$
  select public.island_species_zone(p_species) is null
      or public.island_tile_zone(p_x, p_z) is null
      or public.island_species_zone(p_species) = public.island_tile_zone(p_x, p_z);
$$;

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

  g := public.island(me);
  select * into here from public.island_plants where user_id = me and x = p_x and z = p_z for update;

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

create or replace function public.island_move(p_from_x integer, p_from_z integer, p_to_x integer, p_to_z integer)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not exists (select 1 from public.profiles where id = me) then
    raise exception 'not_member';
  end if;
  if not public.island_tile_ok(p_to_x, p_to_z) then
    raise exception 'off_island';
  end if;
  perform pg_advisory_xact_lock(hashtext('island:' || me::text));
  if exists (select 1 from public.island_plants where user_id = me and x = p_to_x and z = p_to_z) then
    raise exception 'tile_taken';
  end if;
  if not exists (select 1 from public.island_plants where user_id = me and x = p_from_x and z = p_from_z) then
    raise exception 'no_plant';
  end if;
  if not public.island_tile_fits((select species from public.island_plants where user_id = me and x = p_from_x and z = p_from_z), p_to_x, p_to_z) then
    raise exception 'wrong_zone';
  end if;
  update public.island_plants set x = p_to_x, z = p_to_z
  where user_id = me and x = p_from_x and z = p_from_z;
  return public.island(me);
end;
$$;
revoke all on function public.island_move(integer, integer, integer, integer) from public;
revoke execute on function public.island_move(integer, integer, integer, integer) from anon;
grant execute on function public.island_move(integer, integer, integer, integer) to authenticated;
