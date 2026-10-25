-- 0039 — Journal et quota de l'IA pour l'espace admin RSE (v2, octobre 2026).
--
-- Une admin RSE n'est pas forcément participante (pas de profil) : ai_log et ai_consume, qui partent du
-- profil, ne lui conviennent pas. Ces deux fonctions vérifient qu'elle administre l'organisation, puis
-- journalisent l'appel au nom de l'organisation (sans utilisateur) et appliquent un quota par organisation.

create or replace function public.admin_ai_consume(p_company uuid, p_task text, p_limit integer)
returns boolean
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  o integer;
begin
  if not public.is_org_admin(p_company) then
    raise exception 'not_admin';
  end if;
  if p_limit < 1 or p_limit > 50 or p_task !~ '^[a-z_]{2,40}$' then
    return false;
  end if;
  insert into public.ai_quota as q (scope, subject, task, day, used)
  values ('org', p_company, 'admin:' || p_task, current_date, 1)
  on conflict (scope, subject, task, day) do update set used = q.used + 1
  returning used into o;
  return o <= p_limit;
end;
$$;
revoke all on function public.admin_ai_consume(uuid, text, integer) from public;
grant execute on function public.admin_ai_consume(uuid, text, integer) to authenticated;

create or replace function public.admin_ai_log(
  p_company uuid, p_task text, p_prompt_version text, p_model text, p_status text,
  p_input_tokens integer default 0, p_output_tokens integer default 0, p_cache_read_tokens integer default 0,
  p_latency_ms integer default 0, p_cost_usd numeric default 0, p_error_code text default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_org_admin(p_company) then
    raise exception 'not_admin';
  end if;
  insert into public.ai_calls (company_id, user_id, task, prompt_version, model, status, input_tokens, output_tokens,
                               cache_read_tokens, latency_ms, cost_usd, error_code)
  values (p_company, null, p_task, p_prompt_version, p_model, p_status, greatest(p_input_tokens, 0), greatest(p_output_tokens, 0),
          greatest(p_cache_read_tokens, 0), greatest(p_latency_ms, 0), greatest(p_cost_usd, 0), left(p_error_code, 80));
end;
$$;
revoke all on function public.admin_ai_log(uuid, text, text, text, text, integer, integer, integer, integer, numeric, text) from public;
grant execute on function public.admin_ai_log(uuid, text, text, text, text, integer, integer, integer, integer, numeric, text) to authenticated;
