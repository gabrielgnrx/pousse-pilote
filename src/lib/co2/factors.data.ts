// Fichier généré par scripts/generate-factors.ts depuis supabase/data/emission_factors.json.
// Ne pas modifier à la main : modifier le JSON, puis lancer node scripts/generate-factors.ts.

export const FACTORS_VERSION = "2026-10-15";

export const FACTOR_DATA = {
  voiture_thermique: { label: "Voiture thermique (par personne)", category: "transport", unit: "km", kg: 0.1106, source: "base_empreinte" },
  voiture_electrique: { label: "Voiture électrique (par personne)", category: "transport", unit: "km", kg: 0.0121, source: "base_empreinte" },
  covoiturage_2: { label: "Voiture thermique, 2 passagers (par personne)", category: "transport", unit: "km", kg: 0.0553, source: "base_empreinte" },
  metro: { label: "Métro", category: "transport", unit: "km", kg: 0.0042, source: "base_empreinte" },
  rer: { label: "RER ou Transilien", category: "transport", unit: "km", kg: 0.0066, source: "base_empreinte" },
  tram: { label: "Tramway", category: "transport", unit: "km", kg: 0.0038, source: "base_empreinte" },
  bus_thermique: { label: "Bus thermique", category: "transport", unit: "km", kg: 0.1135, source: "base_empreinte" },
  velo: { label: "Vélo ou marche", category: "transport", unit: "km", kg: 0, source: "base_empreinte" },
  velo_electrique: { label: "Vélo à assistance électrique", category: "transport", unit: "km", kg: 0.0022, source: "base_empreinte" },
  tgv: { label: "TGV", category: "transport", unit: "km", kg: 0.0023, source: "base_empreinte" },
  avion_court: { label: "Avion court-courrier (avec traînées)", category: "transport", unit: "km", kg: 0.2242, source: "base_empreinte" },
  avion_moyen_long: { label: "Avion moyen et long-courrier (avec traînées)", category: "transport", unit: "km", kg: 0.1665, source: "base_empreinte" },
  repas_boeuf: { label: "Repas avec du bœuf", category: "alimentation", unit: "repas", kg: 4.97, source: "agribalyse" },
  repas_veau: { label: "Repas avec du veau", category: "alimentation", unit: "repas", kg: 4.12, source: "agribalyse" },
  repas_porc: { label: "Repas avec du porc", category: "alimentation", unit: "repas", kg: 1.65, source: "agribalyse" },
  repas_poulet: { label: "Repas avec du poulet", category: "alimentation", unit: "repas", kg: 1.46, source: "agribalyse" },
  repas_poisson: { label: "Repas avec du poisson (saumon)", category: "alimentation", unit: "repas", kg: 1.46, source: "agribalyse" },
  repas_vegetarien: { label: "Repas végétarien", category: "alimentation", unit: "repas", kg: 0.85, source: "agribalyse" },
  repas_vegetalien: { label: "Repas végétalien", category: "alimentation", unit: "repas", kg: 0.54, source: "agribalyse" },
  eau_bouteille: { label: "Eau en bouteille", category: "alimentation", unit: "L", kg: 0.32, source: "agribalyse" },
  eau_robinet: { label: "Eau du robinet", category: "alimentation", unit: "L", kg: 0, source: "agribalyse" },
  tshirt_neuf: { label: "T-shirt neuf", category: "consommation", unit: "article", kg: 6.43, source: "base_empreinte" },
  chemise_neuve: { label: "Chemise neuve", category: "consommation", unit: "article", kg: 13.2, source: "base_empreinte" },
  chaussures_cuir_neuves: { label: "Chaussures en cuir neuves", category: "consommation", unit: "article", kg: 15, source: "base_empreinte" },
  jean_neuf: { label: "Jean neuf", category: "consommation", unit: "article", kg: 25.1, source: "base_empreinte" },
  pull_laine_neuf: { label: "Pull en laine neuf", category: "consommation", unit: "article", kg: 56.7, source: "base_empreinte" },
  manteau_neuf: { label: "Manteau neuf", category: "consommation", unit: "article", kg: 101, source: "base_empreinte" },
  smartphone_neuf: { label: "Smartphone neuf (fabrication et usage)", category: "consommation", unit: "appareil", kg: 80.2, source: "base_empreinte" },
  ordinateur_portable_neuf: { label: "Ordinateur portable neuf (fabrication et usage)", category: "consommation", unit: "appareil", kg: 193, source: "base_empreinte" },
  television_neuve: { label: "Télévision neuve (fabrication et usage)", category: "consommation", unit: "appareil", kg: 370, source: "base_empreinte" },
  chauffage_gaz: { label: "Chauffage au gaz", category: "energie", unit: "m2_an", kg: 17.84, source: "base_empreinte" },
  chauffage_fioul: { label: "Chauffage au fioul", category: "energie", unit: "m2_an", kg: 34.97, source: "base_empreinte" },
  chauffage_electrique: { label: "Chauffage électrique", category: "energie", unit: "m2_an", kg: 2.14, source: "base_empreinte" },
  chauffage_pompe_a_chaleur: { label: "Pompe à chaleur", category: "energie", unit: "m2_an", kg: 1.21, source: "base_empreinte" },
  chauffage_reseau_de_chaleur: { label: "Réseau de chaleur", category: "energie", unit: "m2_an", kg: 11.08, source: "base_empreinte" },
  chauffage_poele_granules: { label: "Poêle à granulés", category: "energie", unit: "m2_an", kg: 5.92, source: "base_empreinte" },
  chauffage_poele_buches: { label: "Poêle à bûches", category: "energie", unit: "m2_an", kg: 8.51, source: "base_empreinte" },
  chauffage_chaudiere_granules: { label: "Chaudière à granulés", category: "energie", unit: "m2_an", kg: 3.96, source: "base_empreinte" },
  chauffage_chaudiere_buches: { label: "Chaudière à bûches", category: "energie", unit: "m2_an", kg: 5.7, source: "base_empreinte" },
} as const;

export type FactorSlug = keyof typeof FACTOR_DATA;
