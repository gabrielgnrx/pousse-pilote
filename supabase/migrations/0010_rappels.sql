-- Pousse · rappels sur le téléphone (notifications Web Push)
--   Chaque appareil qui accepte les rappels enregistre son abonnement push (navigateur → service de push).
--   Une fois par jour, en fin d'après-midi, le serveur demande la liste des personnes à relancer :
--   celles qui ont un abonnement et n'ont encore rien fait aujourd'hui. La notification ne contient
--   aucune donnée : le téléphone vient chercher le texte (« ta série de 4 jours s'arrête ce soir »).

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_sent_on date
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

drop policy if exists "rappels: les miens (lecture)" on public.push_subscriptions;
create policy "rappels: les miens (lecture)" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "rappels: les miens (ajout)" on public.push_subscriptions;
create policy "rappels: les miens (ajout)" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "rappels: les miens (modif)" on public.push_subscriptions;
create policy "rappels: les miens (modif)" on public.push_subscriptions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "rappels: les miens (retrait)" on public.push_subscriptions;
create policy "rappels: les miens (retrait)" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- Clé du cron : seule son empreinte SHA-256 est en base ; le texte clair reste dans Vercel (CRON_SECRET).
-- Aucune politique : personne ne lit cette table, seules les fonctions ci-dessous la consultent.
create table if not exists public.cron_keys (
  name text primary key,
  sha256 text not null
);
alter table public.cron_keys enable row level security;

create or replace function public.cron_key_ok(p_token text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_token is not null and length(p_token) >= 32 and exists (
    select 1 from public.cron_keys k
    where k.name = 'rappels' and k.sha256 = encode(sha256(convert_to(p_token, 'UTF8')), 'hex'))
$$;
revoke all on function public.cron_key_ok(text) from public;

-- Les abonnements à relancer aujourd'hui (une fois par jour au plus), avec la série en cours.
create or replace function public.reminders_due(p_token text)
returns table (endpoint text, streak integer)
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
begin
  if not public.cron_key_ok(p_token) then
    raise exception 'forbidden';
  end if;
  return query
    select s.endpoint, (select d.streak from public.day_streak(s.user_id) d)
    from public.push_subscriptions s
    where (s.last_sent_on is null or s.last_sent_on < current_date)
      and not exists (select 1 from public.active_days(s.user_id) a where a = current_date);
end;
$$;
revoke all on function public.reminders_due(text) from public;
grant execute on function public.reminders_due(text) to anon, authenticated;

-- Après l'envoi : marque les abonnements relancés et retire ceux que le service de push a refusés (404/410).
create or replace function public.reminders_sent(p_token text, p_sent text[], p_gone text[])
returns void
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
begin
  if not public.cron_key_ok(p_token) then
    raise exception 'forbidden';
  end if;
  update public.push_subscriptions set last_sent_on = current_date where endpoint = any (p_sent);
  delete from public.push_subscriptions where endpoint = any (p_gone);
end;
$$;
revoke all on function public.reminders_sent(text, text[], text[]) from public;
grant execute on function public.reminders_sent(text, text[], text[]) to anon, authenticated;

-- Le texte du rappel, lu par le téléphone à la réception (session de la personne).
create or replace function public.my_reminder()
returns jsonb
language plpgsql stable security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  s integer;
  active_today boolean;
begin
  if auth.uid() is null then
    return null;
  end if;
  select d.streak into s from public.day_streak(auth.uid()) d;
  active_today := exists (select 1 from public.active_days(auth.uid()) a where a = current_date);
  return jsonb_build_object('streak', coalesce(s, 0), 'active_today', active_today);
end;
$$;
revoke all on function public.my_reminder() from public;
grant execute on function public.my_reminder() to authenticated;
