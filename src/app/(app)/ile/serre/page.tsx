import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { getMyIsland } from "@/lib/game/data.ts";
import { ITEMS, TIER_LABEL, challengeItemsOf, shopOf, zoneSeeds, type Item } from "@/lib/game/catalog.ts";
import { SPECIES } from "@/lib/game/garden.ts";
import { PLANT_COST, ZONES, ZONE_BY_KEY, guestsOf, lookOf, zoneOfSpecies, type Zone } from "@/lib/game/island.ts";
import { habitatProgress } from "@/lib/game/ecosystem.ts";
import { plantSvg } from "@/components/island/sprites.ts";

export const metadata = { title: "La Serre · Pousse" };

type Tab = Zone | "fleurs";
const TABS: { key: Tab; name: string }[] = [...ZONES.map((z) => ({ key: z.key as Tab, name: z.name })), { key: "fleurs", name: "Fleurs" }];

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

interface Entry {
  key: string;
  name: string;
  /** D'où vient l'espèce (débloquée) ou comment l'obtenir (verrouillée). */
  how: string;
  tone?: "or";
}

function Preview({ species, size = 52 }: { species: string; size?: number }) {
  const look = lookOf({ species, rare: Boolean(ITEMS.find((i) => i.key === species)), fed: 1, stage: 4 });
  if (!look) return null;
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox={look.shape === "arbre" ? "-46 -112 92 118" : "-34 -62 68 70"}
      className="shrink-0"
      dangerouslySetInnerHTML={{ __html: plantSvg(look, 7) }}
    />
  );
}

/**
 * La Serre : les espèces débloquées, à planter (10 pousses, ou offert), et celles à débloquer, avec ce
 * qui les ouvre : les actions de la famille de la zone, un défi, une activité, un cadeau.
 */
export default async function SerrePage({ searchParams }: { searchParams: Promise<{ zone?: string }> }) {
  const { zone: asked } = await searchParams;
  const { supabase, user } = await requireProfile();
  const data = await getMyIsland(supabase, user.id);
  if (!data) notFound();

  const tab: Tab = TABS.some((t) => t.key === asked) ? (asked as Tab) : "foret";
  const zone = tab === "fleurs" ? null : tab;
  const pousses = data.pousses ?? 0;
  const unlocked = new Set(data.unlocked ?? []);
  const free = data.free ?? {};
  const onIsland = (key: string) => data.plants.filter((p) => p.species === key).length;
  const inTab = (key: string) => zoneOfSpecies(key) === zone;

  // Toutes les espèces de l'onglet, dans l'ordre où on les débloque.
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
  const open = speciesHere.filter((e) => unlocked.has(e.key));
  const locked = speciesHere.filter((e) => !unlocked.has(e.key));
  const goal = zone
    ? (habitatProgress(data.plants, data.unlocked ?? [], guestsOf(data)).find((h) => h.zone === zone && !h.here) ?? null)
    : null;

  return (
    <>
      <div className="flex items-center gap-3">
        <Link href="/fil" aria-label="Revenir sur mon île" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-papier">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="flex-1 font-display text-2xl">La Serre</h1>
        <p className="flex min-h-11 items-center gap-1.5 rounded-full bg-pollen px-3.5 text-sm font-bold text-encre">
          <span className="tabular-nums">{pousses.toLocaleString("fr-FR")}</span> pousses
        </p>
      </div>
      <p className="-mt-2 text-sm text-brun">
        Tes espèces débloquées se plantent pour {PLANT_COST} pousses, puis grandissent avec tes pousses (30, 60, 100). Les
        autres s&apos;ouvrent avec tes actions et tes défis. Dépenser ne change pas ton classement.
      </p>

      <nav aria-label="Zones de l'île" className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/ile/serre?zone=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-bold ${t.key === tab ? "bg-sapin text-sapin-clair" : "bg-papier text-brun"}`}
          >
            {t.name}
          </Link>
        ))}
      </nav>

      {goal ? (
        <section aria-labelledby="objectif" className="flex flex-col gap-2 rounded-[22px] bg-nuit p-4 text-white">
          <p className="text-xs font-bold tracking-wider text-pollen uppercase">Objectif</p>
          <h2 id="objectif" className="font-display text-xl">
            Faire revenir : {goal.animal.name}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {goal.needs.map((n) => {
              const ok = n.have >= n.need;
              const name = ITEMS.find((i) => i.key === n.item)?.name ?? n.item;
              return (
                <li key={n.item} className={`rounded-full px-3 py-1.5 text-xs font-bold ${ok ? "bg-chloro text-white" : "bg-white/10 text-nuit-pale"}`}>
                  {name} {Math.min(n.have, n.need)}/{n.need}
                  {!n.unlocked && !ok ? " · à débloquer" : ""}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-nuit-pale">{goal.animal.hint}. Plante-les côte à côte.</p>
        </section>
      ) : null}

      <section aria-labelledby="debloquees" className="flex flex-col gap-2">
        <h2 id="debloquees" className="label">
          Débloquées · {open.length}
        </h2>
        {open.length ? (
          <ul className="flex flex-col gap-2">
            {open.map((e) => {
              const gifts = Number(free[e.key] ?? 0);
              const n = onIsland(e.key);
              return (
                <li key={e.key} className={`flex items-center gap-3 rounded-[20px] bg-papier p-3 ${gifts ? "ring-2 ring-chloro" : ""}`}>
                  <Preview species={e.key} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{e.name}</p>
                    <p className="text-xs leading-snug text-terre">
                      {n ? `${n} sur ton île` : "Pas encore plantée"}
                      {gifts ? ` · ${gifts} offert${gifts > 1 ? "s" : ""}` : ""}
                    </p>
                  </div>
                  <Link
                    href={`/ile?planter=${e.key}`}
                    className={`flex min-h-11 shrink-0 items-center rounded-full px-3.5 text-sm font-bold ${gifts || pousses >= PLANT_COST ? "bg-chloro text-white" : "bg-sable text-terre"}`}
                  >
                    {gifts ? "Planter · offert" : `Planter · ${PLANT_COST}`}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-[20px] bg-papier p-3 text-sm text-brun">Rien encore ici : regarde ci-dessous comment les débloquer.</p>
        )}
      </section>

      {locked.length ? (
        <section aria-labelledby="a-debloquer" className="flex flex-col gap-2">
          <h2 id="a-debloquer" className="label">
            À débloquer
          </h2>
          <ul className="flex flex-col gap-2">
            {locked.map((e) => (
              <li key={e.key} className={`flex items-center gap-3 rounded-[20px] p-3 ${e.tone === "or" ? "bg-pollen-pale" : "bg-sable"}`}>
                <span className="opacity-60">
                  <Preview species={e.key} size={44} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{e.name}</p>
                  <p className="text-xs leading-snug text-brun">{e.how}</p>
                </div>
                <svg aria-label="Verrouillée" role="img" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-terre">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {zone ? (
        <Link href="/defis" className="btn-dark text-sm">
          Lancer un défi {ZONE_BY_KEY[zone].grownBy.replace(/^(tes|ta) /, "")}
        </Link>
      ) : null}
    </>
  );
}
