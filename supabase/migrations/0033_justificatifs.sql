-- 0033 — Vérification des justificatifs par l'IA (v2, octobre 2026).
--
-- Train, vacances en train, réparation et achats via une appli demandent un justificatif. Le serveur
-- de l'application le fait évaluer (Claude vision : plausibilité seulement) et enregistre le verdict
-- avec la clé de service : un salarié ne peut jamais écrire son propre verdict.
--   - accepted : rien ne change, la photo est effacée ;
--   - needs_review : la personne peut envoyer une autre photo ; d'ici là, les pousses de l'action sont
--     mises de côté (le CO₂ reste compté) ; elles reviennent si la nouvelle photo est acceptée ;
--   - rejected : l'action est annulée (ni CO₂ ni pousses), la photo est effacée.
-- Aucune donnée lue sur le justificatif n'est gardée (ni nom, ni numéro, ni date) : seulement le verdict.

alter table public.validations add column if not exists proof_status text not null default 'none'
  check (proof_status in ('none', 'pending', 'accepted', 'needs_review', 'rejected'));

create table if not exists public.proof_checks (
  id bigint generated always as identity primary key,
  validation_id uuid not null references public.validations on delete cascade,
  company_id uuid not null references public.companies on delete cascade,
  verdict text not null check (verdict in ('accepted', 'needs_review', 'rejected')),
  reason_code text not null check (reason_code ~ '^[a-z_]{2,40}$'),
  model text not null,
  prompt_version text not null,
  points_withheld integer not null default 0,
  checked_at timestamptz not null default now()
);
create index if not exists proof_checks_validation_idx on public.proof_checks (validation_id, checked_at desc);
alter table public.proof_checks enable row level security;
drop policy if exists "vérifications: les miennes" on public.proof_checks;
create policy "vérifications: les miennes" on public.proof_checks for select to authenticated
  using (exists (select 1 from public.validations v where v.id = validation_id and v.user_id = auth.uid()));

-- Un justificatif déposé = une vérification en attente.
create or replace function public.mark_proof_pending()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if new.receipt_path is not null and (tg_op = 'INSERT' or old.receipt_path is distinct from new.receipt_path) then
    new.proof_status := 'pending';
  end if;
  return new;
end;
$$;
drop trigger if exists validations_proof_pending on public.validations;
create trigger validations_proof_pending
  before insert or update of receipt_path on public.validations
  for each row execute function public.mark_proof_pending();

-- Le verdict, écrit par le serveur avec la clé de service uniquement.
create or replace function public.record_proof_verdict(p_validation uuid, p_verdict text, p_reason text, p_model text, p_version text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v public.validations;
  withheld integer := 0;
  last_withheld integer;
begin
  select * into v from public.validations where id = p_validation for update;
  if not found or v.proof_status not in ('pending') then
    raise exception 'nothing_to_check';
  end if;
  if p_verdict not in ('accepted', 'needs_review', 'rejected') then
    raise exception 'invalid_verdict';
  end if;
  select pc.points_withheld into last_withheld from public.proof_checks pc
  where pc.validation_id = v.id order by pc.checked_at desc limit 1;

  if p_verdict = 'accepted' then
    -- Les pousses mises de côté après un premier doute reviennent.
    update public.validations
       set proof_status = 'accepted', points = points + coalesce(last_withheld, 0), receipt_path = null
     where id = v.id;
  elsif p_verdict = 'needs_review' then
    withheld := v.points;
    update public.validations set proof_status = 'needs_review', points = 0 where id = v.id;
  else
    update public.validations
       set proof_status = 'rejected', status = 'rejected', receipt_path = null
     where id = v.id;
  end if;

  insert into public.proof_checks (validation_id, company_id, verdict, reason_code, model, prompt_version, points_withheld)
  values (v.id, v.company_id, p_verdict, p_reason, p_model, p_version, withheld + case when p_verdict = 'needs_review' then coalesce(last_withheld, 0) else 0 end);

  -- La personne est prévenue (cloche et notification), sans rien reprendre du document.
  if p_verdict <> 'accepted' then
    perform public.notify(v.user_id, 'justificatif', v.id::text || ':' || p_verdict,
      case p_verdict when 'needs_review' then 'Ton justificatif est à renvoyer' else 'Justificatif non retenu' end,
      case p_verdict
        when 'needs_review' then 'On n''a pas pu le lire : envoie une autre photo, tes pousses t''attendent.'
        else 'Le document ne correspond pas à l''action : elle n''a pas été comptée.' end,
      '/agir?justificatif=' || v.id::text);
  end if;

  return jsonb_build_object('validation', v.id, 'verdict', p_verdict, 'photo_to_delete',
                            case when p_verdict in ('accepted', 'rejected') then v.receipt_path end);
end;
$$;
revoke all on function public.record_proof_verdict(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_proof_verdict(uuid, text, text, text, text) to service_role;

-- Une seconde photo après un doute : de nouveau en attente (une fois par action).
create or replace function public.resubmit_proof(p_validation uuid, p_receipt text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if split_part(p_receipt, '/', 1) <> auth.uid()::text then
    raise exception 'invalid_photo';
  end if;
  if (select count(*) from public.proof_checks pc join public.validations v on v.id = pc.validation_id
      where pc.validation_id = p_validation and v.user_id = auth.uid()) >= 2 then
    raise exception 'too_many_attempts';
  end if;
  update public.validations set receipt_path = p_receipt
   where id = p_validation and user_id = auth.uid() and proof_status = 'needs_review' and status = 'valid';
  if not found then
    raise exception 'nothing_to_resubmit';
  end if;
end;
$$;
revoke all on function public.resubmit_proof(uuid, text) from public;
grant execute on function public.resubmit_proof(uuid, text) to authenticated;

-- Journal des appels IA lancés par le serveur avec la clé de service (vérification des justificatifs).
create or replace function public.ai_log_service(
  p_company uuid, p_task text, p_prompt_version text, p_model text, p_status text,
  p_input_tokens integer default 0, p_output_tokens integer default 0, p_cache_read_tokens integer default 0,
  p_latency_ms integer default 0, p_cost_usd numeric default 0, p_error_code text default null)
returns void
language sql security definer set search_path = public
as $$
  insert into public.ai_calls (company_id, user_id, task, prompt_version, model, status, input_tokens, output_tokens,
                               cache_read_tokens, latency_ms, cost_usd, error_code)
  values (p_company, null, p_task, p_prompt_version, p_model, p_status, greatest(p_input_tokens, 0), greatest(p_output_tokens, 0),
          greatest(p_cache_read_tokens, 0), greatest(p_latency_ms, 0), greatest(p_cost_usd, 0), left(p_error_code, 80));
$$;
revoke all on function public.ai_log_service(uuid, text, text, text, text, integer, integer, integer, integer, numeric, text) from public, anon, authenticated;
grant execute on function public.ai_log_service(uuid, text, text, text, text, integer, integer, integer, integer, numeric, text) to service_role;
