-- Données de démonstration v2 : une organisation fictive, 3 équipes, 30 salariés, 4 semaines d'actions.
--
-- Sert à essayer l'animateur du QG, le tableau de bord RSE et le rapport mensuel avec des volumes
-- réalistes. À jouer à la main, après les migrations, sur une base de démo (jamais en production) :
--   psql "$DATABASE_URL" -f supabase/seed_demo.sql
-- Rejouable : si l'organisation existe déjà, rien n'est refait.
--
-- Les actions passent par log_action_slug, comme dans l'application : le CO₂, les plafonds et les
-- pousses sont calculés par la base, aucun chiffre n'est écrit ici. Chaque action est ensuite datée du
-- jour simulé (les plafonds du jour s'appliquent donc à chaque jour séparément). Tirages déterministes.
--
-- Comptes : rse@verdure-demo.fr (admin RSE, sans profil participant) et prenom@verdure-demo.fr.
-- Connexion par lien magique (en local, la boîte de réception de Supabase).

\set ON_ERROR_STOP 1

do $seed$
declare
  org uuid;
  team_ids uuid[];
  names text[] := array[
    'Camille', 'Hugo', 'Inès', 'Lucas', 'Manon', 'Nathan', 'Chloé', 'Théo', 'Sarah', 'Yanis',
    'Jade', 'Louis', 'Lina', 'Adam', 'Emma', 'Rayan', 'Zoé', 'Jules', 'Léna', 'Mathis',
    'Alice', 'Noah', 'Clara', 'Malo', 'Anaïs', 'Sacha', 'Eva', 'Tom', 'Nina', 'Samuel'];
  modes text[] := array['voiture_seul', 'transports_en_commun', 'transports_en_commun', 'voiture_seul', 'velo',
                        'transports_en_commun', 'voiture_electrique', 'transports_en_commun', 'marche_teletravail', 'covoiturage'];
  admin_id uuid := 'd0000000-0000-4000-8000-000000000100';
  uid uuid;
  i integer;
  d date;
  activity numeric;
  mode text;
  km numeric;
  beef integer;
  r jsonb;
  vid uuid;
  slug text;
  qty numeric;
  t0 date := current_date - 28;
  chat text[] := array[
    'Je suis venu à vélo ce matin, la piste le long du canal est vraiment agréable.',
    'Bravo l''équipe, on remonte au classement cette semaine !',
    'Quelqu''un a une bonne recette végé pour la semaine ? Je cherche des idées de plats.',
    'J''ai testé le déjeuner végé de la cantine, super bon, je recommande le curry.',
    'Merci pour l''astuce de l''appli anti-gaspi, j''ai récupéré un panier hier soir.',
    'Télétravail aujourd''hui, ça fait toujours un aller-retour en moins.',
    'Je vote pour le défi vélo, la météo a l''air sympa jeudi.',
    'Ma gourde est devenue un réflexe, plus de bouteilles en plastique au bureau.',
    'Content d''avoir fait réparer mon téléphone au lieu d''en racheter un.',
    'Facile finalement de prendre le RER plutôt que la voiture, je lis pendant le trajet.',
    'On se fait un déjeuner végé tous ensemble vendredi ?',
    'Fier de notre série, on tient bon depuis trois semaines.'];
  week integer;
  m integer;
begin
  if exists (select 1 from public.companies where join_code = 'VERDURE-DEMO') then
    raise notice 'Organisation de démo déjà présente : rien n''est refait.';
    return;
  end if;
  perform setseed(0.42);

  insert into public.companies (name, join_code, email_domain)
  values ('Verdure Conseil (démo)', 'VERDURE-DEMO', null)
  returning id into org;
  with t as (
    insert into public.teams (company_id, name)
    select org, x from unnest(array['Data', 'Conseil', 'Ops']) x
    returning id, name
  )
  select array_agg(id order by name) into team_ids from t;

  -- L'admin RSE : un compte, sans profil participant.
  insert into auth.users (id, email) values (admin_id, 'rse@verdure-demo.fr') on conflict (id) do nothing;
  insert into public.organization_admins (company_id, user_id) values (org, admin_id) on conflict do nothing;

  -- 30 salariés, 10 par équipe, chacun avec son bilan.
  for i in 1..30 loop
    uid := ('d0000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;
    insert into auth.users (id, email)
    values (uid, lower(public.unaccent_fr(names[i])) || '@verdure-demo.fr') on conflict (id) do nothing;
    perform set_config('request.jwt.claim.sub', uid::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    perform public.join_company('VERDURE-DEMO', team_ids[1 + (i - 1) % 3], names[i], true, i % 7 <> 0);
    perform set_config('role', 'none', true);
    -- Le bilan est écrit par le script (sans session) : le verrou anti-triche ne vise que les sessions.
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claims', '', true);

    mode := modes[1 + (i - 1) % 10];
    km := case mode when 'marche_teletravail' then 2 when 'velo' then 6 else 8 + (i * 7) % 25 end;
    beef := (i * 3) % 5;
    insert into public.habits (user_id, commute_mode, commute_km, commute_days, beef_meals_week, other_meat_meals_week,
                               short_flights_year, long_flights_year, new_clothes_year, buys_new_phone, heating, heating_kg_year)
    values (uid, mode, km, 3 + i % 3, beef, 3 + i % 4, i % 3, (i % 5 = 0)::int, 8 + i % 15, i % 4 = 0,
            case when i % 3 = 0 then 'electricite' else 'gaz' end, case when i % 3 = 0 then 300 else 1200 + (i * 37) % 900 end);
    update public.profiles set share_feed = true, feed_choice_at = now() where id = uid and i % 4 <> 0;
  end loop;

  -- 4 semaines d'actions : chacun a son rythme (quelques personnes décrochent, d'autres s'y mettent).
  for i in 1..30 loop
    uid := ('d0000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;
    select commute_mode, commute_km, beef_meals_week into mode, km, beef from public.habits where user_id = uid;
    activity := case when i % 10 = 0 then 0.15 when i % 6 = 0 then 0.35 else 0.55 + (i % 4) * 0.1 end;
    perform set_config('request.jwt.claim.sub', uid::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);

    for d in select g::date from generate_series(t0, current_date - 1, interval '1 day') g loop
      -- Décrochage en fin de période pour un tiers des inactifs, montée en charge pour d'autres.
      continue when random() > activity * case when i % 6 = 0 and d > current_date - 10 then 0.3
                                               when i % 5 = 1 and d < t0 + 7 then 0.5 else 1 end;
      foreach slug in array (
        case when extract(isodow from d) >= 6 then array['vege_boeuf', 'antigaspi', 'occasion_tshirt', 'chauffage']
             else array['trajet', 'trajet', 'vege', 'eau_robinet', 'gourde', 'escaliers', 'teletravail', 'appli_antigaspi', 'chauffage']
        end) loop
        continue when random() > 0.45;
        qty := null;
        if slug = 'trajet' then
          slug := case when mode = 'voiture_seul' then (array['velo', 'transports', 'covoiturage'])[1 + floor(random() * 3)::int]
                       when mode = 'voiture_electrique' then 'velo'
                       when mode = 'covoiturage' then 'transports'
                       else null end;
          continue when slug is null;
          qty := km;
        elsif slug = 'vege' then
          slug := case when beef > 0 then 'vege_boeuf' else 'vege_autre' end;
          qty := 1;
        elsif slug = 'vege_boeuf' then
          slug := case when beef > 0 then 'vege_boeuf' else 'vege_autre' end;
          qty := 1;
        elsif slug = 'teletravail' then
          continue when mode in ('marche_teletravail', 'velo');
        elsif slug = 'occasion_tshirt' then
          continue when random() > 0.3;
          qty := 1;
        elsif slug = 'chauffage' then
          continue when extract(isodow from d) <> 1;
        end if;

        begin
          perform set_config('role', 'authenticated', true);
          r := public.log_action_slug(slug, qty);
          vid := (r->>'id')::uuid;
          -- Une action sur six est publiée dans le fil, toujours par choix (jamais automatiquement).
          if vid is not null and i % 4 <> 0 and random() < 0.17 then
            perform public.publish_action(vid, null, null);
          end if;
          perform set_config('role', 'none', true);
          if vid is not null then
            update public.validations
               set day = d, created_at = d + time '08:00' + (random() * interval '10 hours')
             where id = vid;
          end if;
        exception when others then
          -- Plafond atteint ou action non pertinente pour ce bilan : comme dans l'application, elle est refusée.
          perform set_config('role', 'none', true);
        end;
      end loop;
    end loop;
  end loop;

  -- Les défis créés au fil des actions prennent les dates de leurs actions.
  update public.user_challenges c
     set starts_on = x.first_day, ends_on = greatest(c.ends_on - (current_date - x.last_day), x.last_day),
         created_at = x.first_day + time '08:00'
    from (select challenge_id, min(day) as first_day, max(day) as last_day from public.validations
          where company_id = org group by challenge_id) x
   where c.id = x.challenge_id and c.company_id = org and c.starts_on > x.first_day;

  -- Le chat des QG : quelques messages publics par semaine et par équipe.
  for week in 0..3 loop
    for i in 1..30 loop
      continue when random() > 0.22;
      uid := ('d0000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;
      m := 1 + floor(random() * array_length(chat, 1))::int;
      insert into public.team_messages (company_id, team_id, user_id, body, created_at)
      values (org, team_ids[1 + (i - 1) % 3], uid, chat[m],
              t0 + week * 7 + floor(random() * 5)::int + time '09:00' + (random() * interval '8 hours'));
    end loop;
  end loop;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  raise notice 'Organisation de démo créée : % actions, % messages.',
    (select count(*) from public.validations where company_id = org),
    (select count(*) from public.team_messages where company_id = org);
end;
$seed$;
