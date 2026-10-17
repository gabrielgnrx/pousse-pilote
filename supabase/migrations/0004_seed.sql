-- Catalogue des défis (doit correspondre à src/lib/co2/challenges.ts).
insert into public.challenge_templates (id, category, title, points_per_unit, cap_group, cap_units, cap_window_days) values
  ('velo',        'transport',    'Vélo au lieu de la voiture',               12, 'domicile_travail', 2, 1),
  ('transports',  'transport',    'Métro ou RER au lieu de la voiture',       10, 'domicile_travail', 2, 1),
  ('covoiturage', 'transport',    'Covoiturer à deux au lieu de rouler seul', 12, 'domicile_travail', 2, 1),
  ('train',       'transport',    'Train au lieu de l''avion',                40, 'train',            2, 1),
  ('vege',        'alimentation', 'Repas végétarien',                         10, 'repas',            2, 1),
  ('moins_boeuf', 'alimentation', 'Porc, poulet ou poisson au lieu du bœuf',   8, 'repas',            2, 1),
  ('occasion',    'consommation', 'Vêtement d''occasion au lieu de neuf',     30, 'vetements',        3, 1),
  ('chauffage',   'logement',     'Chauffage baissé de 1 °C',                 20, 'chauffage',        1, 7)
on conflict (id) do update set
  category = excluded.category,
  title = excluded.title,
  points_per_unit = excluded.points_per_unit,
  cap_group = excluded.cap_group,
  cap_units = excluded.cap_units,
  cap_window_days = excluded.cap_window_days;

-- Entreprise de démonstration (code DEMO-2026, tout domaine e-mail accepté).
with c as (
  insert into public.companies (name, join_code, email_domain)
  values ('Entreprise démo', 'DEMO-2026', null)
  on conflict (join_code) do update set name = excluded.name
  returning id
)
insert into public.teams (company_id, name)
select c.id, t.name from c,
  (values ('Data'), ('Produit'), ('Finance'), ('Ventes'), ('RH'), ('Opérations')) as t(name)
on conflict (company_id, name) do nothing;
