-- 0026 — Facteurs d'émission versionnés (v2, octobre 2026).
-- Fichier généré par scripts/generate-factors.ts depuis supabase/data/emission_factors.json : ne pas
-- modifier à la main. Une nouvelle version des facteurs s'ajoute dans une nouvelle migration (mêmes
-- slugs, autre version) ; ef() lit toujours la version la plus récente.
--
-- Règle d'or : le CO₂ est calculé par la base à partir de cette table, jamais par l'IA ni par le
-- navigateur. Une valeur inconnue reste nulle avec un TODO explicite, et ef() refuse de la servir.

create table if not exists public.emission_factors (
  id bigint generated always as identity primary key,
  slug text not null check (slug ~ '^[a-z0-9_]+$'),
  label text not null,
  category text not null check (category in ('transport', 'alimentation', 'consommation', 'energie')),
  unit text not null,
  kgco2e_per_unit numeric check (kgco2e_per_unit >= 0),
  source text not null check (source in ('base_empreinte', 'agribalyse', 'nos_gestes_climat')),
  source_ref text not null,
  version text not null,
  todo text,
  created_at timestamptz not null default now(),
  unique (slug, version),
  check (kgco2e_per_unit is not null or todo is not null)
);

alter table public.emission_factors enable row level security;
drop policy if exists "facteurs: lecture" on public.emission_factors;
create policy "facteurs: lecture" on public.emission_factors for select to authenticated, anon using (true);
-- Aucune écriture hors migration.

insert into public.emission_factors (slug, label, category, unit, kgco2e_per_unit, source, source_ref, version, todo)
values
  ('voiture_thermique', 'Voiture thermique (par personne)', 'transport', 'km', 0.1106, 'base_empreinte', 'Impact CO₂ (ADEME), outil Transport, impactco2.fr/outils/transport, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('voiture_electrique', 'Voiture électrique (par personne)', 'transport', 'km', 0.0121, 'base_empreinte', 'Impact CO₂ (ADEME), outil Transport, impactco2.fr/outils/transport, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('covoiturage_2', 'Voiture thermique, 2 passagers (par personne)', 'transport', 'km', 0.0553, 'base_empreinte', 'Impact CO₂ (ADEME), outil Transport, impactco2.fr/outils/transport, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('metro', 'Métro', 'transport', 'km', 0.0042, 'base_empreinte', 'Impact CO₂ (ADEME), outil Transport, impactco2.fr/outils/transport, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('rer', 'RER ou Transilien', 'transport', 'km', 0.0066, 'base_empreinte', 'Impact CO₂ (ADEME), outil Transport, impactco2.fr/outils/transport, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('tram', 'Tramway', 'transport', 'km', 0.0038, 'base_empreinte', 'Impact CO₂ (ADEME), outil Transport, impactco2.fr/outils/transport, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('bus_thermique', 'Bus thermique', 'transport', 'km', 0.1135, 'base_empreinte', 'Impact CO₂ (ADEME), outil Transport, impactco2.fr/outils/transport, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('velo', 'Vélo ou marche', 'transport', 'km', 0, 'base_empreinte', 'Impact CO₂ (ADEME), outil Transport, impactco2.fr/outils/transport, relevé le 15/10/2026 (0 à l''usage)', '2026-10-15', null),
  ('velo_electrique', 'Vélo à assistance électrique', 'transport', 'km', 0.0022, 'base_empreinte', 'Impact CO₂ (ADEME), outil Transport, impactco2.fr/outils/transport, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('tgv', 'TGV', 'transport', 'km', 0.0023, 'base_empreinte', 'Impact CO₂ (ADEME), outil Transport, impactco2.fr/outils/transport, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('avion_court', 'Avion court-courrier (avec traînées)', 'transport', 'km', 0.2242, 'base_empreinte', 'Impact CO₂ (ADEME), outil Transport, impactco2.fr/outils/transport, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('avion_moyen_long', 'Avion moyen et long-courrier (avec traînées)', 'transport', 'km', 0.1665, 'base_empreinte', 'Impact CO₂ (ADEME), outil Transport, impactco2.fr/outils/transport, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('repas_boeuf', 'Repas avec du bœuf', 'alimentation', 'repas', 4.97, 'agribalyse', 'Agribalyse 3.2 via Impact CO₂ (ADEME), outil Alimentation, impactco2.fr/outils/alimentation, relevé le 15/10/2026', '2026-10-15', 'Code Agribalyse du repas type à relever'),
  ('repas_veau', 'Repas avec du veau', 'alimentation', 'repas', 4.12, 'agribalyse', 'Agribalyse 3.2 via Impact CO₂ (ADEME), outil Alimentation, impactco2.fr/outils/alimentation, relevé le 15/10/2026', '2026-10-15', 'Code Agribalyse du repas type à relever'),
  ('repas_porc', 'Repas avec du porc', 'alimentation', 'repas', 1.65, 'agribalyse', 'Agribalyse 3.2 via Impact CO₂ (ADEME), outil Alimentation, impactco2.fr/outils/alimentation, relevé le 15/10/2026', '2026-10-15', 'Code Agribalyse du repas type à relever'),
  ('repas_poulet', 'Repas avec du poulet', 'alimentation', 'repas', 1.46, 'agribalyse', 'Agribalyse 3.2 via Impact CO₂ (ADEME), outil Alimentation, impactco2.fr/outils/alimentation, relevé le 15/10/2026', '2026-10-15', 'Code Agribalyse du repas type à relever'),
  ('repas_poisson', 'Repas avec du poisson (saumon)', 'alimentation', 'repas', 1.46, 'agribalyse', 'Agribalyse 3.2 via Impact CO₂ (ADEME), outil Alimentation, impactco2.fr/outils/alimentation, relevé le 15/10/2026', '2026-10-15', 'Code Agribalyse du repas type à relever'),
  ('repas_vegetarien', 'Repas végétarien', 'alimentation', 'repas', 0.85, 'agribalyse', 'Agribalyse 3.2 via Impact CO₂ (ADEME), outil Alimentation, impactco2.fr/outils/alimentation, relevé le 15/10/2026', '2026-10-15', 'Code Agribalyse du repas type à relever'),
  ('repas_vegetalien', 'Repas végétalien', 'alimentation', 'repas', 0.54, 'agribalyse', 'Agribalyse 3.2 via Impact CO₂ (ADEME), outil Alimentation, impactco2.fr/outils/alimentation, relevé le 15/10/2026', '2026-10-15', 'Code Agribalyse du repas type à relever'),
  ('eau_bouteille', 'Eau en bouteille', 'alimentation', 'L', 0.32, 'agribalyse', 'Agribalyse 3.2 via Impact CO₂ (ADEME), outil Boisson, impactco2.fr/outils/boisson, relevé le 20/10/2026', '2026-10-15', 'Code Agribalyse à relever'),
  ('eau_robinet', 'Eau du robinet', 'alimentation', 'L', 0, 'agribalyse', 'Agribalyse 3.2 via Impact CO₂ (ADEME), outil Boisson, impactco2.fr/outils/boisson, relevé le 20/10/2026 (arrondi à 0)', '2026-10-15', 'Valeur exacte non arrondie à relever'),
  ('tshirt_neuf', 'T-shirt neuf', 'consommation', 'article', 6.43, 'base_empreinte', 'Impact CO₂ (ADEME), outil Habillement, impactco2.fr/outils/habillement, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('chemise_neuve', 'Chemise neuve', 'consommation', 'article', 13.2, 'base_empreinte', 'Impact CO₂ (ADEME), outil Habillement, impactco2.fr/outils/habillement, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('chaussures_cuir_neuves', 'Chaussures en cuir neuves', 'consommation', 'article', 15, 'base_empreinte', 'Impact CO₂ (ADEME), outil Habillement, impactco2.fr/outils/habillement, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('jean_neuf', 'Jean neuf', 'consommation', 'article', 25.1, 'base_empreinte', 'Impact CO₂ (ADEME), outil Habillement, impactco2.fr/outils/habillement, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('pull_laine_neuf', 'Pull en laine neuf', 'consommation', 'article', 56.7, 'base_empreinte', 'Impact CO₂ (ADEME), outil Habillement, impactco2.fr/outils/habillement, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('manteau_neuf', 'Manteau neuf', 'consommation', 'article', 101, 'base_empreinte', 'Impact CO₂ (ADEME), outil Habillement, impactco2.fr/outils/habillement, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('smartphone_neuf', 'Smartphone neuf (fabrication et usage)', 'consommation', 'appareil', 80.2, 'base_empreinte', 'Impact CO₂ (ADEME), outil Numérique, impactco2.fr/outils/numerique, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('ordinateur_portable_neuf', 'Ordinateur portable neuf (fabrication et usage)', 'consommation', 'appareil', 193, 'base_empreinte', 'Impact CO₂ (ADEME), outil Numérique, impactco2.fr/outils/numerique, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('television_neuve', 'Télévision neuve (fabrication et usage)', 'consommation', 'appareil', 370, 'base_empreinte', 'Impact CO₂ (ADEME), outil Numérique, impactco2.fr/outils/numerique, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('chauffage_gaz', 'Chauffage au gaz', 'energie', 'm2_an', 17.84, 'base_empreinte', 'Impact CO₂ (ADEME), outil Chauffage, impactco2.fr/outils/chauffage, valeur pour 100 m² divisée par 100, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('chauffage_fioul', 'Chauffage au fioul', 'energie', 'm2_an', 34.97, 'base_empreinte', 'Impact CO₂ (ADEME), outil Chauffage, impactco2.fr/outils/chauffage, valeur pour 100 m² divisée par 100, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('chauffage_electrique', 'Chauffage électrique', 'energie', 'm2_an', 2.14, 'base_empreinte', 'Impact CO₂ (ADEME), outil Chauffage, impactco2.fr/outils/chauffage, valeur pour 100 m² divisée par 100, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('chauffage_pompe_a_chaleur', 'Pompe à chaleur', 'energie', 'm2_an', 1.21, 'base_empreinte', 'Impact CO₂ (ADEME), outil Chauffage, impactco2.fr/outils/chauffage, valeur pour 100 m² divisée par 100, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('chauffage_reseau_de_chaleur', 'Réseau de chaleur', 'energie', 'm2_an', 11.08, 'base_empreinte', 'Impact CO₂ (ADEME), outil Chauffage, impactco2.fr/outils/chauffage, valeur pour 100 m² divisée par 100, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('chauffage_poele_granules', 'Poêle à granulés', 'energie', 'm2_an', 5.92, 'base_empreinte', 'Impact CO₂ (ADEME), outil Chauffage, impactco2.fr/outils/chauffage, valeur pour 100 m² divisée par 100, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('chauffage_poele_buches', 'Poêle à bûches', 'energie', 'm2_an', 8.51, 'base_empreinte', 'Impact CO₂ (ADEME), outil Chauffage, impactco2.fr/outils/chauffage, valeur pour 100 m² divisée par 100, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('chauffage_chaudiere_granules', 'Chaudière à granulés', 'energie', 'm2_an', 3.96, 'base_empreinte', 'Impact CO₂ (ADEME), outil Chauffage, impactco2.fr/outils/chauffage, valeur pour 100 m² divisée par 100, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever'),
  ('chauffage_chaudiere_buches', 'Chaudière à bûches', 'energie', 'm2_an', 5.7, 'base_empreinte', 'Impact CO₂ (ADEME), outil Chauffage, impactco2.fr/outils/chauffage, valeur pour 100 m² divisée par 100, relevé le 15/10/2026', '2026-10-15', 'Identifiant Base Empreinte à relever')
on conflict (slug, version) do update set
  label = excluded.label, category = excluded.category, unit = excluded.unit,
  kgco2e_per_unit = excluded.kgco2e_per_unit, source = excluded.source,
  source_ref = excluded.source_ref, todo = excluded.todo;

-- La valeur en vigueur d'un facteur (version la plus récente). Erreur si inconnu ou sans valeur.
create or replace function public.ef(p_slug text)
returns numeric
language plpgsql stable
set search_path = public
as $$
declare
  v numeric;
  found_row boolean;
begin
  select true, f.kgco2e_per_unit into found_row, v
  from public.emission_factors f
  where f.slug = p_slug
  order by f.version desc
  limit 1;
  if found_row is null then
    raise exception 'unknown_factor:%', p_slug;
  end if;
  if v is null then
    raise exception 'factor_without_value:%', p_slug;
  end if;
  return v;
end;
$$;
grant execute on function public.ef(text) to authenticated;
