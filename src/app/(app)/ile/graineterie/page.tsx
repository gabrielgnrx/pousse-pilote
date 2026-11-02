import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { getMyIsland } from "@/lib/game/data.ts";
import { ITEM_BY_KEY, TIER_LABEL, challengeItemsOf, shopOf, zoneSeeds, type Item } from "@/lib/game/catalog.ts";
import { ZONES, ZONE_BY_KEY, guestsOf, lookOf, type Zone } from "@/lib/game/island.ts";
import { habitatProgress } from "@/lib/game/ecosystem.ts";
import { plantSvg } from "@/components/island/sprites.ts";
import { BuyButton } from "./BuyButton";

export const metadata = { title: "Graineterie · Pousse" };

/** Comment se gagne une plante de défi, selon sa rareté. */
const HOW: Partial<Record<Item["tier"], string>> = {
  rare: "Défi d'une semaine",
  speciale: "Défi d'un mois",
  fleurie: "Défi d'un mois, au moins 4 fois par semaine",
  remarquable: "Défi de 3 mois : il attire un animal",
};

function Preview({ item, size = 64 }: { item: Item; size?: number }) {
  const look = lookOf({ species: item.key, rare: true, fed: 1 });
  if (!look) return null;
  const tall = item.shape === "arbre";
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox={tall ? "-46 -112 92 118" : "-34 -62 68 70"}
      className="shrink-0"
      dangerouslySetInnerHTML={{ __html: plantSvg(look, 7) }}
    />
  );
}

/**
 * La Graineterie : les pousses achètent les plantes communes et, une fois débloquées par les actions
 * de leur famille, les plantes signature. Les plantes des défis ne s'y vendent pas : elles s'y montrent
 * pour donner envie de les gagner.
 */
export default async function GraineteriePage({ searchParams }: { searchParams: Promise<{ zone?: string }> }) {
  const { zone: asked } = await searchParams;
  const { supabase, user } = await requireProfile();
  const data = await getMyIsland(supabase, user.id);
  if (!data) notFound();

  const zone: Zone = ZONES.some((z) => z.key === asked) ? (asked as Zone) : "foret";
  const z = ZONE_BY_KEY[zone];
  const pousses = data.pousses ?? 0;
  const inventory = data.inventory ?? {};
  const shop = shopOf(zone);
  const familySeeds = zoneSeeds(data.counts, zone);
  // L'objectif affiché : le premier animal de la zone pas encore revenu.
  const goal = habitatProgress(data.plants, inventory, guestsOf(data)).find((h) => h.zone === zone && !h.here) ?? null;

  return (
    <>
      <div className="flex items-center gap-3">
        <Link href="/fil" aria-label="Revenir sur mon île" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-papier">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="flex-1 font-display text-2xl">Graineterie</h1>
        <p className="flex min-h-11 items-center gap-1.5 rounded-full bg-pollen px-3.5 text-sm font-bold text-encre">
          <span className="tabular-nums">{pousses.toLocaleString("fr-FR")}</span> pousses
        </p>
      </div>
      <p className="-mt-2 text-sm text-brun">
        Tes pousses achètent les plantes ordinaires. Les plus rares se gagnent en défi. Dépenser ne change pas ton
        classement : il compte les pousses gagnées.
      </p>

      <nav aria-label="Zones de l'île" className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {ZONES.map((t) => (
          <Link
            key={t.key}
            href={`/ile/graineterie?zone=${t.key}`}
            aria-current={t.key === zone ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-bold ${t.key === zone ? "bg-sapin text-sapin-clair" : "bg-papier text-brun"}`}
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
              return (
                <li key={n.item} className={`rounded-full px-3 py-1.5 text-xs font-bold ${ok ? "bg-chloro text-white" : "bg-white/10 text-nuit-pale"}`}>
                  {ITEM_BY_KEY[n.item]?.name} {Math.min(n.have, n.need)}/{n.need}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-nuit-pale">{goal.animal.hint}. Plante-les côte à côte.</p>
        </section>
      ) : null}

      <section aria-labelledby="communes" className="flex flex-col gap-2">
        <h2 id="communes" className="label">
          Communes · {z.name}
        </h2>
        <ul className="grid grid-cols-2 gap-2">
          {shop
            .filter((i) => i.kind === "boutique")
            .map((i) => (
              <li key={i.key} className="flex flex-col items-center gap-2 rounded-[20px] bg-papier p-3 text-center">
                <Preview item={i} />
                <p className="font-bold">{i.name}</p>
                {inventory[i.key] ? <p className="-mt-1.5 text-xs text-terre">{inventory[i.key]} dans ton bac</p> : null}
                <div className="w-full">
                  <BuyButton item={i.key} name={i.name} price={i.price ?? 0} affordable={pousses >= (i.price ?? 0)} />
                </div>
              </li>
            ))}
        </ul>
      </section>

      <section aria-labelledby="signature" className="flex flex-col gap-2">
        <h2 id="signature" className="label">
          Signature · {z.name}
        </h2>
        {shop
          .filter((i) => i.kind === "signature")
          .map((i) => {
            const open = familySeeds >= (i.unlock ?? 0);
            return (
              <div key={i.key} className={`flex items-center gap-3 rounded-[20px] p-3 ${open ? "bg-papier ring-2 ring-chloro" : "bg-sable"}`}>
                <Preview item={i} size={56} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{i.name}</p>
                  <p className="text-xs leading-snug text-terre">
                    {open
                      ? `Débloquée par ${i.unlock} actions (${z.grownBy})`
                      : `Se débloque avec ${i.unlock} actions (${z.grownBy}) : ${familySeeds}/${i.unlock}`}
                  </p>
                  {inventory[i.key] ? <p className="text-xs text-terre">{inventory[i.key]} dans ton bac</p> : null}
                </div>
                {open ? (
                  <div className="w-32 shrink-0">
                    <BuyButton item={i.key} name={i.name} price={i.price ?? 0} affordable={pousses >= (i.price ?? 0)} />
                  </div>
                ) : (
                  <svg aria-label="Verrouillée" role="img" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-terre">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                )}
              </div>
            );
          })}
      </section>

      <section aria-labelledby="defis" className="flex flex-col gap-2">
        <h2 id="defis" className="label">
          Pas en vente : à gagner en défi
        </h2>
        <ul className="flex flex-col gap-2">
          {challengeItemsOf(zone).map((i) => (
            <li key={i.key} className="flex items-center gap-3 rounded-[20px] bg-pollen-pale p-3">
              <Preview item={i} size={48} />
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {i.name}
                  {inventory[i.key] ? <span className="font-normal text-terre"> · {inventory[i.key]} dans ton bac</span> : null}
                </p>
                <p className="text-xs leading-snug text-brun">
                  {TIER_LABEL[i.tier]} · {HOW[i.tier]}, thème {z.grownBy.replace(/^(tes|ta) /, "")}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <Link href="/defis" className="btn-dark text-sm">
          Lancer un défi
        </Link>
      </section>
    </>
  );
}
