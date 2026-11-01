"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { STAGE_NAMES } from "@/lib/game/garden.ts";
import { checkTile, lookOf, plantLocally, seedsOf, type IslandData, type Seed } from "@/lib/game/island.ts";
import { plantSeed } from "@/app/(app)/ile/actions";
import type { IslandScene } from "./scene.ts";

export type Tile = { x: number; z: number };
export type Toast = { text: string; tone: "ok" | "erreur" } | null;

interface IslandContextValue {
  /** L'île affichée : la mienne, ou celle d'un collègue en visite. */
  data: IslandData;
  mine: boolean;
  status: "chargement" | "pret" | "erreur";
  seeds: Seed[];
  seed: Seed | null;
  tile: Tile | null;
  inspect: Tile | null;
  toast: Toast;
  pending: boolean;
  chooseSeed(key: string | null): void;
  setTile(tile: Tile | null): void;
  setInspect(tile: Tile | null): void;
  say(text: string, tone?: "ok" | "erreur"): void;
  plant(seed: Seed, at: Tile): Promise<void>;
}

const IslandContext = createContext<IslandContextValue | null>(null);

export function useIsland(): IslandContextValue {
  const ctx = useContext(IslandContext);
  if (!ctx) throw new Error("useIsland doit être utilisé dans IslandProvider");
  return ctx;
}

/**
 * L'île de l'accueil : elle occupe tout l'espace entre l'en-tête et la barre du bas, et les commandes
 * du jeu (enfants) se posent dessus. `mine` : faux pour la visite de l'île d'un collègue.
 */
export function IslandProvider({
  initial,
  mine = true,
  framing = "full",
  children,
}: {
  initial: IslandData;
  mine?: boolean;
  /** « hero » : en haut de l'accueil, sous l'en-tête et au-dessus du fil ; « full » : la page de l'île. */
  framing?: "hero" | "full";
  children: React.ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<IslandScene | null>(null);
  const [status, setStatus] = useState<"chargement" | "pret" | "erreur">("chargement");
  const [own, setOwn] = useState(initial);
  const [seedKey, setSeedKey] = useState<string | null>(null);
  const [tile, setTile] = useState<Tile | null>(null);
  const [inspect, setInspect] = useState<Tile | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [pending, setPending] = useState(false);

  const data = own;
  const seeds = useMemo(() => seedsOf(own), [own]);
  const seed = mine ? seeds.find((s) => s.key === seedKey) ?? null : null;

  const say = useCallback((text: string, tone: "ok" | "erreur" = "ok") => setToast({ text, tone }), []);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Les rappels de la scène lisent l'état du moment.
  const live = useRef({ own, data, seed, tile, pending, mine });
  live.current = { own, data, seed, tile, pending, mine };

  const plant = useCallback(
    async (s: Seed, at: Tile) => {
      const { own: before, pending: busy } = live.current;
      if (busy) return;
      const old = before.plants.find((p) => p.x === at.x && p.z === at.z);
      const oldStage = old ? lookOf(old)?.stage ?? 0 : 0;
      const next = plantLocally(before, s, at.x, at.z);
      const now = next.plants.find((p) => p.x === at.x && p.z === at.z);
      const look = now ? lookOf(now) : null;
      if (!now || !look || next === before) return;

      const kind = !old ? "nouvelle" : look.stage > oldStage ? "stade" : "grandit";
      setOwn(next);
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
      if (res.ok) setOwn(res.data);
      else {
        setOwn(before);
        say(res.error, "erreur");
      }
    },
    [say],
  );

  const onTileTap = useCallback(
    (x: number, z: number) => {
      const { data: d, seed: s, tile: selected, mine: isMine } = live.current;
      if (!isMine || !s) {
        setInspect(d.plants.some((p) => p.x === x && p.z === z) ? { x, z } : null);
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
        if (disposed || !hostRef.current) return;
        scene = createIslandScene(hostRef.current, {
          onTileTap: (x, z) => handlers.current.onTileTap(x, z),
          onEmptyTap: () => handlers.current.onEmptyTap(),
        }, framing);
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
    if (seedKey && !seeds.some((s) => s.key === seedKey)) {
      setSeedKey(null);
      setTile(null);
    }
  }, [seedKey, seeds]);

  const chooseSeed = useCallback((key: string | null) => {
    setSeedKey(key);
    setTile(null);
    setInspect(null);
  }, []);

  const value: IslandContextValue = {
    data,
    mine,
    status,
    seeds,
    seed,
    tile,
    inspect,
    toast,
    pending,
    chooseSeed,
    setTile,
    setInspect,
    say,
    plant,
  };

  const name = data.name.split(" ")[0] ?? data.name;
  return (
    <IslandContext.Provider value={value}>
      <div
        className={`relative -mx-4 overflow-hidden bg-[#8ecbe0] ${framing === "full" ? "-mt-2" : ""}`}
        style={framing === "hero" ? { height: 480 } : { height: "calc(100dvh - 186px)", minHeight: 460 }}
      >
        <div
          ref={hostRef}
          className="absolute inset-0 select-none"
          role="img"
          aria-label={
            data.plants.length
              ? `${mine ? "Ton île" : `L'île de ${name}`}, vue d'en haut : ${data.plants
                  .map((p) => {
                    const l = lookOf(p);
                    return l ? `${l.name} (${STAGE_NAMES[l.stage]})` : "";
                  })
                  .filter(Boolean)
                  .join(", ")}.`
              : "Une île vide, prête à accueillir tes premières graines."
          }
        />
        {status === "erreur" ? <div aria-hidden="true" className="absolute inset-0 bg-creme" /> : null}
        {children}
      </div>
    </IslandContext.Provider>
  );
}

