-- Contrôle des données de démo (supabase/seed_demo.sql) : volumes et agrégats utilisables par l'admin.
\set ON_ERROR_STOP 1
create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'ÉCHEC : %', label; end if;
  raise notice 'ok : %', label;
end $$;
create temp table demo_org as select id from companies where join_code = 'VERDURE-DEMO';
select pg_temp.check((select count(*) = 1 from demo_org), 'une seule organisation de démo (rejouable)');
select pg_temp.check((select count(*) = 30 from profiles where company_id = (select id from demo_org)), '30 salariés');
select pg_temp.check((select count(*) = 3 from teams where company_id = (select id from demo_org)), '3 équipes');
select pg_temp.check((select count(*) > 500 and min(day) >= current_date - 28 and max(day) < current_date
                      from validations where company_id = (select id from demo_org)), '4 semaines d''actions, datées du passé');
select pg_temp.check((select count(*) = 0 from validations where company_id = (select id from demo_org) and kg <> round(kg, 3)), 'CO₂ calculé par la base');
grant select on demo_org to public;
select set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000100', false);
set role authenticated;
select pg_temp.check((select (d->>'kg_total')::numeric > 0 and jsonb_array_length(d->'teams') = 3
                      from (select admin_dashboard((select company_id from my_admin_organizations() limit 1)) d) x),
                     'tableau de bord de l''admin de démo : totaux et classement');
reset role;
select set_config('request.jwt.claim.sub', '', false);
