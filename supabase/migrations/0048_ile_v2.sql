-- L'île, deuxième version (audit du 1er novembre 2026).
--
-- 1. Une graine par action. garden() compte une action d'habitude (vélo d'un cycliste, repas végé
--    d'une personne déjà végétarienne…) deux fois : dans sa catégorie et dans « cap ». Pour l'île,
--    « cap » ne compte plus que les points d'étape (habit_checkins), qui ne sont pas des actions.
--    Le jardin à collectionner (garden) ne change pas.
-- 2. Déplacer une plante vers une case libre (elle garde ses graines), ou l'arracher : ses graines
--    reviennent dans le bac (une plante rare peut être reposée).

-- L'île de quelqu'un de mon entreprise. counts = graines gagnées par espèce (une par action).
create or replace function public.island(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  g jsonb := public.garden(p_user);
begin
  return g || jsonb_build_object(
    'counts', (g->'counts') || jsonb_build_object('cap', (select count(*) from public.habit_checkins where user_id = p_user)),
    'plants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'species', p.species, 'rare', p.rare, 'x', p.x, 'z', p.z, 'fed', p.fed,
        'planted_at', p.planted_at, 'grown_at', p.grown_at) order by p.planted_at)
      from public.island_plants p where p.user_id = p_user), '[]'::jsonb));
end;
$$;
revoke all on function public.island(uuid) from public;
revoke execute on function public.island(uuid) from anon;
grant execute on function public.island(uuid) to authenticated;

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

-- Déplacer une de mes plantes vers une case libre de l'île.
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
  update public.island_plants set x = p_to_x, z = p_to_z
  where user_id = me and x = p_from_x and z = p_from_z;
  if not found then
    raise exception 'no_plant';
  end if;
  return public.island(me);
end;
$$;
revoke all on function public.island_move(integer, integer, integer, integer) from public;
revoke execute on function public.island_move(integer, integer, integer, integer) from anon;
grant execute on function public.island_move(integer, integer, integer, integer) to authenticated;

-- Arracher une de mes plantes : ses graines reviennent dans le bac.
create or replace function public.island_uproot(p_x integer, p_z integer)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not exists (select 1 from public.profiles where id = me) then
    raise exception 'not_member';
  end if;
  perform pg_advisory_xact_lock(hashtext('island:' || me::text));
  delete from public.island_plants where user_id = me and x = p_x and z = p_z;
  if not found then
    raise exception 'no_plant';
  end if;
  return public.island(me);
end;
$$;
revoke all on function public.island_uproot(integer, integer) from public;
revoke execute on function public.island_uproot(integer, integer) from anon;
grant execute on function public.island_uproot(integer, integer) to authenticated;
