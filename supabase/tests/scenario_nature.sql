-- Scénario « télétravail, eau du robinet, nature » (migration 0017), à jouer en dernier.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
create function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;
create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'ÉCHEC : %', label; end if;
  raise notice 'ok : %', label;
end $$;
create function pg_temp.expect_error(stmt text, expected text, label text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'ÉCHEC : % (aucune erreur)', label;
exception when others then
  if sqlerrm not like expected then raise; end if;
  raise notice 'ok : %', label;
end $$;
set client_min_messages = notice;

-- Personne 3 : 10 km seule en voiture thermique, pas d'eau en bouteille. On repart d'une journée vierge.
delete from validations where user_id = '00000000-0000-0000-0000-000000000003' and day = current_date;

-- 1. Télétravail : l'aller-retour évité, exclusif des trajets du jour.
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.check((r->>'kg')::numeric = 2.212, 'télétravail : 2 × 10 km × 0,1106') from log_action('teletravail') r;
select pg_temp.expect_error($$select log_action('velo')$$, '%teletravail_conflict%', 'pas de vélo un jour de télétravail');
select pg_temp.expect_error($$select log_action('teletravail')$$, '%cap_reached%', 'un jour de télétravail par jour');
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select pg_temp.expect_error($$select log_action('teletravail')$$, '%teletravail_conflict%', 'pas de télétravail après un trajet à vélo le même jour');

-- 2. Eau du robinet : seulement si de l'eau en bouteille est déclarée.
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.check((r->>'kg')::numeric = 0 and (r->>'points')::int = 5, 'eau du robinet sans bouteille déclarée : 0 kg, des pousses')
from log_action('eau_robinet') r;
reset role;
update habits set bottled_water_l_day = 1.5 where user_id = '00000000-0000-0000-0000-000000000005';
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.check((r->>'kg')::numeric = 0.48, 'eau du robinet : 1,5 L × 0,32 kg') from log_action('eau_robinet') r;

-- 3. Nature : 0 kg, des pousses, une fois par jour ; le jardin et le défi d'équipe les comptent.
select pg_temp.check((r->>'kg')::numeric = 0 and (r->>'points')::int = 5, 'ramassage : 0 kg, 5 pousses') from log_action('ramassage') r;
select pg_temp.expect_error($$select log_action('ramassage')$$, '%cap_reached%', 'une fois par jour');
select pg_temp.check((r->>'points')::int = 3, 'compost : 3 pousses') from log_action('compost') r;
select pg_temp.check((garden('00000000-0000-0000-0000-000000000005') -> 'counts' ->> 'nature')::int = 2, 'le jardin compte les gestes nature');
reset role;
select pg_temp.check(team_kind_count('nature', (select team_id from profiles where id = '00000000-0000-0000-0000-000000000005'),
                                     null, current_date, current_date) >= 2, 'le défi d''équipe « nature » les compte');
select pg_temp.check(team_kind_per_member('nature') = 1, 'défi d''équipe nature : 1 par membre');
