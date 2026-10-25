// Fichier généré par scripts/generate-factors.ts depuis supabase/data/action_types.json.
// Ne pas modifier à la main : modifier le JSON, puis lancer node scripts/generate-factors.ts.

export interface ActionType {
  slug: string;
  template: string;
  variant: string;
  label: string;
  kind: "count" | "distance";
  unit: string;
  min: number;
  max: number;
  referenceRule: string;
  factors: readonly string[];
  aliases: readonly string[];
}

export const REFERENCE_RULES: Record<string, string> = {
  "trajet_declare": "Trajet domicile-travail du bilan : mode déclaré × km, plafonné aux km déclarés. 0 kg si le mode déclaré n'émet rien.",
  "trajet_declare_transports": "Trajet domicile-travail du bilan, moins le métro ou le RER (moyenne des deux). 0 kg si le mode déclaré émet déjà moins.",
  "trajet_declare_voiture_moitie": "Trajet domicile-travail en voiture déclaré, divisé par deux (un passager de plus). 0 kg sans voiture déclarée.",
  "aller_retour_declare": "Aller-retour domicile-travail du bilan évité (2 trajets). 0 kg si le mode déclaré n'émet rien.",
  "avion_court": "Avion court-courrier moins TGV, sur la distance saisie. 0 kg sans vol court déclaré.",
  "avion_long_aller_retour": "Aller-retour long-courrier (12 000 km) moins 2 000 km de TGV. 0 kg sans vol long-courrier déclaré.",
  "repas_boeuf": "Repas au bœuf moins repas végétarien. 0 kg sans bœuf déclaré.",
  "repas_autre_viande": "Repas porc, poulet ou poisson (moyenne des trois) moins repas végétarien. 0 kg sans ces viandes déclarées.",
  "boeuf_vers_autre_viande": "Repas au bœuf moins repas porc, poulet ou poisson. 0 kg sans bœuf déclaré.",
  "vegetarien_vers_vegetalien": "Repas végétarien moins repas végétalien. 0 kg sans repas végétarien déclaré.",
  "eau_bouteille_declaree": "Eau en bouteille déclarée par jour × facteur de l'eau en bouteille. 0 kg sans eau en bouteille déclarée.",
  "article_neuf": "Fabrication d'un article neuf évitée. 0 kg sans achats neufs déclarés.",
  "appareil_neuf": "Fabrication d'un appareil neuf évitée. 0 kg sans achats d'appareils neufs déclarés.",
  "chauffage_declare": "Chauffage annuel déclaré × 7 % ÷ 30 semaines de chauffe. 0 kg sans chauffage déclaré.",
  "aucun": "Pas de CO₂ mesurable : l'action rapporte des pousses et compte pour la série."
};

export const ACTION_TYPES: readonly ActionType[] = [
  {
    "slug": "velo",
    "template": "velo",
    "variant": "base",
    "label": "Trajet domicile-travail à vélo ou à pied",
    "kind": "distance",
    "unit": "km",
    "min": 0.5,
    "max": 80,
    "referenceRule": "trajet_declare",
    "factors": [
      "voiture_thermique",
      "voiture_electrique",
      "covoiturage_2",
      "metro",
      "rer",
      "velo"
    ],
    "aliases": [
      "vélo",
      "à pied",
      "marche",
      "trottinette",
      "vélotaf"
    ]
  },
  {
    "slug": "transports",
    "template": "transports",
    "variant": "base",
    "label": "Trajet domicile-travail en métro, RER ou tram au lieu de la voiture",
    "kind": "distance",
    "unit": "km",
    "min": 0.5,
    "max": 80,
    "referenceRule": "trajet_declare_transports",
    "factors": [
      "voiture_thermique",
      "voiture_electrique",
      "covoiturage_2",
      "metro",
      "rer"
    ],
    "aliases": [
      "métro",
      "RER",
      "tram",
      "transports en commun",
      "Transilien"
    ]
  },
  {
    "slug": "covoiturage",
    "template": "covoiturage",
    "variant": "base",
    "label": "Trajet domicile-travail en covoiturage à deux",
    "kind": "distance",
    "unit": "km",
    "min": 0.5,
    "max": 80,
    "referenceRule": "trajet_declare_voiture_moitie",
    "factors": [
      "voiture_thermique",
      "voiture_electrique"
    ],
    "aliases": [
      "covoiturage",
      "covoit",
      "à deux en voiture"
    ]
  },
  {
    "slug": "teletravail",
    "template": "teletravail",
    "variant": "base",
    "label": "Journée de télétravail",
    "kind": "count",
    "unit": "jour",
    "min": 1,
    "max": 1,
    "referenceRule": "aller_retour_declare",
    "factors": [
      "voiture_thermique",
      "voiture_electrique",
      "covoiturage_2",
      "metro",
      "rer"
    ],
    "aliases": [
      "télétravail",
      "TT",
      "remote",
      "à la maison"
    ]
  },
  {
    "slug": "train",
    "template": "train",
    "variant": "km",
    "label": "Voyage en train au lieu de l'avion",
    "kind": "distance",
    "unit": "km",
    "min": 50,
    "max": 1500,
    "referenceRule": "avion_court",
    "factors": [
      "avion_court",
      "tgv"
    ],
    "aliases": [
      "train",
      "TGV",
      "Intercités",
      "au lieu de l'avion"
    ]
  },
  {
    "slug": "vacances_train",
    "template": "vacances_train",
    "variant": "base",
    "label": "Vacances en train au lieu d'un vol long-courrier",
    "kind": "count",
    "unit": "aller-retour",
    "min": 1,
    "max": 1,
    "referenceRule": "avion_long_aller_retour",
    "factors": [
      "avion_moyen_long",
      "tgv"
    ],
    "aliases": [
      "vacances en train",
      "pas d'avion pour les vacances"
    ]
  },
  {
    "slug": "vege_boeuf",
    "template": "vege",
    "variant": "boeuf",
    "label": "Repas végétarien au lieu d'un repas au bœuf",
    "kind": "count",
    "unit": "repas",
    "min": 1,
    "max": 2,
    "referenceRule": "repas_boeuf",
    "factors": [
      "repas_boeuf",
      "repas_vegetarien"
    ],
    "aliases": [
      "végé au lieu du bœuf",
      "pas de steak"
    ]
  },
  {
    "slug": "vege_autre",
    "template": "vege",
    "variant": "autre",
    "label": "Repas végétarien au lieu d'un repas au porc, poulet ou poisson",
    "kind": "count",
    "unit": "repas",
    "min": 1,
    "max": 2,
    "referenceRule": "repas_autre_viande",
    "factors": [
      "repas_porc",
      "repas_poulet",
      "repas_poisson",
      "repas_vegetarien"
    ],
    "aliases": [
      "végé",
      "végétarien",
      "veggie",
      "sans viande"
    ]
  },
  {
    "slug": "moins_boeuf",
    "template": "moins_boeuf",
    "variant": "base",
    "label": "Porc, poulet ou poisson au lieu du bœuf",
    "kind": "count",
    "unit": "repas",
    "min": 1,
    "max": 2,
    "referenceRule": "boeuf_vers_autre_viande",
    "factors": [
      "repas_boeuf",
      "repas_porc",
      "repas_poulet",
      "repas_poisson"
    ],
    "aliases": [
      "poulet au lieu du bœuf",
      "moins de bœuf"
    ]
  },
  {
    "slug": "vegetalien",
    "template": "vegetalien",
    "variant": "base",
    "label": "Repas végétalien au lieu d'un repas végétarien",
    "kind": "count",
    "unit": "repas",
    "min": 1,
    "max": 2,
    "referenceRule": "vegetarien_vers_vegetalien",
    "factors": [
      "repas_vegetarien",
      "repas_vegetalien"
    ],
    "aliases": [
      "vegan",
      "végétalien",
      "100 % végétal"
    ]
  },
  {
    "slug": "eau_robinet",
    "template": "eau_robinet",
    "variant": "base",
    "label": "Eau du robinet toute la journée au lieu d'eau en bouteille",
    "kind": "count",
    "unit": "jour",
    "min": 1,
    "max": 1,
    "referenceRule": "eau_bouteille_declaree",
    "factors": [
      "eau_bouteille",
      "eau_robinet"
    ],
    "aliases": [
      "gourde d'eau du robinet",
      "carafe",
      "pas de bouteille d'eau"
    ]
  },
  {
    "slug": "occasion_tshirt",
    "template": "occasion",
    "variant": "tshirt",
    "label": "T-shirt d'occasion au lieu de neuf",
    "kind": "count",
    "unit": "article",
    "min": 1,
    "max": 3,
    "referenceRule": "article_neuf",
    "factors": [
      "tshirt_neuf"
    ],
    "aliases": [
      "t-shirt seconde main",
      "friperie"
    ]
  },
  {
    "slug": "occasion_chemise",
    "template": "occasion",
    "variant": "chemise",
    "label": "Chemise d'occasion au lieu de neuve",
    "kind": "count",
    "unit": "article",
    "min": 1,
    "max": 3,
    "referenceRule": "article_neuf",
    "factors": [
      "chemise_neuve"
    ],
    "aliases": [
      "chemise seconde main"
    ]
  },
  {
    "slug": "occasion_chaussures",
    "template": "occasion",
    "variant": "chaussures",
    "label": "Chaussures en cuir d'occasion au lieu de neuves",
    "kind": "count",
    "unit": "article",
    "min": 1,
    "max": 3,
    "referenceRule": "article_neuf",
    "factors": [
      "chaussures_cuir_neuves"
    ],
    "aliases": [
      "chaussures seconde main"
    ]
  },
  {
    "slug": "occasion_jean",
    "template": "occasion",
    "variant": "jean",
    "label": "Jean d'occasion au lieu de neuf",
    "kind": "count",
    "unit": "article",
    "min": 1,
    "max": 3,
    "referenceRule": "article_neuf",
    "factors": [
      "jean_neuf"
    ],
    "aliases": [
      "jean seconde main"
    ]
  },
  {
    "slug": "occasion_pull",
    "template": "occasion",
    "variant": "pull",
    "label": "Pull en laine d'occasion au lieu de neuf",
    "kind": "count",
    "unit": "article",
    "min": 1,
    "max": 3,
    "referenceRule": "article_neuf",
    "factors": [
      "pull_laine_neuf"
    ],
    "aliases": [
      "pull seconde main"
    ]
  },
  {
    "slug": "occasion_manteau",
    "template": "occasion",
    "variant": "manteau",
    "label": "Manteau d'occasion au lieu de neuf",
    "kind": "count",
    "unit": "article",
    "min": 1,
    "max": 3,
    "referenceRule": "article_neuf",
    "factors": [
      "manteau_neuf"
    ],
    "aliases": [
      "manteau seconde main"
    ]
  },
  {
    "slug": "reparation_smartphone",
    "template": "reparation",
    "variant": "smartphone",
    "label": "Smartphone réparé au lieu d'en racheter un neuf",
    "kind": "count",
    "unit": "appareil",
    "min": 1,
    "max": 1,
    "referenceRule": "appareil_neuf",
    "factors": [
      "smartphone_neuf"
    ],
    "aliases": [
      "écran de téléphone réparé",
      "batterie changée"
    ]
  },
  {
    "slug": "reparation_ordinateur",
    "template": "reparation",
    "variant": "ordinateur",
    "label": "Ordinateur, tablette ou console réparé au lieu de racheter neuf",
    "kind": "count",
    "unit": "appareil",
    "min": 1,
    "max": 1,
    "referenceRule": "appareil_neuf",
    "factors": [
      "ordinateur_portable_neuf"
    ],
    "aliases": [
      "ordi réparé",
      "console réparée"
    ]
  },
  {
    "slug": "chauffage",
    "template": "chauffage",
    "variant": "base",
    "label": "Chauffage baissé de 1 °C cette semaine",
    "kind": "count",
    "unit": "semaine",
    "min": 1,
    "max": 1,
    "referenceRule": "chauffage_declare",
    "factors": [
      "chauffage_gaz",
      "chauffage_fioul",
      "chauffage_electrique",
      "chauffage_pompe_a_chaleur",
      "chauffage_reseau_de_chaleur",
      "chauffage_poele_granules",
      "chauffage_poele_buches",
      "chauffage_chaudiere_granules",
      "chauffage_chaudiere_buches"
    ],
    "aliases": [
      "thermostat baissé",
      "19 degrés"
    ]
  },
  {
    "slug": "appli_antigaspi",
    "template": "appli_antigaspi",
    "variant": "base",
    "label": "Panier anti-gaspi récupéré via une appli (Too Good To Go…)",
    "kind": "count",
    "unit": "panier",
    "min": 1,
    "max": 1,
    "referenceRule": "aucun",
    "factors": [],
    "aliases": [
      "Too Good To Go",
      "Phenix",
      "panier invendus"
    ]
  },
  {
    "slug": "escaliers",
    "template": "escaliers",
    "variant": "base",
    "label": "Escaliers plutôt que l'ascenseur",
    "kind": "count",
    "unit": "fois",
    "min": 1,
    "max": 1,
    "referenceRule": "aucun",
    "factors": [],
    "aliases": [
      "escaliers"
    ]
  },
  {
    "slug": "gourde",
    "template": "gourde",
    "variant": "base",
    "label": "Gourde ou tasse au lieu d'un gobelet jetable",
    "kind": "count",
    "unit": "fois",
    "min": 1,
    "max": 1,
    "referenceRule": "aucun",
    "factors": [],
    "aliases": [
      "mug",
      "tasse",
      "pas de gobelet"
    ]
  },
  {
    "slug": "ecran",
    "template": "ecran",
    "variant": "base",
    "label": "Ordinateur éteint en partant le soir",
    "kind": "count",
    "unit": "fois",
    "min": 1,
    "max": 1,
    "referenceRule": "aucun",
    "factors": [],
    "aliases": [
      "PC éteint",
      "écran éteint"
    ]
  },
  {
    "slug": "antigaspi",
    "template": "antigaspi",
    "variant": "base",
    "label": "Repas anti-gaspi (restes ou invendus)",
    "kind": "count",
    "unit": "repas",
    "min": 1,
    "max": 1,
    "referenceRule": "aucun",
    "factors": [],
    "aliases": [
      "restes",
      "anti-gaspi"
    ]
  },
  {
    "slug": "compost",
    "template": "compost",
    "variant": "base",
    "label": "Déchets alimentaires au compost",
    "kind": "count",
    "unit": "fois",
    "min": 1,
    "max": 1,
    "referenceRule": "aucun",
    "factors": [],
    "aliases": [
      "compost",
      "lombricomposteur"
    ]
  },
  {
    "slug": "ramassage",
    "template": "ramassage",
    "variant": "base",
    "label": "Ramassage de déchets dans la nature ou la rue",
    "kind": "count",
    "unit": "fois",
    "min": 1,
    "max": 1,
    "referenceRule": "aucun",
    "factors": [],
    "aliases": [
      "clean walk",
      "ramassage de déchets"
    ]
  },
  {
    "slug": "sciences",
    "template": "sciences",
    "variant": "base",
    "label": "Comptage pour un programme de sciences participatives",
    "kind": "count",
    "unit": "fois",
    "min": 1,
    "max": 1,
    "referenceRule": "aucun",
    "factors": [],
    "aliases": [
      "comptage d'oiseaux",
      "Vigie-Nature"
    ]
  },
  {
    "slug": "plantation",
    "template": "plantation",
    "variant": "base",
    "label": "Plantation, nichoir ou coin de nature aménagé",
    "kind": "count",
    "unit": "fois",
    "min": 1,
    "max": 1,
    "referenceRule": "aucun",
    "factors": [],
    "aliases": [
      "planté un arbre",
      "nichoir"
    ]
  }
];

export const ACTION_SLUGS = ACTION_TYPES.map((a) => a.slug);
