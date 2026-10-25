-- 0035 — Planification de l'animateur du QG, à appliquer sur Supabase seulement (pg_cron, pg_net, Vault).
--   Toutes les 10 minutes, du lundi au vendredi, de 7 h à 18 h 50 UTC (8 h à 20 h 50 à Paris en hiver),
--   la base appelle /api/cron/animateur avec la clé « ia » (créée en 0032). animator_due décide de ce
--   qui est dû ; animator_post refuse les doublons et applique la limite d'un message spontané par jour.

select cron.unschedule(jobid) from cron.job where jobname = 'pousse-animateur';
select cron.schedule('pousse-animateur', '*/10 7-18 * * 1-5', $job$
  select net.http_get(
    url := 'https://pousse-pilote.vercel.app/api/cron/animateur',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (
      select decrypted_secret from vault.decrypted_secrets where name = 'pousse_ia')),
    timeout_milliseconds := 60000);
$job$);
