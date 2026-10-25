-- 0037 — Génération du quiz de la semaine, à appliquer sur Supabase seulement (pg_cron, pg_net, Vault).
--   Le lundi à 5 h 07 UTC (6 h 07 à Paris en hiver, 7 h 07 en été), la base appelle /api/cron/quiz avec
--   la clé « ia » (créée en 0032). Une semaine déjà remplie n'est pas regénérée.

select cron.unschedule(jobid) from cron.job where jobname = 'pousse-quiz';
select cron.schedule('pousse-quiz', '7 5 * * 1', $job$
  select net.http_get(
    url := 'https://pousse-pilote.vercel.app/api/cron/quiz',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (
      select decrypted_secret from vault.decrypted_secrets where name = 'pousse_ia')),
    timeout_milliseconds := 120000);
$job$);
