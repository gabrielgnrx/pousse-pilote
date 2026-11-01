"use client";
import Link from "next/link";
import { STAGE_NAMES } from "@/lib/game/garden.ts";
import { bestTile, checkTile, lookOf, type Seed } from "@/lib/game/island.ts";
import { useIsland } from "./IslandProvider";

function SeedDot({ seed }: { seed: Pick<Seed, "color" | "accent" | "rare"> }) {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" className="shrink-0">
      <circle cx="11" cy="11" r="10" fill={seed.color} />
      <circle cx="11" cy="11" r="4" fill={seed.accent} />
      {seed.rare ? <circle cx="11" cy="11" r="10" fill="none" stroke="#f2c14e" strokeWidth="2.5" /> : null}
    </svg>
  );
}

const TOP = { top: "calc(env(safe-area-inset-top, 0px) + 68px)" };
const BOTTOM = { bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)" };

/** Les commandes du jeu, posées sur l'île en plein écran : graines, plantation, fiche d'une plante. */
export function IslandControls() {
  const { data, mine, status, seeds, seed, tile, inspect, toast, pending, chooseSeed, setTile, setInspect, say, plant } = useIsland();
  const inspected = inspect ? data.plants.find((p) => p.x === inspect.x && p.z === inspect.z) ?? null : null;
  const look = inspected ? lookOf(inspected) : null;
  const seedCount = seeds.reduce((n, s) => n + s.available, 0);
  const name = data.name.split(" ")[0] ?? data.name;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute inset-x-0 mx-auto flex max-w-md flex-col items-start gap-2 px-4" style={TOP}>
        <div className="flex w-full items-center justify-between gap-2">
          {mine ? (
            <Link href="/fil" className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-full bg-papier/90 px-4 text-sm font-bold shadow-sm backdrop-blur">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
              Le fil de l&apos;entreprise
            </Link>
          ) : (
            <>
              <p className="rounded-full bg-papier/90 px-4 py-2 font-display text-lg shadow-sm backdrop-blur">L&apos;île de {name}</p>
              <Link href="/ile" className="pointer-events-auto flex min-h-11 items-center rounded-full bg-chloro px-4 text-sm font-bold text-white shadow-sm">
                Mon île
              </Link>
            </>
          )}
        </div>
        <div aria-live="polite" className="flex w-full justify-center">
          {toast ? (
            <p className={`rounded-full px-4 py-2 text-center text-sm font-bold shadow-md ${toast.tone === "erreur" ? "bg-papier text-alerte" : "bg-nuit text-white"}`}>
              {toast.text}
            </p>
          ) : seed && status === "pret" ? (
            <p className="rounded-full bg-papier/90 px-3 py-1.5 text-center text-xs font-semibold backdrop-blur">
              Touche une case libre{seed.rare ? "" : ", ou une case jaune pour faire grandir ta plante"}
            </p>
          ) : null}
        </div>
      </div>

      {status === "chargement" ? (
        <p className="absolute inset-0 flex items-center justify-center text-sm font-bold text-sapin">L&apos;île se prépare…</p>
      ) : null}
      {status === "erreur" ? (
        <div className="absolute inset-x-4 top-1/3 mx-auto flex max-w-sm flex-col items-center gap-3 rounded-[24px] bg-papier p-6 text-center">
          <p className="text-sm">Ton appareil n&apos;arrive pas à afficher l&apos;île.</p>
          <Link href="/jardin" className="btn-ghost pointer-events-auto text-sm">
            Voir ma collection
          </Link>
        </div>
      ) : null}

      <div className="absolute inset-x-0 mx-auto flex max-w-md flex-col gap-2 px-3" style={BOTTOM}>
        {tile && seed ? (
          <div className="pointer-events-auto flex items-center gap-2 rounded-[22px] bg-papier p-2 pl-4 shadow-lg">
            <SeedDot seed={seed} />
            <p className="min-w-0 flex-1 text-sm font-bold">
              {checkTile(data.plants, seed, tile.x, tile.z) === "grandit" ? `Faire grandir : ${seed.name}` : `Planter : ${seed.name}`}
            </p>
            <button type="button" className="btn-ghost min-h-11 px-4 text-sm" onClick={() => setTile(null)}>
              Annuler
            </button>
            <button type="button" className="btn-primary min-h-11 px-4 text-sm" disabled={pending} onClick={() => void plant(seed, tile)}>
              Planter
            </button>
          </div>
        ) : inspected && look ? (
          <div className="pointer-events-auto flex flex-col gap-2 rounded-[22px] bg-papier p-4 shadow-lg">
            <div className="flex items-center gap-2">
              <SeedDot seed={look} />
              <p className="flex-1 font-display text-lg">{look.name}</p>
              {look.rare ? <span className="chip bg-pollen-pale text-pollen-texte">Rare</span> : null}
              <button type="button" aria-label="Fermer la fiche" className="-mr-2 flex size-11 items-center justify-center rounded-full" onClick={() => setInspect(null)}>
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-terre">
              {STAGE_NAMES[look.stage]}
              {look.rare ? "" : ` · ${inspected.fed} graine${inspected.fed > 1 ? "s" : ""}`}
              {look.next ? ` · stade suivant à ${look.next}` : ""}
            </p>
            {look.next ? (
              <div className="h-2 rounded-full bg-trait">
                <div className="h-2 rounded-full bg-chloro" style={{ width: `${Math.min(100, (inspected.fed / look.next) * 100)}%` }} />
              </div>
            ) : null}
            {mine && !inspected.rare && seeds.some((s) => s.key === inspected.species) ? (
              <button
                type="button"
                className="btn-primary min-h-11 text-sm"
                disabled={pending}
                onClick={() => {
                  const s = seeds.find((x) => x.key === inspected.species);
                  if (s) void plant(s, { x: inspected.x, z: inspected.z });
                }}
              >
                Ajouter une graine
              </button>
            ) : null}
          </div>
        ) : mine ? (
          <section aria-labelledby="graines" className="pointer-events-auto flex flex-col gap-2 rounded-[24px] bg-papier/90 p-3 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between gap-2 px-1">
              <h2 id="graines" className="label">
                {seedCount ? `Tes graines · ${seedCount}` : "Tes graines"}
              </h2>
              {seed ? (
                <button
                  type="button"
                  className="min-h-9 rounded-full px-3 text-xs font-bold text-chloro underline"
                  disabled={pending}
                  onClick={() => {
                    const at = bestTile(data.plants, seed);
                    if (at) void plant(seed, at);
                    else say("Ton île est pleine : fais grandir une plante de la même espèce.", "erreur");
                  }}
                >
                  Planter pour moi
                </button>
              ) : null}
            </div>
            {seeds.length ? (
              <ul className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-0.5">
                {seeds.map((s) => {
                  const on = s.key === seed?.key;
                  return (
                    <li key={s.key} className="shrink-0">
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => chooseSeed(on ? null : s.key)}
                        className={`flex min-h-11 items-center gap-2 rounded-full py-1 pr-3 pl-1.5 text-sm font-bold transition active:scale-[0.97] ${on ? "bg-chloro text-white" : "bg-papier text-encre shadow-[inset_0_0_0_1.5px_var(--color-trait)]"}`}
                      >
                        <SeedDot seed={s} />
                        {s.name}
                        <span className={`rounded-full px-1.5 text-xs tabular-nums ${on ? "bg-white/20" : "bg-sable"}`}>×{s.available}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-1 pb-1 text-sm">
                Chaque action enregistrée avec le <strong>+</strong> te donne une graine à planter ici.
              </p>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
