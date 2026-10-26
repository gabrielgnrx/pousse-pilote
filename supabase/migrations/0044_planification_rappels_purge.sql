-- 0044 — Rappels et purge planifiés par la base, à appliquer sur Supabase seulement (pg_cron, pg_net, Vault).
--   Plus aucun secret à copier dans Vercel pour ces tâches : chaque clé est créée ici, son texte clair
--   reste dans Vault et seule son empreinte est dans cron_keys.
--   - pousse-rappels : chaque jour à 16 h UTC, /api/cron/rappels (clé « rappels », vérifiée par reminders_due) ;
--   - pousse-purge : chaque nuit à 3 h 17 UTC, l'Edge Function purge-photos (clé « purge »), qui efface
--     justificatifs (30 jours) et photos du fil (90 jours) avec la clé de service fournie par Supabase.

do $$
declare
  k record;
  token text;
begin
  for k in select * from (values ('rappels', 'pousse_rappels'), ('purge', 'pousse_purge')) as x(name, secret) loop
    if not exists (select 1 from vault.secrets where name = k.secret) then
      token := encode(extensions.gen_random_bytes(32), 'hex');
      perform vault.create_secret(token, k.secret, 'Clé de la tâche planifiée ' || k.name);
      insert into public.cron_keys (name, sha256)
      values (k.name, encode(sha256(convert_to(token, 'UTF8')), 'hex'))
      on conflict (name) do update set sha256 = excluded.sha256;
    end if;
  end loop;
end;
$$;

-- L'Edge Function vérifie sa clé avec la clé de service.
grant execute on function public.cron_key_named(text, text) to service_role;

select cron.unschedule(jobid) from cron.job where jobname in ('pousse-rappels', 'pousse-purge');
select cron.schedule('pousse-rappels', '0 16 * * *', $job$
  select net.http_get(
    url := 'https://pousse-pilote.vercel.app/api/cron/rappels',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (
      select decrypted_secret from vault.decrypted_secrets where name = 'pousse_rappels')),
    timeout_milliseconds := 60000);
$job$);
select cron.schedule('pousse-purge', '17 3 * * *', $job$
  select net.http_post(
    url := 'https://sdhzokntcxaezuebfocz.supabase.co/functions/v1/purge-photos',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (
      select decrypted_secret from vault.decrypted_secrets where name = 'pousse_purge')),
    timeout_milliseconds := 60000);
$job$);
