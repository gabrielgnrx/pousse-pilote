"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STAGE_NAMES } from "@/lib/game/garden.ts";
import { bestTile, checkTile, lookOf, plantLocally, seedsOf, type IslandData, type Seed } from "@/lib/game/island.ts";
import { plantSeed } from "@/app/(app)/ile/actions";
import type { IslandScene } from "./scene.ts";

type Tile = { x: number; z: number };
type Toast = { text: string; tone: "ok" | "erreur" } | null;

function SeedDot({ seed }: { seed: Pick<Seed, "color" | "accent" | "rare"> }) {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" className="shrink-0">
      <circle cx="11" cy="11" r="10" fill={seed.color} />
      <circle cx="11" cy="11" r="4" fill={seed.accent} />
      {seed.rare ? <circle cx="11" cy="11" r="10" fill="none" stroke="#f2c14e" strokeWidth="2.5" /> : null}
    </svg>
  );
}

/** L'île en 3D : le bac de graines, le mode plantation et la fiche d'une plante. */
export function IslandGame({ initial, mine }: { initial: IslandData; mine: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<IslandScene | null>(null);
  const [status, setStatus] = useState<"chargement" | "pret" | "erreur">("chargement");
  const [data, setData] = useState(initial);
  const [seedKey, setSeedKey] = useState<string | null>(null);
  const [tile, setTile] = useState<Tile | null>(null);
  const [inspect, setInspect] = useState<Tile | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [pending, setPending] = useState(false);

  const seeds = useMemo(() => seedsOf(data), [data]);
  const seed = seeds.find((s) => s.key === seedKey) ?? null;
  const seedCount = seeds.reduce((n, s) => n + s.available, 0);
  const inspected = inspect ? data.plants.find((p) => p.x === inspect.x && p.z === inspect.z) ?? null : null;
  const inspectedLook = inspected ? lookOf(inspected) : null;

  // Les rappels de la scène lisent l'état du moment.
  const live = useRef({ data, seed, tile, pending, mine });
  live.current = { data, seed, tile, pending, mine };

  const say = useCallback((text: string, tone: "ok" | "erreur" = "ok") => setToast({ text, tone }), []);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  const plant = useCallback(
    async (s: Seed, at: Tile) => {
      const { data: before, pending: busy } = live.current;
      if (busy) return;
      const old = before.plants.find((p) => p.x === at.x && p.z === at.z);
      const oldStage = old ? lookOf(old)?.stage ?? 0 : 0;
      const next = plantLocally(before, s, at.x, at.z);
      const now = next.plants.find((p) => p.x === at.x && p.z === at.z);
      const look = now ? lookOf(now) : null;
      if (!now || !look || next === before) return;

      const kind = !old ? "nouvelle" : look.stage > oldStage ? "stade" : "grandit";
      setData(next);
      setTile(null);
      sceneRef.current?.celebrate(at.x, at.z, kind);
      try {
        navigator.vibrate?.(kind === "stade" ? [20, 40, 30] : 15);
      } catch {
        // Pas de vibration sur cet appareil.
      }
      say(
        kind === "nouvelle"
          ? `Nouvelle plante : ${look.name}`
          : kind === "stade"
            ? `${look.name} : ${STAGE_NAMES[look.stage]} !`
            : `${look.name} : ${now.fed} graines${look.next ? `, stade suivant à ${look.next}` : ""}`,
      );

      setPending(true);
      const res = await plantSeed({ species: s.key, x: at.x, z: at.z });
      setPending(false);
      if (res.ok) {
        setData(res.data);
      } else {
        setData(before);
        say(res.error, "erreur");
      }
    },
    [say],
  );

  const onTileTap = useCallback(
    (x: number, z: number) => {
      const { data: d, seed: s, tile: selected, mine: own } = live.current;
      if (!own || !s) {
        const here = d.plants.some((p) => p.x === x && p.z === z);
        setInspect(here ? { x, z } : null);
        return;
      }
      setInspect(null);
      const check = checkTile(d.plants, s, x, z);
      if (check === "occupe") {
        say("Une autre plante pousse ici. Choisis une case libre, ou une plante de la même espèce.", "erreur");
        return;
      }
      if (check === "hors_ile") return;
      if (selected && selected.x === x && selected.z === z) void plant(s, { x, z });
      else setTile({ x, z });
    },
    [plant, say],
  );

  const onEmptyTap = useCallback(() => {
    setTile(null);
    setInspect(null);
  }, []);

  const handlers = useRef({ onTileTap, onEmptyTap });
  handlers.current = { onTileTap, onEmptyTap };

  useEffect(() => {
    let disposed = false;
    let scene: IslandScene | null = null;
    import("./scene.ts")
      .then(({ createIslandScene }) => {
        if (disposed || !canvasRef.current) return;
        scene = createIslandScene(canvasRef.current, {
          onTileTap: (x, z) => handlers.current.onTileTap(x, z),
          onEmptyTap: () => handlers.current.onEmptyTap(),
        });
        sceneRef.current = scene;
        scene.setPlants(live.current.data.plants);
        setStatus("pret");
      })
      .catch(() => {
        if (!disposed) setStatus("erreur");
      });
    return () => {
      disposed = true;
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setPlants(data.plants);
  }, [data, status]);
  useEffect(() => {
    sceneRef.current?.setPlanting(seed ? { key: seed.key, rare: seed.rare } : null);
  }, [seed, data, status]);
  useEffect(() => {
    sceneRef.current?.setSelected(tile);
  }, [tile, status]);

  // Plus de graine de l'espèce choisie : on sort du mode plantation.
  useEffect(() => {
    if (seedKey && !seed) {
      setSeedKey(null);
      setTile(null);
    }
  }, [seedKey, seed]);

  const plantCount = data.plants.length;
  const name = data.name.split(" ")[0] ?? data.name;

  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl">{mine ? "Ton île" : `L'île de ${name}`}</h1>
          <p className="mt-0.5 text-sm text-terre">
            {plantCount} plante{plantCount > 1 ? "s" : ""}
            {mine ? ` · ${seedCount} graine${seedCount > 1 ? "s" : ""} à planter` : ""}
          </p>
        </div>
        <Link href={mine ? "/jardin" : "/ile"} className="shrink-0 text-sm font-bold text-chloro underline">
          {mine ? "La collection" : "Mon île"}
        </Link>
      </div>

      <div className="relative h-[min(60dvh,540px)] min-h-[360px] overflow-hidden rounded-[24px] bg-[#bfe0ea]">
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none"
          role="img"
          aria-label={
            plantCount
              ? `${mine ? "Ton île" : `L'île de ${name}`}, vue en 3D : ${data.plants
                  .map((p) => {
                    const l = lookOf(p);
                    return l ? `${l.name} (${STAGE_NAMES[l.stage]})` : "";
                  })
                  .filter(Boolean)
                  .join(", ")}.`
              : "Une île vide, prête à accueillir tes premières graines."
          }
        />

        {status === "chargement" ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm font-bold text-sapin">L&apos;île se prépare…</p>
        ) : null}
        {status === "erreur" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-creme p-6 text-center">
            <p className="text-sm">Ton appareil n&apos;arrive pas à afficher l&apos;île en 3D.</p>
            <Link href="/jardin" className="btn-ghost text-sm">
              Voir ma collection
            </Link>
          </div>
        ) : null}

        <div aria-live="polite" className="pointer-events-none absolute inset-x-3 top-3 flex justify-center">
          {toast ? (
            <p
              className={`rounded-full px-4 py-2 text-center text-sm font-bold shadow-sm ${toast.tone === "erreur" ? "bg-papier text-alerte" : "bg-nuit text-white"}`}
            >
              {toast.text}
            </p>
          ) : seed && status === "pret" ? (
            <p className="rounded-full bg-papier/90 px-3 py-1.5 text-center text-xs font-semibold">
              Touche une case libre{seed.rare ? "" : ", ou une plante jaune pour la faire grandir"}
            </p>
          ) : null}
        </div>

        {tile && seed ? (
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-[20px] bg-papier p-2 pl-4 shadow-md">
            <SeedDot seed={seed} />
            <p className="min-w-0 flex-1 text-sm font-bold">
              {checkTile(data.plants, seed, tile.x, tile.z) === "grandit" ? `Faire grandir ce ${seed.name.toLowerCase()}` : `Planter : ${seed.name}`}
            </p>
            <button type="button" className="btn-ghost min-h-11 px-4 text-sm" onClick={() => setTile(null)}>
              Annuler
            </button>
            <button type="button" className="btn-primary min-h-11 px-4 text-sm" disabled={pending} onClick={() => void plant(seed, tile)}>
              Planter
            </button>
          </div>
        ) : null}

        {inspected && inspectedLook && !tile ? (
          <div className="absolute inset-x-3 bottom-3 flex flex-col gap-2 rounded-[20px] bg-papier p-4 shadow-md">
            <div className="flex items-center gap-2">
              <SeedDot seed={inspectedLook} />
              <p className="flex-1 font-display text-lg">{inspectedLook.name}</p>
              {inspectedLook.rare ? <span className="chip bg-pollen-pale text-pollen-texte">Rare</span> : null}
              <button type="button" aria-label="Fermer la fiche" className="flex size-11 items-center justify-center rounded-full" onClick={() => setInspect(null)}>
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-terre">
              {STAGE_NAMES[inspectedLook.stage]}
              {inspectedLook.rare ? "" : ` · ${inspected.fed} graine${inspected.fed > 1 ? "s" : ""}`}
              {inspectedLook.next ? ` · stade suivant à ${inspectedLook.next}` : ""}
            </p>
            {inspectedLook.next ? (
              <div className="h-2 rounded-full bg-trait">
                <div className="h-2 rounded-full bg-chloro" style={{ width: `${Math.min(100, (inspected.fed / inspectedLook.next) * 100)}%` }} />
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
        ) : null}
      </div>

      {mine ? (
        <section aria-labelledby="graines" className="flex flex-col gap-2">
          <h2 id="graines" className="label">
            Tes graines
          </h2>
          {seeds.length ? (
            <>
              <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                {seeds.map((s) => {
                  const on = s.key === seedKey;
                  return (
                    <li key={s.key} className="shrink-0">
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          setSeedKey(on ? null : s.key);
                          setTile(null);
                          setInspect(null);
                        }}
                        className={`flex min-h-12 items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 text-sm font-bold transition active:scale-[0.97] ${on ? "bg-chloro text-white" : "bg-papier text-encre shadow-[inset_0_0_0_1.5px_var(--color-trait)]"}`}
                      >
                        <SeedDot seed={s} />
                        {s.name}
                        <span className={`rounded-full px-1.5 text-xs tabular-nums ${on ? "bg-white/20" : "bg-sable"}`}>×{s.available}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {seed ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 text-xs text-terre">
                    {seed.rare ? seed.how : `Gagnée par : ${seed.how}`}
                  </p>
                  <button
                    type="button"
                    className="btn-ghost min-h-11 shrink-0 px-4 text-sm"
                    disabled={pending}
                    onClick={() => {
                      const at = bestTile(data.plants, seed);
                      if (at) void plant(seed, at);
                      else say("Ton île est pleine : fais grandir une plante de la même espèce.", "erreur");
                    }}
                  >
                    Planter pour moi
                  </button>
                </div>
              ) : (
                <p className="text-xs text-terre">Choisis une graine, puis touche une case de ton île.</p>
              )}
            </>
          ) : (
            <div className="card flex flex-col gap-3">
              <p className="text-sm">
                Pas de graine à planter pour l&apos;instant. Chaque action enregistrée avec le + t&apos;en donne une, de l&apos;espèce
                qui lui correspond.
              </p>
              <Link href="/agir" className="btn-primary text-sm">
                Enregistrer une action
              </Link>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
