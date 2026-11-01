import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { getIsland } from "@/lib/game/data.ts";
import { ANIMALS, animalsOn, zoneStates } from "@/lib/game/ecosystem.ts";
import { ANIMAL_ART } from "@/components/island/ecosystem-layer.ts";

export const metadata = { title: "Carnet de biodiversité · Pousse" };

/** Les animaux qui volent ou se perchent sont dessinés haut sur l'île : on les ramène dans la vignette. */
const ICON_SHIFT: Partial<Record<string, number>> = { oiseaux: 100, chouette: 50, papillons: 38, ecureuil: 8 };

/** Le carnet : l'état des quatre zones de ton île et les animaux revenus (ou l'indice pour les attirer). */
export default async function CarnetPage() {
  const { supabase, user } = await requireProfile();
  const data = await getIsland(supabase, user.id);
  if (!data) notFound();
  const zones = zoneStates(data.plants);
  const present = new Set(animalsOn(data.plants).map((a) => a.animal.key));

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl">Carnet de biodiversité</h1>
        <span className="font-display text-xl tabular-nums">
          {present.size}/{ANIMALS.length}
        </span>
      </div>

      <section aria-labelledby="zones" className="card flex flex-col gap-3">
        <h2 id="zones" className="label">
          Les zones de ton île
        </h2>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
          {zones.map((z) => {
            const pct = Math.round(z.health * 100);
            return (
              <li key={z.key}>
                <div className="flex justify-between text-sm font-bold">
                  <span>{z.name}</span>
                  <span className="tabular-nums">{pct} %</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-trait" role="progressbar" aria-label={`${z.name} restaurée à ${pct} %`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                  <div className="h-2 rounded-full bg-chloro" style={{ width: `${Math.max(pct, pct ? 4 : 0)}%` }} />
                </div>
                <p className="mt-1 text-xs text-terre">
                  {z.fed}/{z.target} graines · {z.grownBy}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="animaux" className="flex flex-col gap-2">
        <h2 id="animaux" className="label">
          Les animaux
        </h2>
        <ul className="grid grid-cols-2 gap-2">
          {ANIMALS.map((a) => {
            const here = present.has(a.key);
            return (
              <li key={a.key} className={`flex flex-col gap-1 rounded-[18px] p-3 ${here ? "bg-papier" : "bg-sable"}`}>
                <div className="flex items-center gap-2">
                  {here ? (
                    <svg
                      aria-hidden="true"
                      width="44"
                      height="34"
                      viewBox="-26 -26 52 40"
                      className="shrink-0"
                      dangerouslySetInnerHTML={{ __html: `<g transform="translate(0 ${ICON_SHIFT[a.key] ?? 0})">${ANIMAL_ART[a.key]}</g>` }}
                    />
                  ) : (
                    <span aria-hidden="true" className="flex h-[34px] w-10 shrink-0 items-center justify-center font-display text-xl text-terre">
                      ?
                    </span>
                  )}
                  <p className="font-bold">{here ? a.name : "À découvrir"}</p>
                </div>
                <p className="text-xs leading-snug text-terre">{here ? a.how : a.hint}</p>
                {here ? <p className="text-xs leading-snug">{a.why}</p> : null}
              </li>
            );
          })}
        </ul>
      </section>

      <Link href="/ile" className="btn-dark text-sm">
        Revenir sur mon île
      </Link>
    </>
  );
}
