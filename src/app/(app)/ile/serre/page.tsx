import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { getMyIsland } from "@/lib/game/data.ts";
import { TIER_LABEL, challengeItemsOf, shopOf, zoneSeeds, type Item } from "@/lib/game/catalog.ts";
import { SPECIES } from "@/lib/game/garden.ts";
import { PLANT_COST, ZONES, ZONE_BY_KEY, zoneOfSpecies, type Zone } from "@/lib/game/island.ts";
import { nextGoal } from "@/lib/game/goals.ts";
import { SerreTabs, type SerreTab, type Entry } from "./SerreTabs";

export const metadata = { title: "La Serre · Pousse" };

type Tab = Zone | "fleurs";
/** « Fleurs » : les espèces qui poussent dans toutes les zones (fleurs d'activité, myosotis). */
const TABS: { key: Tab; name: string }[] = [...ZONES.map((z) => ({ key: z.key as Tab, name: z.name })), { key: "fleurs", name: "Fleurs · partout" }];

/** Les quatre espèces de départ. */
const BASE = ["transport", "alimentation", "consommation", "logement"];
/** Les espèces d'activité : débloquées en essayant l'activité une fois (island_unlocked). */
const ACTIVITY: Record<string, string> = {
  nature: "Une action nature (compost, ramassage, comptage, plantation)",
  scan: "Un meilleur choix au scanner",
  bravo: "Un bravo à un collègue dans le fil",
  quiz: "Un quiz du jour réussi (7/10 ou plus)",
  cap: "Une bonne habitude enregistrée",
};
/** Comment se gagne une plante de défi, selon sa rareté. */
const HOW: Partial<Record<Item["tier"], string>> = {
  rare: "Défi d'une semaine",
  speciale: "Défi d'un mois",
  fleurie: "Défi d'un mois, au moins 4 fois par semaine",
  remarquable: "Défi de 3 mois : il attire un animal",
};

/**
 * La Serre : les espèces débloquées, à planter (10 pousses, ou offert), et celles à débloquer, avec ce
 * qui les ouvre : les actions de la famille de la zone, un défi, une activité, un cadeau.
 */
export default async function SerrePage({ searchParams }: { searchParams: Promise<{ zone?: string }> }) {
  const { zone: asked } = await searchParams;
  const { supabase, user } = await requireProfile();
  const data = await getMyIsland(supabase, user.id);
  if (!data) notFound();

  const initial: Tab = TABS.some((t) => t.key === asked) ? (asked as Tab) : "foret";
  const unlocked = new Set(data.unlocked ?? []);
  const free = data.free ?? {};
  const onIsland = (key: string) => data.plants.filter((p) => p.species === key).length;

  // Tous les onglets sont calculés ici : changer d'onglet est immédiat, sans aller-retour au serveur.
  const tabs: SerreTab[] = TABS.map((t) => {
    const zone = t.key === "fleurs" ? null : t.key;
    const inTab = (key: string) => zoneOfSpecies(key) === zone;
    const speciesHere: Entry[] = [
      ...SPECIES.filter((s) => inTab(s.key) && (BASE.includes(s.key) || s.key in ACTIVITY)).map((s) => ({
        key: s.key,
        name: s.name,
        how: BASE.includes(s.key) ? "Espèce de départ" : (ACTIVITY[s.key] ?? ""),
      })),
      ...(zone
        ? shopOf(zone).map((i) => ({
            key: i.key,
            name: i.name,
            how: `${i.unlock} action${(i.unlock ?? 0) > 1 ? "s" : ""} (${ZONE_BY_KEY[zone].grownBy}) · ${Math.min(zoneSeeds(data.counts, zone), i.unlock ?? 0)}/${i.unlock}`,
          }))
        : []),
      ...(zone
        ? challengeItemsOf(zone).map((i) => ({
            key: i.key,
            name: i.name,
            how: `${TIER_LABEL[i.tier]} · ${HOW[i.tier]}, thème ${ZONE_BY_KEY[zone].grownBy.replace(/^(tes|ta) /, "")}`,
            tone: i.tier === "remarquable" ? ("or" as const) : undefined,
          }))
        : [{ key: "myosotis", name: "Myosotis", how: "Offert par un collègue, depuis son QG" }]),
    ];
    return {
      key: t.key,
      name: t.name,
      goal: nextGoal(data, zone),
      open: speciesHere
        .filter((e) => unlocked.has(e.key))
        .map((e) => {
          const n = onIsland(e.key);
          const gifts = Number(free[e.key] ?? 0);
          return { ...e, how: `${n ? `${n} sur ton île` : "Pas encore plantée"}${gifts ? ` · ${gifts} offert${gifts > 1 ? "s" : ""}` : ""}`, gifts };
        }),
      locked: speciesHere.filter((e) => !unlocked.has(e.key)),
      defi: zone ? ZONE_BY_KEY[zone].grownBy.replace(/^(tes|ta) /, "") : null,
    };
  });

  return <SerreTabs tabs={tabs} initial={initial} pousses={data.pousses ?? 0} plantCost={PLANT_COST} />;
}
