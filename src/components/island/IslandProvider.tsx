"use client";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { STAGE_NAMES } from "@/lib/game/garden.ts";
import { checkTile, lookOf, plantLocally, seedsOf, type IslandData, type Seed } from "@/lib/game/island.ts";
import { myIsland, plantSeed } from "@/app/(app)/ile/actions";
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
  /** Montre l'île d'un collègue (null : revenir à la mienne). */
  visit(data: IslandData | null): void;
}

const IslandContext = createContext<IslandContextValue | null>(null);

export function useIsland(): IslandContextValue {
  const ctx = useContext(IslandContext);
  if (!ctx) throw new Error("useIsland doit être utilisé dans IslandProvider");
  return ctx;
}

/** Les pages où l'on joue : l'île est au premier plan, sans panneau par-dessus. */
export function isIslandPath(path: string): boolean {
  return path === "/ile" || path.startsWith("/ile/");
}

/**
 * Le monde du jeu, monté une fois pour toute l'appli : l'île illustrée en plein écran, derrière tout le
 * reste. Elle se met en pause quand une rubrique est ouverte par-dessus.
 */
export function IslandProvider({ initial, children }: { initial: IslandData; children: React.ReactNode }) {
  const path = usePathname();
  const playing = isIslandPath(path);
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<IslandScene | null>(null);
  const [status, setStatus] = useState<"chargement" | "pret" | "erreur">("chargement");
  const [own, setOwn] = useState(initial);
  const [visiting, setVisiting] = useState<IslandData | null>(null);
  const [seedKey, setSeedKey] = useState<string | null>(null);
  const [tile, setTile] = useState<Tile | null>(null);
  const [inspect, setInspect] = useState<Tile | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [pending, setPending] = useState(false);

  const mine = visiting === null;
  const data = visiting ?? own;
  const seeds = useMemo(() => seedsOf(own), [own]);
  const seed = mine ? seeds.find((s) => s.key === seedKey) ?? null : null;

  const say = useCallback((text: string, tone: "ok" | "erreur" = "ok") => setToast({ text, tone }), []);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Les rappels de la scène lisent l'état du moment.
  const live = useRef({ own, data, seed, tile, pending, mine, playing });
  live.current = { own, data, seed, tile, pending, mine, playing };

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
      const { data: d, seed: s, tile: selected, mine: isMine, playing: onIsland } = live.current;
      if (!onIsland) return;
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
        });
        sceneRef.current = scene;
        scene.setPlants(live.current.data.plants);
        scene.setPaused(!live.current.playing);
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
  useEffect(() => {
    sceneRef.current?.setPaused(!playing);
    if (!playing) {
      setTile(null);
      setInspect(null);
    }
  }, [playing, status]);

  // Retour sur l'île : les actions enregistrées entre-temps ont pu donner des graines.
  const wasPlaying = useRef(playing);
  useEffect(() => {
    if (playing && !wasPlaying.current) {
      void myIsland().then((fresh) => {
        if (fresh) setOwn(fresh);
      });
    }
    wasPlaying.current = playing;
  }, [playing]);

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

  const visit = useCallback((next: IslandData | null) => {
    setVisiting(next);
    setSeedKey(null);
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
    visit,
  };

  const name = data.name.split(" ")[0] ?? data.name;
  return (
    <IslandContext.Provider value={value}>
      <div className="fixed inset-0 overflow-hidden bg-[#8ecbe0]">
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

/** À poser dans la page d'un collègue : son île remplace la mienne le temps de la visite. */
export function IslandVisit({ data }: { data: IslandData }) {
  const { visit } = useIsland();
  useEffect(() => {
    visit(data);
    return () => visit(null);
  }, [data, visit]);
  return null;
}
