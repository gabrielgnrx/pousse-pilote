-- Le compteur du haut montre les pousses qu'il me reste à dépenser (et plus le total gagné) :
-- gagnées moins ce que coûtent mes plantes (island_pousses, 0051_ile_serre.sql). Le niveau et le
-- classement comptent toujours les pousses gagnées.
create or replace function public.my_pousses()
returns integer
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select public.island_pousses(auth.uid());
$$;
revoke all on function public.my_pousses() from public;
revoke execute on function public.my_pousses() from anon;
grant execute on function public.my_pousses() to authenticated;
