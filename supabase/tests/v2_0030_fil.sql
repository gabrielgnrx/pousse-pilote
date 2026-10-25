-- Scénario v2 (migration 0030) : rien n'arrive dans le fil sans que la personne l'ait choisi.
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

-- Nora (scénario 0028) a des actions du jour, toutes privées.
select pg_temp.as_user('00000000-0000-0000-0000-000000000281');
create temp table mine as
  select id from validations where user_id = auth.uid() and day = current_date and visibility = 'private' order by created_at limit 2;

-- 1. Publier sans photo : visible, sans pousses en plus.
create temp table before1 as select points from validations where id = (select id from mine limit 1);
create temp table p1 as
  select * from publish_action((select id from mine limit 1), null, 'Premier trajet à vélo !');
select pg_temp.check((select visibility = 'company' and proof_photo_path is null and caption = 'Premier trajet à vélo !' from p1),
                     'publication sans photo : dans le fil, avec la légende');
select pg_temp.check((select p1.points = b.points from p1, before1 b), 'publication sans photo : pas de bonus');

-- 2. Publier avec photo : +5 pousses ; une photo hors de son dossier est refusée.
create temp table before2 as select points from validations where id = (select id from mine offset 1 limit 1);
select pg_temp.expect_error(format($$select publish_action(%L, 'quelqu-un-d-autre/photo.jpg')$$, (select id from mine offset 1 limit 1)),
                            '%invalid_photo%', 'photo hors de son dossier : refusée');
select publish_action((select id from mine offset 1 limit 1), auth.uid()::text || '/photo.jpg');
select pg_temp.check((select v.points = b.points + 5 from validations v, before2 b where v.id = (select id from mine offset 1 limit 1)),
                     'publication avec photo : +5 pousses');
select pg_temp.expect_error(format($$select publish_action(%L)$$, (select id from mine limit 1)),
                            '%nothing_to_publish%', 'déjà publiée : rien à publier');

-- 3. Un défi lancé n'apparaît pas dans le fil tant qu'il n'est pas partagé.
insert into user_challenges (user_id, company_id, template_id, variant, target, ends_on)
select auth.uid(), company_id, 'escaliers', 'base', 3, current_date + 7 from profiles where id = auth.uid();
create temp table ch as select id from user_challenges where user_id = auth.uid() and template_id = 'escaliers';
select pg_temp.check(not exists (select 1 from company_challenge_feed() f where f.id = (select id from ch)),
                     'défi lancé : pas dans le fil sans partage');
select share_challenge((select id from ch), 'lance');
select pg_temp.check(exists (select 1 from company_challenge_feed() f where f.id = (select id from ch) and f.event = 'lance'),
                     'défi partagé : dans le fil');
select pg_temp.expect_error(format($$select share_challenge(%L, 'reussi')$$, (select id from ch)),
                            '%nothing_to_share%', 'réussite partagée avant d''être réussie : refusée');
reset role;

-- 4. Un collègue ne peut pas partager le défi de quelqu'un d'autre.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.expect_error(format($$select share_challenge(%L, 'lance')$$, (select id from ch)),
                            '%nothing_to_share%', 'partager le défi d''un autre : refusé');
reset role;
select set_config('request.jwt.claim.sub', '', false);
