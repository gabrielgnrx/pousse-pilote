/**
 * Plan d'action : les gestes au plus fort impact annuel pour une personne,
 * calculés uniquement à partir de ses habitudes déclarées.
 */
import { HEATING_SAVING_PER_DEGREE, WORK_WEEKS_PER_YEAR } from "./factors.ts";
import { AVERAGE_CLOTHING_KG, WEEKS_PER_YEAR, type Habits } from "./footprint.ts";
import { unitImpact } from "./challenges.ts";

export interface PlanItem {
  templateId: string;
  variant: string;
  title: string;
  kgYear: number;
  basis: string;
}

export function actionPlan(h: Habits): PlanItem[] {
  const items: PlanItem[] = [];

  const beef = unitImpact("vege", "boeuf", h);
  if (beef.eligible) {
    items.push({
      templateId: "vege",
      variant: "boeuf",
      title: "Végétarien au lieu du bœuf",
      kgYear: h.beefMealsWeek * WEEKS_PER_YEAR * beef.kg,
      basis: `${h.beefMealsWeek} repas par semaine × ${beef.kg.toFixed(2).replace(".", ",")} kg`,
    });
  }

  const velo = unitImpact("velo", "base", h);
  if (velo.eligible) {
    const days = Math.min(3, h.commuteDaysPerWeek);
    const trips = days * 2 * WORK_WEEKS_PER_YEAR;
    items.push({
      templateId: "velo",
      variant: "base",
      title: `Vélo ${days} jour${days > 1 ? "s" : ""} par semaine pour aller au travail`,
      kgYear: trips * velo.kg,
      basis: `${trips} trajets de ${h.commuteKm} km par an`,
    });
  }

  const covoit = unitImpact("covoiturage", "base", h);
  if (covoit.eligible) {
    const trips = h.commuteDaysPerWeek * 2 * WORK_WEEKS_PER_YEAR;
    items.push({
      templateId: "covoiturage",
      variant: "base",
      title: "Covoiturer à deux pour aller au travail",
      kgYear: trips * covoit.kg,
      basis: `${trips} trajets par an, partagés à deux`,
    });
  }

  const train = unitImpact("train", "500", h);
  if (train.eligible) {
    const legs = h.shortFlightsYear * 2;
    items.push({
      templateId: "train",
      variant: "500",
      title: "Train au lieu de l'avion pour tes trajets courts",
      kgYear: legs * train.kg,
      basis: `${legs} allers simples de 500 km environ`,
    });
  }

  const heating = unitImpact("chauffage", "base", h);
  if (heating.eligible) {
    items.push({
      templateId: "chauffage",
      variant: "base",
      title: "Chauffage à 1 °C de moins",
      kgYear: h.heatingKgYear * HEATING_SAVING_PER_DEGREE,
      basis: "7 % de ton chauffage déclaré",
    });
  }

  if (h.newClothesYear > 0) {
    const half = Math.ceil(h.newClothesYear / 2);
    items.push({
      templateId: "occasion",
      variant: "chemise",
      title: "La moitié de tes vêtements en seconde main",
      kgYear: half * AVERAGE_CLOTHING_KG,
      basis: `${half} vêtements par an`,
    });
  }

  // Postes ponctuels et défis expert : souvent ce qui reste quand le quotidien est déjà sobre.
  const holidays = unitImpact("vacances_train", "base", h);
  if (holidays.eligible) {
    items.push({
      templateId: "vacances_train",
      variant: "base",
      title: "Des vacances en train plutôt qu'un vol long-courrier",
      kgYear: holidays.kg,
      basis: "un aller-retour long-courrier remplacé par an",
    });
  }

  const laptop = unitImpact("reparation", "ordinateur", h);
  const phone = unitImpact("reparation", "smartphone", h);
  if (laptop.eligible || phone.eligible) {
    const variant = laptop.eligible ? "ordinateur" : "smartphone";
    items.push({
      templateId: "reparation",
      variant,
      title: laptop.eligible ? "Réparer tes appareils au lieu d'en racheter" : "Faire réparer ton smartphone",
      kgYear: laptop.eligible ? h.newDevicesYear * laptop.kg : phone.kg / 3,
      basis: laptop.eligible
        ? `${h.newDevicesYear} appareil${h.newDevicesYear > 1 ? "s" : ""} neuf${h.newDevicesYear > 1 ? "s" : ""} évité${h.newDevicesYear > 1 ? "s" : ""} par an`
        : "un smartphone neuf évité tous les 3 ans",
    });
  }

  const vegan = unitImpact("vegetalien", "base", h);
  if (vegan.eligible) {
    const meals = Math.min(4, 14 - h.beefMealsWeek - h.otherMeatMealsWeek);
    items.push({
      templateId: "vegetalien",
      variant: "base",
      title: `${meals} repas végétalien${meals > 1 ? "s" : ""} par semaine`,
      kgYear: meals * WEEKS_PER_YEAR * vegan.kg,
      basis: `${meals} repas végétariens remplacés chaque semaine`,
    });
  }

  return items.filter((i) => i.kgYear > 0).sort((a, b) => b.kgYear - a.kgYear);
}
