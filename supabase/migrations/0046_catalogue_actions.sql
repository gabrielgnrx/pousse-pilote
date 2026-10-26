-- 0046 — Catalogue des actions du + (octobre 2026).
-- Fichier généré par scripts/generate-factors.ts depuis supabase/data/action_types.json : ne pas
-- modifier à la main. La saisie libre ne renvoie qu'un slug de cette table et une quantité ; la base
-- calcule le CO₂ avec avoided_kg, d'après la règle de référence et les facteurs listés. Les actions
-- retirées du catalogue restent en base, désactivées : l'historique garde son sens.

create table if not exists public.action_types (
  slug text primary key check (slug ~ '^[a-z0-9_]+$'),
  template_id text not null references public.challenge_templates,
  variant text not null,
  label text not null,
  kind text not null check (kind in ('count', 'distance')),
  unit text not null,
  min_quantity numeric not null check (min_quantity > 0),
  max_quantity numeric not null,
  reference_rule text not null,
  factors text[] not null default '{}',
  active boolean not null default true,
  check (max_quantity >= min_quantity)
);
alter table public.action_types enable row level security;
drop policy if exists "actions: lecture" on public.action_types;
create policy "actions: lecture" on public.action_types for select to authenticated using (true);

-- Le train se saisit en km (variante « km »), en plus des variantes 300, 500 et 800 km des raccourcis.
insert into public.action_types (slug, template_id, variant, label, kind, unit, min_quantity, max_quantity, reference_rule, factors)
values
  ('velo', 'velo', 'base', 'Trajet domicile-travail à vélo ou à pied', 'distance', 'km', 0.5, 80, 'trajet_declare', array['voiture_thermique', 'voiture_electrique', 'covoiturage_2', 'metro', 'rer', 'velo']),
  ('transports', 'transports', 'base', 'Trajet domicile-travail en métro, RER ou tram au lieu de la voiture', 'distance', 'km', 0.5, 80, 'trajet_declare_transports', array['voiture_thermique', 'voiture_electrique', 'covoiturage_2', 'metro', 'rer']),
  ('covoiturage', 'covoiturage', 'base', 'Trajet domicile-travail en covoiturage à deux', 'distance', 'km', 0.5, 80, 'trajet_declare_voiture_moitie', array['voiture_thermique', 'voiture_electrique']),
  ('teletravail', 'teletravail', 'base', 'Journée de télétravail', 'count', 'jour', 1, 1, 'aller_retour_declare', array['voiture_thermique', 'voiture_electrique', 'covoiturage_2', 'metro', 'rer']),
  ('train', 'train', 'km', 'Voyage en train au lieu de l''avion', 'distance', 'km', 50, 1500, 'avion_court', array['avion_court', 'tgv']),
  ('vacances_train', 'vacances_train', 'base', 'Vacances en train au lieu d''un vol long-courrier', 'count', 'aller-retour', 1, 1, 'avion_long_aller_retour', array['avion_moyen_long', 'tgv']),
  ('vege_repas', 'vege', 'repas', 'Repas végétarien', 'count', 'repas', 1, 2, 'repas_viande_declaree', array['repas_boeuf', 'repas_porc', 'repas_poulet', 'repas_poisson', 'repas_vegetarien']),
  ('vege_boeuf', 'vege', 'boeuf', 'Repas végétarien au lieu d''un repas au bœuf', 'count', 'repas', 1, 2, 'repas_boeuf', array['repas_boeuf', 'repas_vegetarien']),
  ('vege_autre', 'vege', 'autre', 'Repas végétarien au lieu d''un repas au porc, poulet ou poisson', 'count', 'repas', 1, 2, 'repas_autre_viande', array['repas_porc', 'repas_poulet', 'repas_poisson', 'repas_vegetarien']),
  ('moins_boeuf', 'moins_boeuf', 'base', 'Porc, poulet ou poisson au lieu du bœuf', 'count', 'repas', 1, 2, 'boeuf_vers_autre_viande', array['repas_boeuf', 'repas_porc', 'repas_poulet', 'repas_poisson']),
  ('vegetalien', 'vegetalien', 'base', 'Repas végétalien au lieu d''un repas végétarien', 'count', 'repas', 1, 2, 'vegetarien_vers_vegetalien', array['repas_vegetarien', 'repas_vegetalien']),
  ('eau_robinet', 'eau_robinet', 'base', 'Eau du robinet toute la journée au lieu d''eau en bouteille', 'count', 'jour', 1, 1, 'eau_bouteille_declaree', array['eau_bouteille', 'eau_robinet']),
  ('occasion_tshirt', 'occasion', 'tshirt', 'T-shirt d''occasion au lieu de neuf', 'count', 'article', 1, 3, 'article_neuf', array['tshirt_neuf']),
  ('occasion_chemise', 'occasion', 'chemise', 'Chemise d''occasion au lieu de neuve', 'count', 'article', 1, 3, 'article_neuf', array['chemise_neuve']),
  ('occasion_chaussures', 'occasion', 'chaussures', 'Chaussures en cuir d''occasion au lieu de neuves', 'count', 'article', 1, 3, 'article_neuf', array['chaussures_cuir_neuves']),
  ('occasion_jean', 'occasion', 'jean', 'Jean d''occasion au lieu de neuf', 'count', 'article', 1, 3, 'article_neuf', array['jean_neuf']),
  ('occasion_pull', 'occasion', 'pull', 'Pull en laine d''occasion au lieu de neuf', 'count', 'article', 1, 3, 'article_neuf', array['pull_laine_neuf']),
  ('occasion_manteau', 'occasion', 'manteau', 'Manteau d''occasion au lieu de neuf', 'count', 'article', 1, 3, 'article_neuf', array['manteau_neuf']),
  ('reparation_smartphone', 'reparation', 'smartphone', 'Smartphone réparé au lieu d''en racheter un neuf', 'count', 'appareil', 1, 1, 'appareil_neuf', array['smartphone_neuf']),
  ('reparation_ordinateur', 'reparation', 'ordinateur', 'Ordinateur, tablette ou console réparé au lieu de racheter neuf', 'count', 'appareil', 1, 1, 'appareil_neuf', array['ordinateur_portable_neuf']),
  ('chauffage', 'chauffage', 'base', 'Chauffage baissé de 1 °C cette semaine', 'count', 'semaine', 1, 1, 'chauffage_declare', array['chauffage_gaz', 'chauffage_fioul', 'chauffage_electrique', 'chauffage_pompe_a_chaleur', 'chauffage_reseau_de_chaleur', 'chauffage_poele_granules', 'chauffage_poele_buches', 'chauffage_chaudiere_granules', 'chauffage_chaudiere_buches']),
  ('appli_antigaspi', 'appli_antigaspi', 'base', 'Panier anti-gaspi récupéré via une appli (Too Good To Go…)', 'count', 'panier', 1, 1, 'aucun', '{}'::text[]),
  ('escaliers', 'escaliers', 'base', 'Escaliers plutôt que l''ascenseur', 'count', 'fois', 1, 1, 'aucun', '{}'::text[]),
  ('gourde', 'gourde', 'base', 'Gourde ou tasse au lieu d''un gobelet jetable', 'count', 'fois', 1, 1, 'aucun', '{}'::text[]),
  ('ecran', 'ecran', 'base', 'Ordinateur éteint en partant le soir', 'count', 'fois', 1, 1, 'aucun', '{}'::text[]),
  ('antigaspi', 'antigaspi', 'base', 'Repas anti-gaspi (restes ou invendus)', 'count', 'repas', 1, 1, 'aucun', '{}'::text[]),
  ('compost', 'compost', 'base', 'Déchets alimentaires au compost', 'count', 'fois', 1, 1, 'aucun', '{}'::text[]),
  ('ramassage', 'ramassage', 'base', 'Ramassage de déchets dans la nature ou la rue', 'count', 'fois', 1, 1, 'aucun', '{}'::text[]),
  ('sciences', 'sciences', 'base', 'Comptage pour un programme de sciences participatives', 'count', 'fois', 1, 1, 'aucun', '{}'::text[]),
  ('plantation', 'plantation', 'base', 'Plantation, nichoir ou coin de nature aménagé', 'count', 'fois', 1, 1, 'aucun', '{}'::text[])
on conflict (slug) do update set
  template_id = excluded.template_id, variant = excluded.variant, label = excluded.label, kind = excluded.kind,
  unit = excluded.unit, min_quantity = excluded.min_quantity, max_quantity = excluded.max_quantity,
  reference_rule = excluded.reference_rule, factors = excluded.factors, active = true;

update public.action_types set active = false
where slug not in ('velo', 'transports', 'covoiturage', 'teletravail', 'train', 'vacances_train', 'vege_repas', 'vege_boeuf', 'vege_autre', 'moins_boeuf', 'vegetalien', 'eau_robinet', 'occasion_tshirt', 'occasion_chemise', 'occasion_chaussures', 'occasion_jean', 'occasion_pull', 'occasion_manteau', 'reparation_smartphone', 'reparation_ordinateur', 'chauffage', 'appli_antigaspi', 'escaliers', 'gourde', 'ecran', 'antigaspi', 'compost', 'ramassage', 'sciences', 'plantation');

-- Chaque facteur cité doit exister dans emission_factors.
do $$
declare
  missing text;
begin
  select string_agg(distinct f, ', ') into missing
  from public.action_types a, unnest(a.factors) f
  where not exists (select 1 from public.emission_factors e where e.slug = f);
  if missing is not null then
    raise exception 'facteurs inconnus dans action_types : %', missing;
  end if;
end;
$$;
