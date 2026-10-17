-- Pousse · scanner de produits (données Open Food Facts, licence ODbL).
-- Scanner ne rapporte rien en CO₂ évité. Choisir une alternative mieux notée rapporte +5 pousses,
-- au plus 3 fois par jour, et compte comme un jour actif pour la série.

create table if not exists public.product_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  company_id uuid not null references public.companies,
  code text not null check (code ~ '^[0-9]{8,14}$'),
  name text check (char_length(name) <= 200),
  grade text,
  co2_kg_per_kg numeric check (co2_kg_per_kg >= 0),
  created_at timestamptz not null default now()
);
create index if not exists product_scans_user_idx on public.product_scans (user_id, created_at desc);

create table if not exists public.product_swaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  company_id uuid not null references public.companies,
  from_code text not null check (from_code ~ '^[0-9]{8,14}$'),
  to_code text not null check (to_code ~ '^[0-9]{8,14}$' and to_code <> from_code),
  from_grade text,
  to_grade text,
  from_co2 numeric,
  to_co2 numeric,
  created_at timestamptz not null default now()
);
create index if not exists product_swaps_user_idx on public.product_swaps (user_id, created_at desc);

alter table public.product_scans enable row level security;
alter table public.product_swaps enable row level security;

drop policy if exists "scans: les miens" on public.product_scans;
create policy "scans: les miens" on public.product_scans
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "scans: ajouter" on public.product_scans;
create policy "scans: ajouter" on public.product_scans
  for insert to authenticated with check (user_id = auth.uid() and company_id = public.my_company_id());
drop policy if exists "swaps: les miens" on public.product_swaps;
create policy "swaps: les miens" on public.product_swaps
  for select to authenticated using (user_id = auth.uid());

alter table public.points_ledger drop constraint if exists points_ledger_kind_check;
alter table public.points_ledger add constraint points_ledger_kind_check
  check (kind in ('maintien', 'influence', 'temoin', 'quete', 'serie', 'scan'));

-- Rang du Green-Score : A+ = 7 … F = 1, inconnu = 0 (identique à gradeRank dans src/lib/off/product.ts).
create or replace function public.grade_rank(g text)
returns integer
language sql immutable
as $$
  select case g when 'a-plus' then 7 when 'a' then 6 when 'b' then 5 when 'c' then 4
                when 'd' then 3 when 'e' then 2 when 'f' then 1 else 0 end
$$;

-- Choisir une alternative : seulement si elle est meilleure (note, ou même note et 10 % de CO₂ en moins),
-- 3 fois par jour au plus. Les notes viennent de la fiche lue par le serveur de l'application.
create or replace function public.record_swap(
  p_from_code text, p_to_code text,
  p_from_grade text, p_to_grade text,
  p_from_co2 numeric, p_to_co2 numeric)
returns jsonb
language plpgsql security definer set search_path = public
set timezone = 'Europe/Paris'
as $$
declare
  me public.profiles;
  today_count integer;
  s public.product_swaps;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'not_member';
  end if;
  -- Produit scanné non noté : seule une alternative A+, A ou B compte (identique à isBetter).
  if not (public.grade_rank(p_from_grade) = 0 and public.grade_rank(p_to_grade) >= 5
          or public.grade_rank(p_from_grade) > 0 and public.grade_rank(p_to_grade) > public.grade_rank(p_from_grade)
          or (public.grade_rank(p_from_grade) > 0 and public.grade_rank(p_to_grade) = public.grade_rank(p_from_grade)
              and p_to_co2 is not null and p_from_co2 is not null and p_to_co2 < p_from_co2 * 0.9)) then
    raise exception 'not_better';
  end if;
  if exists (select 1 from public.product_swaps where user_id = me.id and to_code = p_to_code
             and created_at::date = current_date) then
    raise exception 'already_swapped';
  end if;
  select count(*) into today_count from public.product_swaps
  where user_id = me.id and created_at::date = current_date;
  if today_count >= 3 then
    raise exception 'swap_cap';
  end if;

  insert into public.product_swaps (user_id, company_id, from_code, to_code, from_grade, to_grade, from_co2, to_co2)
  values (me.id, me.company_id, p_from_code, p_to_code, p_from_grade, p_to_grade, p_from_co2, p_to_co2)
  returning * into s;
  insert into public.points_ledger (user_id, company_id, kind, points, ref_id)
  values (me.id, me.company_id, 'scan', 5, s.id);

  return jsonb_build_object('points', 5, 'remaining', 2 - today_count);
end;
$$;
revoke all on function public.record_swap(text, text, text, text, numeric, numeric) from public;
grant execute on function public.record_swap(text, text, text, text, numeric, numeric) to authenticated;

-- Un meilleur choix au supermarché compte comme un jour actif pour la série.
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
$$;
revoke all on function public.active_days(uuid) from public;
