-- Sécurité ligne à ligne : chacun ne voit que son entreprise, et n'écrit que ses propres données.
-- Les validations ne s'écrivent que par validate_challenge_day (pas de politique d'insertion).

alter table public.companies enable row level security;
alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.footprints enable row level security;
alter table public.habits enable row level security;
alter table public.challenge_templates enable row level security;
alter table public.user_challenges enable row level security;
alter table public.validations enable row level security;
alter table public.cheers enable row level security;
alter table public.reports enable row level security;
alter table public.feedback enable row level security;

-- Entreprise et équipes : lecture de la sienne uniquement.
create policy "companies: la mienne" on public.companies
  for select to authenticated using (id = public.my_company_id());
create policy "teams: de mon entreprise" on public.teams
  for select to authenticated using (company_id = public.my_company_id());

-- Profils : mes collègues voient mon nom et mon équipe ; je modifie le mien.
create policy "profiles: collègues" on public.profiles
  for select to authenticated using (company_id = public.my_company_id());
create policy "profiles: modifier le mien" on public.profiles
  for update to authenticated using (id = auth.uid())
  with check (id = auth.uid() and company_id = public.my_company_id());

-- Bilans et habitudes : strictement personnels.
create policy "footprints: les miens" on public.footprints
  for select to authenticated using (user_id = auth.uid());
create policy "footprints: ajouter" on public.footprints
  for insert to authenticated with check (user_id = auth.uid());
create policy "habits: les miennes" on public.habits
  for select to authenticated using (user_id = auth.uid());
create policy "habits: créer" on public.habits
  for insert to authenticated with check (user_id = auth.uid());
create policy "habits: modifier" on public.habits
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Catalogue : lisible par tous les connectés.
create policy "templates: lecture" on public.challenge_templates
  for select to authenticated using (active);

-- Défis : les miens.
create policy "challenges: les miens" on public.user_challenges
  for select to authenticated using (user_id = auth.uid());
create policy "challenges: créer" on public.user_challenges
  for insert to authenticated
  with check (user_id = auth.uid() and company_id = public.my_company_id() and status = 'active');
create policy "challenges: abandonner" on public.user_challenges
  for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid() and status in ('active', 'abandoned'));

-- Validations : les miennes, celles où je suis témoin, et le fil de mon entreprise.
create policy "validations: lecture" on public.validations
  for select to authenticated using (
    user_id = auth.uid()
    or witness_id = auth.uid()
    or (visibility = 'company' and status = 'valid' and company_id = public.my_company_id())
  );

-- Bravos : visibles dans l'entreprise, un par personne et par publication visible.
create policy "cheers: lecture" on public.cheers
  for select to authenticated using (
    exists (select 1 from public.validations v where v.id = validation_id)
  );
create policy "cheers: ajouter" on public.cheers
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.validations v
                where v.id = validation_id and v.visibility = 'company')
  );
create policy "cheers: retirer" on public.cheers
  for delete to authenticated using (user_id = auth.uid());

-- Signalements : je vois les miens ; l'équipe Pousse les traite avec la clé de service.
create policy "reports: les miens" on public.reports
  for select to authenticated using (user_id = auth.uid());
create policy "reports: ajouter" on public.reports
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.validations v
                where v.id = validation_id and v.visibility = 'company')
  );

-- Questionnaire : écriture seule, lu uniquement par l'équipe Pousse.
create policy "feedback: répondre" on public.feedback
  for insert to authenticated with check (
    user_id = auth.uid() and company_id = public.my_company_id()
  );

-- Photos de preuve ---------------------------------------------------------
-- Rangées sous proofs/<id utilisateur>/... ; lisibles par l'auteur, le témoin,
-- et les collègues quand la publication est visible dans le fil.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "proofs: déposer dans mon dossier" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "proofs: supprimer les miennes" on storage.objects
  for delete to authenticated using (
    bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "proofs: lecture" on storage.objects
  for select to authenticated using (
    bucket_id = 'proofs' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.validations v where v.proof_photo_path = name)
    )
  );
