import type { Footprint } from "./footprint.ts";

/**
 * Les postes du bilan carbone et leurs couleurs de graphique, partagés par le profil et la page Mon bilan.
 * Couleurs de données, volontairement hors des deux accents de l'appli (le pollen signale une récompense) :
 * des teintes moyennes, lisibles sur une carte blanche comme sur le bandeau vert du bilan.
 */
export const FOOTPRINT_PARTS: {
  key: keyof Footprint["byCategory"];
  label: string;
  /** Libellé détaillé, pour la page Mon bilan. */
  long: string;
  color: string;
}[] = [
  { key: "transport", label: "Transports", long: "Transports", color: "#7db878" },
  { key: "alimentation", label: "Alimentation", long: "Alimentation", color: "#e8b07a" },
  { key: "logement", label: "Chauffage", long: "Chauffage", color: "#9fc3e0" },
  { key: "consommation", label: "Achats", long: "Vêtements et électronique", color: "#c3aee0" },
  { key: "services", label: "Services publics", long: "Services publics (part commune)", color: "#c9c2b0" },
];
