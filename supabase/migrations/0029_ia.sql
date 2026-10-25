-- 0029 — Socle IA (v2, octobre 2026) : journal des appels, quotas, cache.
--
-- Les appels à l'API Claude partent uniquement du serveur de l'application. La base garde :
--   - ai_calls : un journal sans contenu (ni l'entrée ni la sortie), pour suivre tokens, latence et
--     coût estimé par organisation ;
--   - ai_quota : des compteurs par jour, par personne et par organisation (rate limiting) ;
--   - ai_cache : les sorties d'appels répétables (même entrée, même version de prompt), sous une clé
--     de hachage. On n'y met que des sorties structurées sans donnée personnelle.
-- Rien n'est lisible par les salariés ; tout passe par des fonctions security definer.

-- Clés des tâches planifiées : la même table cron_keys, avec un nom par usage.
create or replace function public.cron_key_named(p_name text, p_token text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_token is not null and length(p_token) >= 32 and exists (
    select 1 from public.cron_keys k
    where k.name = p_name and k.sha256 = encode(sha256(convert_to(p_token, 'UTF8')), 'hex'))
$$;
revoke all on function public.cron_key_named(text, text) from public;

-- 1. Journal ------------------------------------------------------------------------------------------
create table if not exists public.ai_calls (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies on delete cascade,
  user_id uuid references public.profiles on delete set null,
  task text not null check (task ~ '^[a-z0-9_-]+$'),
  prompt_version text not null,
  model text not null,
  status text not null check (status in ('ok', 'invalid_output', 'low_confidence', 'refused', 'error', 'timeout', 'rate_limited', 'cached', 'mock')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cache_read_tokens integer not null default 0 check (cache_read_tokens >= 0),
  latency_ms integer not null default 0 check (latency_ms >= 0),
  cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0),
  error_code text check (char_length(error_code) <= 80),
  created_at timestamptz not null default now()
);
create index if not exists ai_calls_company_idx on public.ai_calls (company_id, created_at desc);
alter table public.ai_calls enable row level security;
-- Aucune politique : ni lecture ni écriture directe.

create or replace function public.ai_log(
  p_task text, p_prompt_version text, p_model text, p_status text,
  p_input_tokens integer default 0, p_output_tokens integer default 0, p_cache_read_tokens integer default 0,
  p_latency_ms integer default 0, p_cost_usd numeric default 0, p_error_code text default null,
  p_token text default null, p_company uuid default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cid uuid;
begin
  if uid is not null then
    cid := public.my_company_id();
    if cid is null then
      raise exception 'not_member';
    end if;
  elsif public.cron_key_named('ia', p_token) then
    -- Tâche planifiée : l'organisation concernée est passée explicitement (ou aucune).
    cid := p_company;
  else
    raise exception 'not_allowed';
  end if;
  insert into public.ai_calls (company_id, user_id, task, prompt_version, model, status, input_tokens, output_tokens,
                               cache_read_tokens, latency_ms, cost_usd, error_code)
  values (cid, uid, p_task, p_prompt_version, p_model, p_status, greatest(p_input_tokens, 0), greatest(p_output_tokens, 0),
          greatest(p_cache_read_tokens, 0), greatest(p_latency_ms, 0), greatest(p_cost_usd, 0), left(p_error_code, 80));
end;
$$;
revoke all on function public.ai_log(text, text, text, text, integer, integer, integer, integer, numeric, text, text, uuid) from public;
grant execute on function public.ai_log(text, text, text, text, integer, integer, integer, integer, numeric, text, text, uuid) to anon, authenticated;

-- 2. Quotas ---------------------------------------------------------------------------------------------
create table if not exists public.ai_quota (
  scope text not null check (scope in ('user', 'org')),
  subject uuid not null,
  task text not null,
  day date not null,
  used integer not null default 0,
  primary key (scope, subject, task, day)
);
alter table public.ai_quota enable row level security;

-- Réserve un appel : vrai si la personne et son organisation sont sous leurs plafonds du jour (heure de
-- Paris), et compte l'appel. Atomique : deux appels simultanés ne dépassent pas le plafond.
create or replace function public.ai_consume(p_task text, p_user_limit integer, p_org_limit integer)
returns boolean
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  uid uuid := auth.uid();
  cid uuid := public.my_company_id();
  u integer;
  o integer;
begin
  if uid is null or cid is null then
    raise exception 'not_member';
  end if;
  if p_user_limit < 1 or p_org_limit < 1 then
    return false;
  end if;
  insert into public.ai_quota as q (scope, subject, task, day, used)
  values ('user', uid, p_task, current_date, 1)
  on conflict (scope, subject, task, day) do update set used = q.used + 1
  returning used into u;
  insert into public.ai_quota as q (scope, subject, task, day, used)
  values ('org', cid, p_task, current_date, 1)
  on conflict (scope, subject, task, day) do update set used = q.used + 1
  returning used into o;
  if u > p_user_limit or o > p_org_limit then
    -- Refus : on rend l'appel réservé, le compteur reste au plafond.
    update public.ai_quota set used = used - 1 where scope = 'user' and subject = uid and task = p_task and day = current_date;
    update public.ai_quota set used = used - 1 where scope = 'org' and subject = cid and task = p_task and day = current_date;
    return false;
  end if;
  return true;
end;
$$;
revoke all on function public.ai_consume(text, integer, integer) from public;
grant execute on function public.ai_consume(text, integer, integer) to authenticated;

-- 3. Cache ---------------------------------------------------------------------------------------------
create table if not exists public.ai_cache (
  key text primary key check (key ~ '^[0-9a-f]{64}$'),
  task text not null,
  output jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists ai_cache_expires_idx on public.ai_cache (expires_at);
alter table public.ai_cache enable row level security;

create or replace function public.ai_cache_get(p_key text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select output from public.ai_cache where key = p_key and expires_at > now()
$$;
revoke all on function public.ai_cache_get(text) from public;
grant execute on function public.ai_cache_get(text) to authenticated;

create or replace function public.ai_cache_put(p_key text, p_task text, p_output jsonb, p_ttl_hours integer default 24)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_member';
  end if;
  if pg_column_size(p_output) > 8192 then
    return;
  end if;
  insert into public.ai_cache (key, task, output, expires_at)
  values (p_key, p_task, p_output, now() + make_interval(hours => least(greatest(p_ttl_hours, 1), 24 * 30)))
  on conflict (key) do update set output = excluded.output, expires_at = excluded.expires_at, created_at = now();
  delete from public.ai_cache where expires_at < now() - interval '1 day';
end;
$$;
revoke all on function public.ai_cache_put(text, text, jsonb, integer) from public;
grant execute on function public.ai_cache_put(text, text, jsonb, integer) to authenticated;

-- 4. Suppression de compte : le journal garde la ligne (comptes de l'organisation) sans la personne
-- (user_id passe à null par la clé étrangère) ; ses compteurs de quota disparaissent.
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.ai_quota where scope = 'user' and subject = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
