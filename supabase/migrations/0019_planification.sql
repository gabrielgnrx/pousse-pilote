-- Pousse · planification dans Supabase (pg_cron + pg_net + Vault), à appliquer sur Supabase seulement.
--   Toutes les 5 minutes : tick() règle les duels et le défi de la semaine et prépare les alertes,
--   puis la base appelle /api/cron/notifier, qui envoie les notifications push.
--   La clé de cet appel est créée ici et ne sort jamais de la base : son texte clair est dans Vault,
--   son empreinte dans cron_keys (vérifiée par alerts_due / alerts_pushed).

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
declare
  token text;
begin
  if not exists (select 1 from vault.secrets where name = 'pousse_notifier') then
    token := encode(extensions.gen_random_bytes(32), 'hex');
    perform vault.create_secret(token, 'pousse_notifier', 'Clé de /api/cron/notifier');
    insert into public.cron_keys (name, sha256)
    values ('notifier', encode(sha256(convert_to(token, 'UTF8')), 'hex'))
    on conflict (name) do update set sha256 = excluded.sha256;
  end if;
end;
$$;

select cron.unschedule(jobid) from cron.job where jobname = 'pousse-tick';
select cron.schedule('pousse-tick', '*/5 * * * *', $job$
  select public.tick();
  select net.http_get(
    url := 'https://pousse-pilote.vercel.app/api/cron/notifier',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (
      select decrypted_secret from vault.decrypted_secrets where name = 'pousse_notifier')),
    timeout_milliseconds := 20000);
$job$);
