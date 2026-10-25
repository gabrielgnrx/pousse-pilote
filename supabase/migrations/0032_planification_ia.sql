-- 0032 — Tâches planifiées de l'IA (Mon plan, puis l'animateur), à appliquer sur Supabase seulement.
--   La clé « ia » est créée ici et ne sort jamais de la base : son texte clair est dans Vault, son
--   empreinte dans cron_keys (vérifiée par plan_pending, save_plan_for, ai_log).
--   Le lundi matin, toutes les 10 minutes, la base appelle /api/cron/plan :
--   chaque appel traite un lot de personnes sans plan pour la semaine, jusqu'à épuisement.

do $$
declare
  token text;
begin
  if not exists (select 1 from vault.secrets where name = 'pousse_ia') then
    token := encode(extensions.gen_random_bytes(32), 'hex');
    perform vault.create_secret(token, 'pousse_ia', 'Clé des tâches IA planifiées');
    insert into public.cron_keys (name, sha256)
    values ('ia', encode(sha256(convert_to(token, 'UTF8')), 'hex'))
    on conflict (name) do update set sha256 = excluded.sha256;
  end if;
end;
$$;

-- pg_cron tourne en UTC : de 2 h à 6 h 50 UTC, soit 3 h – 7 h 50 en hiver et 4 h – 8 h 50 en été (Paris).
select cron.unschedule(jobid) from cron.job where jobname = 'pousse-plan';
select cron.schedule('pousse-plan', '*/10 2-6 * * 1', $job$
  select net.http_get(
    url := 'https://pousse-pilote.vercel.app/api/cron/plan',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (
      select decrypted_secret from vault.decrypted_secrets where name = 'pousse_ia')),
    timeout_milliseconds := 60000);
$job$);
