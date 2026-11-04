-- Scénario v2 (migration 0052) : le compteur du haut = pousses gagnées moins les plantes.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'ÉCHEC : %', label; end if;
  raise notice 'ok : %', label;
end $$;
set client_min_messages = notice;

-- Léa (scénario 0051) a dépensé 200 pousses sur son île.
select member_points('00000000-0000-0000-0000-000000000511', null) as gagnees \gset
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000511', false);
set role authenticated;
select pg_temp.check(my_pousses() = :gagnees - 200, 'il reste les pousses gagnées moins les plantes');
reset role;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.check(member_points('00000000-0000-0000-0000-000000000511', null) = :gagnees, 'le total gagné ne bouge pas');
