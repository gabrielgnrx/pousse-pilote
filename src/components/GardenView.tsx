import Link from "next/link";
import { buildGarden, STAGE_NAMES, type GardenData } from "@/lib/game/garden.ts";
import { PlantArt } from "./PlantArt";

/** Le jardin d'une personne : ses espèces (avec leur stade) et ses plantes rares. */
export function GardenView({ data, mine }: { data: GardenData; mine: boolean }) {
  const g = buildGarden(data);
  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">{mine ? "Ton jardin" : `Le jardin de ${data.name}`}</h1>
        <p className="mt-1 text-sm text-terre">
          {g.grown} plante{g.grown > 1 ? "s" : ""} sur {g.total}. Chaque type d&apos;action fait pousser une espèce ; les
          exploits et les graines mystère donnent des plantes rares.
        </p>
        <div className="mt-2 h-2 rounded-full bg-trait" role="progressbar" aria-label="Collection" aria-valuemin={0} aria-valuemax={g.total} aria-valuenow={g.grown}>
          <div className="h-2 rounded-full bg-sapin" style={{ width: `${Math.max(3, (g.grown / g.total) * 100)}%` }} />
        </div>
      </div>

      <section aria-labelledby="especes" className="flex flex-col gap-2">
        <h2 id="especes" className="label">Les espèces</h2>
        <ul className="grid grid-cols-2 gap-2.5">
          {g.plants.map((p) => (
            <li key={p.key} className={`flex flex-col items-center gap-1 rounded-[18px] border border-encre/10 px-2 py-3 text-center ${p.stage ? "bg-papier" : "bg-creme"}`}>
              <PlantArt shape={p.shape} color={p.color} accent={p.accent} stage={p.stage} label={`${p.name}, ${STAGE_NAMES[p.stage]}`} />
              <p className="font-display text-base font-bold">{p.name}</p>
              <p className="text-xs font-semibold">{STAGE_NAMES[p.stage]}</p>
              <p className="text-[11px] leading-snug text-terre">
                {p.count} {p.grownBy}
                {p.next ? ` · stade suivant à ${p.next}` : ""}
              </p>
              {p.next ? (
                <div className="mt-0.5 h-1.5 w-full rounded-full bg-trait">
                  <div className="h-1.5 rounded-full bg-abricot" style={{ width: `${Math.min(100, (p.count / p.next) * 100)}%` }} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="rares" className="flex flex-col gap-2">
        <h2 id="rares" className="label">Les plantes rares</h2>
        <ul className="grid grid-cols-3 gap-2">
          {g.rares.map((r) => (
            <li key={r.key} className={`flex flex-col items-center gap-0.5 rounded-[16px] border border-encre/10 px-1.5 py-2.5 text-center ${r.owned ? "bg-papier" : "bg-creme"}`}>
              <PlantArt shape={r.shape} color={r.color} accent={r.accent} stage={r.owned ? 4 : 0} size={56} label={r.owned ? r.name : "Plante rare à découvrir"} />
              <p className="text-sm font-bold">{r.owned ? r.name : "???"}</p>
              <p className="text-[10px] leading-tight text-terre">{r.how}</p>
            </li>
          ))}
        </ul>
      </section>

      {mine ? (
        <p className="text-center text-xs text-terre">
          Tes collègues peuvent voir ton jardin depuis le fil. <Link href="/regles" className="font-bold underline">Le barème</Link>
        </p>
      ) : (
        <Link href="/jardin" className="btn-ghost text-sm">Voir mon jardin</Link>
      )}
    </>
  );
}
