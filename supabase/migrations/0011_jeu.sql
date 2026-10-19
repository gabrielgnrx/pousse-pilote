-- Pousse · plus de jeu
--   1. Défi collectif de la semaine : un objectif commun à toute l'entreprise, +30 pour chaque contributeur.
--   2. Duels entre collègues : même action, 7 jours, preuves obligatoires. Personne ne perd de pousses.
--   3. Jardin à collectionner : calculé à partir de ce que chacun a fait (fonction garden).
--   4. Graine mystère : gagnée en finissant les quêtes du jour, elle révèle un bonus ou une plante rare.
--   5. Quiz du jour : une question par jour, la même pour toute l'entreprise, +5 si c'est juste.

alter table public.points_ledger drop constraint if exists points_ledger_kind_check;
alter table public.points_ledger add constraint points_ledger_kind_check
  check (kind in ('maintien', 'influence', 'temoin', 'quete', 'serie', 'scan', 'collectif', 'duel', 'graine', 'quiz'));

-- 5. Quiz du jour ------------------------------------------------------------------------------

create table if not exists public.quiz_questions (
  id integer primary key,
  question text not null,
  choices text[] not null check (array_length(choices, 1) between 2 and 4),
  answer smallint not null,
  explanation text not null,
  check (answer >= 0 and answer < array_length(choices, 1))
);
-- Personne ne lit la table directement (la bonne réponse y est) : tout passe par today_quiz().
alter table public.quiz_questions enable row level security;

create table if not exists public.quiz_answers (
  user_id uuid not null references public.profiles on delete cascade,
  day date not null,
  question_id integer not null references public.quiz_questions,
  choice smallint not null,
  correct boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.quiz_answers enable row level security;
drop policy if exists "quiz: mes réponses" on public.quiz_answers;
create policy "quiz: mes réponses" on public.quiz_answers
  for select to authenticated using (user_id = auth.uid());

-- La question du jour : la même pour tout le monde, elles tournent dans l'ordre.
create or replace function public.quiz_of_day(d date)
returns integer
language sql stable security definer set search_path = public
as $$
  select id from public.quiz_questions order by id
  offset ((d - date '2026-01-01') % greatest((select count(*) from public.quiz_questions), 1))
  limit 1
$$;
revoke all on function public.quiz_of_day(date) from public;

-- La question (sans la réponse tant qu'on n'a pas répondu), puis la correction et le score des collègues.
create or replace function public.today_quiz()
returns jsonb
language plpgsql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  q public.quiz_questions;
  a public.quiz_answers;
  total integer;
  good integer;
begin
  if auth.uid() is null then
    return null;
  end if;
  select * into q from public.quiz_questions where id = public.quiz_of_day(current_date);
  if not found then
    return null;
  end if;
  select * into a from public.quiz_answers where user_id = auth.uid() and day = current_date;
  if not found then
    return jsonb_build_object('id', q.id, 'question', q.question, 'choices', to_jsonb(q.choices), 'answered', false);
  end if;
  select count(*), count(*) filter (where qa.correct) into total, good
  from public.quiz_answers qa join public.profiles p on p.id = qa.user_id
  where p.company_id = public.my_company_id() and qa.day = current_date;
  return jsonb_build_object(
    'id', q.id, 'question', q.question, 'choices', to_jsonb(q.choices), 'answered', true,
    'choice', a.choice, 'answer', q.answer, 'correct', a.correct, 'explanation', q.explanation,
    'answers', total, 'good', good);
end;
$$;
revoke all on function public.today_quiz() from public;
grant execute on function public.today_quiz() to authenticated;

create or replace function public.answer_quiz(p_choice integer)
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  q public.quiz_questions;
  ok boolean;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;
  select * into q from public.quiz_questions where id = public.quiz_of_day(current_date);
  if not found then
    raise exception 'no_quiz';
  end if;
  if p_choice is null or p_choice < 0 or p_choice >= array_length(q.choices, 1) then
    raise exception 'invalid_choice';
  end if;
  ok := p_choice = q.answer;
  insert into public.quiz_answers (user_id, day, question_id, choice, correct)
  values (me.id, current_date, q.id, p_choice, ok)
  on conflict (user_id, day) do nothing;
  if not found then
    raise exception 'already_answered';
  end if;
  if ok then
    insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
    values (me.id, me.company_id, 'quiz', 5, md5(me.id::text || ':quiz:' || current_date)::uuid)
    on conflict (user_id, kind, ref_id) do nothing;
  end if;
  return public.today_quiz();
end;
$$;
revoke all on function public.answer_quiz(integer) from public;
grant execute on function public.answer_quiz(integer) to authenticated;

-- Le quiz compte pour la série.
create or replace function public.active_days(p_user uuid)
returns setof date
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select v.day from public.validations v where v.user_id = p_user and v.status = 'valid'
  union
  select k.created_at::date from public.habit_checkins k where k.user_id = p_user
  union
  select c.created_at::date from public.cheers c where c.user_id = p_user
  union
  select s.created_at::date from public.product_swaps s where s.user_id = p_user
  union
  select s.created_at::date from public.product_scans s where s.user_id = p_user
  union
  select q.day from public.quiz_answers q where q.user_id = p_user
$$;
revoke all on function public.active_days(uuid) from public;

-- Questions (chiffres cohérents avec ceux de l'application : ADEME, Base Empreinte, SDES, Météo-France).
insert into public.quiz_questions (id, question, choices, answer, explanation) values
(1, 'Un repas avec du bœuf émet environ combien de fois plus qu''un repas végétarien ?',
 array['2 fois plus', '6 fois plus', '20 fois plus', '100 fois plus'], 1,
 'Environ 5 kg de CO₂e pour un repas avec bœuf, contre 0,85 kg pour un repas végétarien (ADEME). C''est le geste alimentaire le plus efficace.'),
(2, 'Pour un Paris–Marseille, le TGV émet combien de fois moins que l''avion, par passager ?',
 array['2 fois moins', '10 fois moins', 'Près de 100 fois moins', 'Autant'], 2,
 'Environ 2 g de CO₂e par km en TGV contre plus de 200 g en avion court-courrier (ADEME). L''électricité française est très peu carbonée.'),
(3, 'Quelle est l''empreinte carbone moyenne d''un Français par an ?',
 array['Environ 2 tonnes', 'Environ 9 tonnes', 'Environ 20 tonnes', 'Environ 50 tonnes'], 1,
 'Environ 9 tonnes de CO₂e par personne et par an, importations comprises (SDES). L''objectif pour 2050 est autour de 2 tonnes.'),
(4, 'Quel est le premier secteur émetteur de gaz à effet de serre en France ?',
 array['L''industrie', 'Les transports', 'Le numérique', 'Les déchets'], 1,
 'Les transports représentent environ un tiers des émissions du territoire, surtout à cause de la voiture (Citepa).'),
(5, 'Dans l''empreinte carbone du numérique en France, quelle part vient de la fabrication des appareils ?',
 array['Environ 10 %', 'Environ 30 %', 'Environ 50 %', 'Près de 80 %'], 3,
 'La fabrication des terminaux (téléphones, ordinateurs, écrans) pèse près de 80 % (ADEME-Arcep). Garder son téléphone plus longtemps est le meilleur geste.'),
(6, 'Baisser le chauffage de 1 °C réduit la consommation de chauffage d''environ…',
 array['1 %', '7 %', '25 %', '50 %'], 1,
 'Environ 7 % d''énergie économisée par degré en moins (ADEME). 19 °C dans les pièces à vivre suffit le plus souvent.'),
(7, 'Quelle part de la nourriture produite dans le monde est perdue ou gaspillée ?',
 array['Environ 5 %', 'Environ un tiers', 'Environ deux tiers', 'Presque rien'], 1,
 'Près d''un tiers de la nourriture produite est perdue ou gaspillée (FAO), avec toutes les émissions de sa production.'),
(8, 'Un aller-retour Paris–New York en avion émet par passager environ…',
 array['100 kg de CO₂e', '500 kg de CO₂e', '1,5 tonne de CO₂e', '10 tonnes de CO₂e'], 2,
 'Environ 1,5 à 2 tonnes, traînées comprises (ADEME) : près d''une année de budget carbone compatible avec l''Accord de Paris.'),
(9, 'Le méthane réchauffe la planète combien de fois plus que le CO₂, sur 100 ans ?',
 array['Autant', 'Environ 2 fois', 'Environ 28 fois', 'Environ 1 000 fois'], 2,
 'Environ 28 fois plus (GIEC). Il vient surtout de l''élevage des ruminants, des décharges et des fuites de gaz.'),
(10, 'Quelle part de la France métropolitaine est couverte de forêt ?',
 array['Environ 5 %', 'Environ 15 %', 'Environ un tiers', 'Plus de la moitié'], 2,
 'Environ 31 % du territoire (IGN), et la surface forestière a presque doublé depuis le milieu du XIXe siècle.'),
(11, 'Depuis 1950, la France a perdu environ quelle part de ses haies ?',
 array['10 %', '30 %', '70 %', 'Aucune'], 2,
 'Environ 70 % des haies ont disparu (rapport CGAAER 2023). Elles abritent oiseaux et insectes et stockent du carbone : on en replante.'),
(12, 'Une pompe à chaleur produit environ combien de kWh de chaleur pour 1 kWh d''électricité ?',
 array['0,5 kWh', '1 kWh', '3 kWh', '20 kWh'], 2,
 'Environ 3 kWh de chaleur pour 1 kWh d''électricité : elle puise le reste dans l''air ou le sol.'),
(13, 'Un smartphone reconditionné plutôt que neuf évite environ quelle part de son impact ?',
 array['10 %', '30 %', '50 %', 'Près de 80 %'], 3,
 'Entre 77 et 91 % d''impact en moins selon l''ADEME (2022), puisqu''on évite la fabrication d''un appareil neuf.'),
(14, 'De combien la France s''est-elle déjà réchauffée depuis le début du XXe siècle ?',
 array['+0,5 °C', '+1 °C', 'Environ +1,7 °C', '+4 °C'], 2,
 'Environ +1,7 °C (Météo-France), un peu plus que la moyenne mondiale : les terres se réchauffent plus vite que les océans.'),
(15, 'Quelle part de l''empreinte carbone d''un Français vient de son alimentation ?',
 array['Environ 5 %', 'Environ un quart', 'Environ la moitié', 'Plus de 80 %'], 1,
 'Environ un quart de l''empreinte (ADEME), dont une grande partie liée à la viande et aux produits laitiers.'),
(16, 'Lequel de ces emballages se recycle à l''infini sans perdre en qualité ?',
 array['Le verre', 'Le carton', 'La bouteille plastique', 'Le papier'], 0,
 'Le verre (comme l''aluminium) se recycle sans fin. Le papier et le carton s''abîment à chaque cycle, le plastique aussi.'),
(17, 'Une ampoule LED consomme combien d''électricité de moins qu''une ampoule à incandescence ?',
 array['10 % de moins', '30 % de moins', 'Environ 80 % de moins', 'Autant'], 2,
 'Environ 80 à 90 % de moins pour la même lumière (ADEME), et elle dure bien plus longtemps.'),
(18, 'Quelle est la première source d''électricité en France ?',
 array['Le gaz', 'Le charbon', 'Le nucléaire', 'L''éolien'], 2,
 'Le nucléaire, autour de deux tiers de la production (RTE), puis l''hydraulique, l''éolien et le solaire : c''est pourquoi le train et la voiture électrique émettent si peu ici.'),
(19, 'Covoiturer à deux plutôt que rouler seul divise les émissions par personne par…',
 array['1,1', '2', '5', '10'], 1,
 'Par deux : la même voiture, partagée. C''est l''un des défis de Pousse.'),
(20, 'Quel vêtement a la plus grosse empreinte carbone à la fabrication ?',
 array['Un tee-shirt en coton', 'Un jean', 'Une paire de chaussettes', 'Une casquette'], 1,
 'Un jean neuf pèse environ 25 kg de CO₂e (ADEME), surtout à cause du coton et de la teinture. L''occasion évite presque tout.'),
(21, 'Que représente l''objectif de 2 tonnes de CO₂e par personne et par an ?',
 array['L''empreinte actuelle d''un Français', 'Le niveau compatible avec l''Accord de Paris en 2050', 'L''empreinte d''un vol Paris–Nice', 'La limite légale en France'], 1,
 'C''est l''ordre de grandeur visé pour 2050 pour tenir l''Accord de Paris : environ 4 fois moins qu''aujourd''hui.'),
(22, 'Un trajet domicile-travail de 10 km en métro ou RER, comparé à la voiture seul, émet environ…',
 array['Autant', '2 fois moins', 'Plus de 10 fois moins', '2 fois plus'], 2,
 'Quelques grammes par km en métro ou RER contre plus de 100 g en voiture thermique (ADEME) : plus de 10 fois moins.')
on conflict (id) do update set
  question = excluded.question, choices = excluded.choices, answer = excluded.answer, explanation = excluded.explanation;

-- 4. Graine mystère -------------------------------------------------------------------------------

create table if not exists public.mystery_seeds (
  user_id uuid not null references public.profiles on delete cascade,
  day date not null,
  opened_at timestamptz,
  reward text,
  points integer not null default 0,
  primary key (user_id, day)
);
alter table public.mystery_seeds enable row level security;
drop policy if exists "graines: les miennes" on public.mystery_seeds;
create policy "graines: les miennes" on public.mystery_seeds
  for select to authenticated using (user_id = auth.uid());

-- Plantes rares obtenues (graines mystère).
create table if not exists public.garden_rares (
  user_id uuid not null references public.profiles on delete cascade,
  plant text not null,
  obtained_at timestamptz not null default now(),
  primary key (user_id, plant)
);
alter table public.garden_rares enable row level security;
drop policy if exists "plantes rares: les miennes" on public.garden_rares;
create policy "plantes rares: les miennes" on public.garden_rares
  for select to authenticated using (user_id = auth.uid());

-- Ouvre la plus ancienne graine : 8 % plante rare (si une reste à trouver), puis +20, +10 ou +5.
create or replace function public.open_seed_roll(p_user uuid, p_roll numeric)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  s public.mystery_seeds;
  comp uuid;
  rare text;
  pts integer := 0;
begin
  select * into s from public.mystery_seeds
  where user_id = p_user and opened_at is null order by day limit 1 for update;
  if not found then
    raise exception 'no_seed';
  end if;
  if p_roll < 0.08 then
    select x into rare from unnest(array['orchidee', 'bonsai', 'edelweiss', 'lotus', 'nenuphar']) x
    where not exists (select 1 from public.garden_rares g where g.user_id = p_user and g.plant = x)
    order by md5(p_user::text || x || s.day) limit 1;
  end if;
  if rare is not null then
    insert into public.garden_rares (user_id, plant) values (p_user, rare);
  else
    pts := case when p_roll < 0.20 then 20 when p_roll < 0.50 then 10 else 5 end;
    select company_id into comp from public.profiles where id = p_user;
    insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
    values (p_user, comp, 'graine', pts, md5(p_user::text || ':graine:' || s.day)::uuid)
    on conflict (user_id, kind, ref_id) do nothing;
  end if;
  update public.mystery_seeds set opened_at = now(), reward = coalesce(rare, 'pousses'), points = pts
  where user_id = p_user and day = s.day;
  return jsonb_build_object('plant', rare, 'points', pts);
end;
$$;
revoke all on function public.open_seed_roll(uuid, numeric) from public;

create or replace function public.open_seed()
returns jsonb
language sql volatile security definer set search_path = public
as $$ select public.open_seed_roll(auth.uid(), random()::numeric) $$;
revoke all on function public.open_seed() from public;
grant execute on function public.open_seed() to authenticated;

-- 1. Défi collectif de la semaine ----------------------------------------------------------------

-- Un thème par semaine, différent de la semaine précédente, décalé d'une entreprise à l'autre.
create or replace function public.weekly_goal_kind(p_company uuid, p_week date)
returns text
language sql immutable
as $$
  select (array['repas', 'trajets', 'scan', 'quiz', 'bravo', 'preuve'])[
    1 + (((p_week - date '2000-01-03') / 7 + get_byte(decode(md5(p_company::text), 'hex'), 0)) % 6)]
$$;

-- Objectif : par participant, avec un plancher pour les petites entreprises (60 % des inscrits actifs en moyenne).
create or replace function public.weekly_goal_target(p_kind text, p_participants integer)
returns integer
language sql immutable
as $$
  select greatest(per * 5, ceil(per * p_participants * 0.6))::integer
  from (select case p_kind when 'scan' then 2 when 'bravo' then 4 else 3 end as per) x
$$;

-- Ce qui compte pour l'objectif, pour toute l'entreprise (p_user null) ou pour une personne.
create or replace function public.goal_count(p_kind text, p_company uuid, p_user uuid, p_from date, p_to date)
returns integer
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select (case p_kind
    when 'repas' then (select coalesce(sum(v.units), 0) from public.validations v
                       where v.company_id = p_company and (p_user is null or v.user_id = p_user) and v.status = 'valid'
                         and v.template_id in ('vege', 'vegetalien') and v.day between p_from and p_to)
    when 'trajets' then (select coalesce(sum(v.units), 0) from public.validations v
                         where v.company_id = p_company and (p_user is null or v.user_id = p_user) and v.status = 'valid'
                           and v.template_id in ('velo', 'transports', 'covoiturage') and v.day between p_from and p_to)
    when 'preuve' then (select count(*) from public.validations v
                        where v.company_id = p_company and (p_user is null or v.user_id = p_user) and v.status = 'valid'
                          and v.proof_level > 0 and v.day between p_from and p_to)
    when 'scan' then (select count(*) from public.product_swaps s
                      where s.company_id = p_company and (p_user is null or s.user_id = p_user)
                        and s.created_at::date between p_from and p_to)
    when 'quiz' then (select count(*) from public.quiz_answers q join public.profiles p on p.id = q.user_id
                      where p.company_id = p_company and (p_user is null or q.user_id = p_user)
                        and q.correct and q.day between p_from and p_to)
    when 'bravo' then (select count(*) from public.cheers c join public.profiles p on p.id = c.user_id
                       where p.company_id = p_company and (p_user is null or c.user_id = p_user)
                         and c.created_at::date between p_from and p_to)
    else 0 end)::integer
$$;
revoke all on function public.goal_count(text, uuid, uuid, date, date) from public;

-- L'objectif de la semaine et sa progression ; crédite +30 aux contributeurs quand il est atteint
-- (cette semaine, ou la semaine dernière si on ne s'était pas reconnecté depuis).
create or replace function public.my_weekly_goal()
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  n integer;
  wk date := date_trunc('week', current_date)::date;
  prev date := date_trunc('week', current_date)::date - 7;
  k text;
  tgt integer;
  prog integer;
  mine integer;
  pk text;
  p_reached boolean;
  r integer;
  gained integer := 0;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;
  select count(*) into n from public.profiles where company_id = me.company_id;

  -- Semaine dernière : récompense encore due si on ne s'était pas reconnecté depuis.
  pk := public.weekly_goal_kind(me.company_id, prev);
  p_reached := public.goal_count(pk, me.company_id, null, prev, prev + 6) >= public.weekly_goal_target(pk, n);
  if p_reached and public.goal_count(pk, me.company_id, me.id, prev, prev + 6) > 0 then
    insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
    values (me.id, me.company_id, 'collectif', 30, md5(me.id::text || ':collectif:' || prev)::uuid)
    on conflict (user_id, kind, ref_id) do nothing;
    get diagnostics r = row_count;
    gained := gained + r * 30;
  end if;

  -- Semaine en cours.
  k := public.weekly_goal_kind(me.company_id, wk);
  tgt := public.weekly_goal_target(k, n);
  prog := public.goal_count(k, me.company_id, null, wk, wk + 6);
  mine := public.goal_count(k, me.company_id, me.id, wk, wk + 6);
  if prog >= tgt and mine > 0 then
    insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
    values (me.id, me.company_id, 'collectif', 30, md5(me.id::text || ':collectif:' || wk)::uuid)
    on conflict (user_id, kind, ref_id) do nothing;
    get diagnostics r = row_count;
    gained := gained + r * 30;
  end if;

  return jsonb_build_object(
    'kind', k, 'target', tgt, 'progress', prog, 'mine', mine, 'ends_on', wk + 6,
    'reached', prog >= tgt, 'gained', gained,
    'last_week', jsonb_build_object('kind', pk, 'reached', p_reached));
end;
$$;
revoke all on function public.my_weekly_goal() from public;
grant execute on function public.my_weekly_goal() to authenticated;

-- 2. Duels ---------------------------------------------------------------------------------------

create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies,
  challenger uuid not null references public.profiles on delete cascade,
  opponent uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('trajets', 'repas', 'scan', 'defis')),
  target integer not null default 3 check (target between 1 and 10),
  status text not null default 'pending' check (status in ('pending', 'active', 'declined', 'done', 'expired')),
  winner text check (winner in ('both', 'challenger', 'opponent', 'none')),
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  check (challenger <> opponent)
);
create index if not exists duels_challenger_idx on public.duels (challenger, status);
create index if not exists duels_opponent_idx on public.duels (opponent, status);
alter table public.duels enable row level security;
drop policy if exists "duels: les miens" on public.duels;
create policy "duels: les miens" on public.duels
  for select to authenticated using (challenger = auth.uid() or opponent = auth.uid());

-- Ce qui compte dans un duel : seulement des actions vérifiables (avec preuve, ou scanner).
create or replace function public.duel_count(p_kind text, p_user uuid, p_from date, p_to date)
returns integer
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select (case p_kind
    when 'trajets' then (select coalesce(sum(v.units), 0) from public.validations v
                         where v.user_id = p_user and v.status = 'valid' and v.proof_level > 0
                           and v.template_id in ('velo', 'transports', 'covoiturage') and v.day between p_from and p_to)
    when 'repas' then (select coalesce(sum(v.units), 0) from public.validations v
                       where v.user_id = p_user and v.status = 'valid' and v.proof_level > 0
                         and v.template_id in ('vege', 'vegetalien') and v.day between p_from and p_to)
    when 'defis' then (select count(*) from public.validations v
                       where v.user_id = p_user and v.status = 'valid' and v.proof_level > 0
                         and v.day between p_from and p_to)
    when 'scan' then (select count(*) from public.product_swaps s
                      where s.user_id = p_user and s.created_at::date between p_from and p_to)
    else 0 end)::integer
$$;
revoke all on function public.duel_count(text, uuid, date, date) from public;

create or replace function public.challenge_duel(p_opponent uuid, p_kind text, p_target integer default 3)
returns public.duels
language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles;
  d public.duels;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;
  if p_opponent = me.id
     or not exists (select 1 from public.profiles where id = p_opponent and company_id = me.company_id) then
    raise exception 'invalid_opponent';
  end if;
  if p_kind not in ('trajets', 'repas', 'scan', 'defis') or p_target is null or p_target not between 1 and 10 then
    raise exception 'invalid_duel';
  end if;
  if (select count(*) from public.duels where me.id in (challenger, opponent) and status in ('pending', 'active')) >= 3 then
    raise exception 'too_many_duels';
  end if;
  if exists (select 1 from public.duels
             where status in ('pending', 'active')
               and ((challenger = me.id and opponent = p_opponent) or (challenger = p_opponent and opponent = me.id))) then
    raise exception 'duel_exists';
  end if;
  insert into public.duels (company_id, challenger, opponent, kind, target)
  values (me.company_id, me.id, p_opponent, p_kind, p_target)
  returning * into d;
  return d;
end;
$$;
revoke all on function public.challenge_duel(uuid, text, integer) from public;
grant execute on function public.challenge_duel(uuid, text, integer) to authenticated;

create or replace function public.answer_duel(p_duel uuid, p_accept boolean)
returns public.duels
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  d public.duels;
begin
  select * into d from public.duels where id = p_duel and opponent = auth.uid() and status = 'pending' for update;
  if not found then
    raise exception 'duel_not_found';
  end if;
  if p_accept then
    if (select count(*) from public.duels where auth.uid() in (challenger, opponent) and status = 'active') >= 3 then
      raise exception 'too_many_duels';
    end if;
    update public.duels set status = 'active', starts_on = current_date, ends_on = current_date + 6
    where id = d.id returning * into d;
  else
    update public.duels set status = 'declined' where id = d.id returning * into d;
  end if;
  return d;
end;
$$;
revoke all on function public.answer_duel(uuid, boolean) from public;
grant execute on function public.answer_duel(uuid, boolean) to authenticated;

-- Clôt les duels terminés (les deux ont atteint l'objectif, ou les 7 jours sont passés) et crédite :
-- les deux ont réussi → +25 chacun ; un seul → +40 pour lui. Invitations sans réponse : expirées après 3 jours.
create or replace function public.settle_duels(p_user uuid)
returns void
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  d public.duels;
  a integer;
  b integer;
  w text;
begin
  update public.duels set status = 'expired'
  where status = 'pending' and p_user in (challenger, opponent) and created_at < now() - interval '3 days';

  for d in select * from public.duels where status = 'active' and p_user in (challenger, opponent) for update loop
    a := public.duel_count(d.kind, d.challenger, d.starts_on, least(d.ends_on, current_date));
    b := public.duel_count(d.kind, d.opponent, d.starts_on, least(d.ends_on, current_date));
    if (a >= d.target and b >= d.target) or current_date > d.ends_on then
      w := case when a >= d.target and b >= d.target then 'both'
                when a >= d.target then 'challenger'
                when b >= d.target then 'opponent'
                else 'none' end;
      update public.duels set status = 'done', winner = w where id = d.id;
      if w in ('both', 'challenger') then
        insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
        values (d.challenger, d.company_id, 'duel', case when w = 'both' then 25 else 40 end, d.id)
        on conflict (user_id, kind, ref_id) do nothing;
      end if;
      if w in ('both', 'opponent') then
        insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
        values (d.opponent, d.company_id, 'duel', case when w = 'both' then 25 else 40 end, d.id)
        on conflict (user_id, kind, ref_id) do nothing;
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function public.settle_duels(uuid) from public;

-- Mes duels (en attente, en cours, terminés depuis moins de 14 jours), avec la progression des deux côtés.
create or replace function public.my_duels()
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return '[]'::jsonb;
  end if;
  perform public.settle_duels(me);
  return coalesce((
    select jsonb_agg(x order by x.rank, x.created_at desc)
    from (
      select d.id, d.kind, d.target, d.status, d.winner, d.starts_on, d.ends_on, d.created_at,
             case when d.challenger = me then 'challenger' else 'opponent' end as role,
             o.id as other_id, o.display_name as other_name,
             case when d.starts_on is null then 0
                  else public.duel_count(d.kind, me, d.starts_on, least(d.ends_on, current_date)) end as mine,
             case when d.starts_on is null then 0
                  else public.duel_count(d.kind, o.id, d.starts_on, least(d.ends_on, current_date)) end as theirs,
             case d.status when 'pending' then 0 when 'active' then 1 else 2 end as rank
      from public.duels d
      join public.profiles o on o.id = case when d.challenger = me then d.opponent else d.challenger end
      where me in (d.challenger, d.opponent)
        and (d.status in ('pending', 'active') or d.created_at > now() - interval '14 days')
    ) x), '[]'::jsonb);
end;
$$;
revoke all on function public.my_duels() from public;
grant execute on function public.my_duels() to authenticated;

-- 3. Jardin ---------------------------------------------------------------------------------------

-- Ce qui fait pousser le jardin d'une personne (moi ou un collègue de la même entreprise).
create or replace function public.garden(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  who public.profiles;
begin
  select * into who from public.profiles where id = p_user and company_id = public.my_company_id();
  if not found then
    raise exception 'not_found';
  end if;
  return jsonb_build_object(
    'name', who.display_name,
    'counts', jsonb_build_object(
      'transport', (select coalesce(sum(v.units), 0) from public.validations v join public.challenge_templates t on t.id = v.template_id
                    where v.user_id = p_user and v.status = 'valid' and t.category = 'transport'),
      'alimentation', (select coalesce(sum(v.units), 0) from public.validations v join public.challenge_templates t on t.id = v.template_id
                       where v.user_id = p_user and v.status = 'valid' and t.category = 'alimentation'),
      'consommation', (select coalesce(sum(v.units), 0) from public.validations v join public.challenge_templates t on t.id = v.template_id
                       where v.user_id = p_user and v.status = 'valid' and t.category = 'consommation'),
      'logement', (select coalesce(sum(v.units), 0) from public.validations v join public.challenge_templates t on t.id = v.template_id
                   where v.user_id = p_user and v.status = 'valid' and t.category = 'logement'),
      'scan', (select count(*) from public.product_swaps where user_id = p_user),
      'cap', (select count(*) from public.habit_checkins where user_id = p_user),
      'bravo', (select count(*) from public.cheers where user_id = p_user),
      'quiz', (select count(*) from public.quiz_answers where user_id = p_user and correct)),
    'exploits', jsonb_build_object(
      'serie30', exists (select 1 from public.points_ledger where user_id = p_user and kind = 'serie' and points = 100),
      'expert', exists (select 1 from public.user_challenges u join public.challenge_templates t on t.id = u.template_id
                        where u.user_id = p_user and u.status = 'done' and t.level = 'expert'),
      'collectif', exists (select 1 from public.points_ledger where user_id = p_user and kind = 'collectif'),
      'duel', exists (select 1 from public.points_ledger where user_id = p_user and kind = 'duel'),
      'inspire', exists (select 1 from public.points_ledger where user_id = p_user and kind = 'influence')),
    'rares', coalesce((select jsonb_agg(plant order by obtained_at) from public.garden_rares where user_id = p_user), '[]'::jsonb));
end;
$$;
revoke all on function public.garden(uuid) from public;
grant execute on function public.garden(uuid) to authenticated;

-- Quêtes : le quiz rejoint la pioche ; la graine mystère et les duels se règlent au passage -------------

create or replace function public.quest_done(p_user uuid, p_quest text)
returns boolean
language sql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
  select case p_quest
    when 'preuve' then exists (select 1 from public.validations v where v.user_id = p_user
                               and v.status = 'valid' and v.day = current_date and v.proof_level > 0)
    when 'defi' then exists (select 1 from public.validations v where v.user_id = p_user
                             and v.status = 'valid' and v.day = current_date)
    when 'expert' then exists (select 1 from public.validations v
                               join public.challenge_templates t on t.id = v.template_id
                               where v.user_id = p_user and v.status = 'valid'
                                 and v.day = current_date and t.level = 'expert')
    when 'scan' then exists (select 1 from public.product_scans s where s.user_id = p_user
                             and s.created_at::date = current_date)
    when 'meilleur_choix' then exists (select 1 from public.product_swaps s where s.user_id = p_user
                                       and s.created_at::date = current_date)
    when 'bravo' then exists (select 1 from public.cheers c where c.user_id = p_user
                              and c.created_at::date = current_date)
    when 'cap' then exists (select 1 from public.habit_checkins k where k.user_id = p_user
                            and k.created_at::date = current_date)
    when 'lancer' then exists (select 1 from public.user_challenges u where u.user_id = p_user
                               and u.created_at::date = current_date)
    when 'quiz' then exists (select 1 from public.quiz_answers q where q.user_id = p_user and q.day = current_date)
    else false end
$$;
revoke all on function public.quest_done(uuid, text) from public;

create or replace function public.todays_quests(p_user uuid)
returns text[]
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  q text[];
  me public.profiles;
  h public.habits;
  pool text[] := array[]::text[];
  has_active boolean;
begin
  select quests into q from public.daily_quests where user_id = p_user and day = current_date;
  if found then
    return q;
  end if;
  select * into me from public.profiles where id = p_user;
  select * into h from public.habits where user_id = p_user;
  has_active := exists (select 1 from public.user_challenges where user_id = p_user and status = 'active'
                        and current_date between starts_on and ends_on);

  -- Toujours possibles
  pool := pool || array['scan', 'meilleur_choix'];
  if exists (select 1 from public.quiz_questions) then
    pool := pool || array['quiz'];
  end if;
  if has_active then
    pool := pool || array['preuve'];
  else
    pool := pool || array['lancer'];
  end if;
  -- Selon le profil
  if exists (select 1 from public.user_challenges u join public.challenge_templates t on t.id = u.template_id
             where u.user_id = p_user and u.status = 'active' and t.level = 'expert') then
    pool := pool || array['expert'];
  end if;
  if h.user_id is not null and exists (
       select 1 from unnest(public.kept_habits(h)) k
       where not exists (select 1 from public.habit_checkins c where c.user_id = p_user and c.habit = k
                         and c.week_start = date_trunc('week', current_date)::date)) then
    pool := pool || array['cap'];
  end if;
  if exists (select 1 from public.validations v where v.company_id = me.company_id and v.user_id <> p_user
             and v.visibility = 'company' and v.status = 'valid' and v.created_at > now() - interval '7 days') then
    pool := pool || array['bravo'];
  end if;

  -- La quête « défi » (preuve, expert ou lancer) est toujours tirée en premier ; les deux autres au hasard du jour.
  select array_agg(x order by md5(p_user::text || current_date || x)) into q
  from unnest(pool) x where x not in ('preuve', 'lancer', 'expert');
  q := array[case when has_active then 'preuve' else 'lancer' end] || q[1:2];
  if 'expert' = any (pool) and has_active and get_byte(decode(md5(p_user::text || current_date), 'hex'), 0) % 2 = 0 then
    q[1] := 'expert';
  end if;

  insert into public.daily_quests (user_id, day, quests) values (p_user, current_date, q)
  on conflict (user_id, day) do nothing;
  return q;
end;
$$;
revoke all on function public.todays_quests(uuid) from public;

create or replace function public.claim_daily_rewards()
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  q text[];
  done jsonb := '{}'::jsonb;
  all_done boolean := true;
  x text;
  ok boolean;
  s record;
  m record;
  gained integer := 0;
  n integer;
  seed jsonb;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;

  perform public.settle_duels(me.id);

  q := public.todays_quests(me.id);
  foreach x in array q loop
    ok := public.quest_done(me.id, x);
    done := done || jsonb_build_object(x, ok);
    all_done := all_done and ok;
  end loop;

  if all_done then
    insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
    values (me.id, me.company_id, 'quete', 15, md5(me.id::text || ':quete:' || current_date)::uuid)
    on conflict (user_id, kind, ref_id) do nothing;
    get diagnostics n = row_count;
    gained := gained + n * 15;
    -- La graine mystère du jour.
    insert into public.mystery_seeds (user_id, day) values (me.id, current_date)
    on conflict (user_id, day) do nothing;
  end if;

  select * into s from public.day_streak(me.id);
  for m in select * from (values (3, 10), (7, 25), (14, 50), (30, 100)) as t(days, pts) loop
    if s.streak >= m.days then
      insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
      values (me.id, me.company_id, 'serie', m.pts,
              md5(me.id::text || ':serie:' || m.days || ':' || s.started_on)::uuid)
      on conflict (user_id, kind, ref_id) do nothing;
      get diagnostics n = row_count;
      gained := gained + n * m.pts;
    end if;
  end loop;

  select case
           when exists (select 1 from public.mystery_seeds where user_id = me.id and opened_at is null)
             then jsonb_build_object('state', 'ready')
           when ms.day is not null
             then jsonb_build_object('state', 'opened', 'plant', case when ms.reward = 'pousses' then null else ms.reward end,
                                     'points', ms.points)
           else null end
  into seed
  from (select 1) one
  left join public.mystery_seeds ms on ms.user_id = me.id and ms.day = current_date;

  return jsonb_build_object(
    'order', to_jsonb(q),
    'quests', done,
    'quest_done', all_done,
    'streak', s.streak,
    'gained', gained,
    'seed', seed);
end;
$$;
revoke all on function public.claim_daily_rewards() from public;
grant execute on function public.claim_daily_rewards() to authenticated;
