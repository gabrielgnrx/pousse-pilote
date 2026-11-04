"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ISLAND_STAGE_NAMES, ZONE_BY_KEY, checkTile, growLocally, guestsOf, lookOf, moveLocally, plantLocally, seedsOf, stageOf, tileFits, uprootLocally, zoneOfSpecies, type IslandData, type Seed } from "@/lib/game/island.ts";
import { newcomers, type Animal } from "@/lib/game/ecosystem.ts";
import { growPlant, movePlant, plantSeed, uprootPlant, type PlantResult } from "@/app/(app)/ile/actions";
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
  /** Faire grandir une plante d'un stade, avec ses pousses. */
  grow(at: Tile): Promise<void>;
  /** La plante en cours de déplacement (on touche ensuite une case libre). */
  moving: Tile | null;
  startMove(at: Tile | null): void;
  uproot(at: Tile): Promise<void>;
  /** Un animal qui vient de revenir sur l'île (carte « Nouvel habitant »). */
  newcomer: Animal | null;
  dismissNewcomer(): void;
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
  initialSeed = null,
  framing = "full",
  children,
}: {
  initial: IslandData;
  /** L'espèce choisie à l'ouverture (« Planter » depuis la Serre). */
  initialSeed?: string | null;
  mine?: boolean;
  /** « hero » : en haut de l'accueil, sous l'en-tête et au-dessus du fil ; « full » : la page de l'île. */
  framing?: "hero" | "full";
  children: React.ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<IslandScene | null>(null);
  const [status, setStatus] = useState<"chargement" | "pret" | "erreur">("chargement");
  const [own, setOwn] = useState(initial);
  const [seedKey, setSeedKey] = useState<string | null>(initialSeed);
  const [tile, setTile] = useState<Tile | null>(null);
  const [inspect, setInspect] = useState<Tile | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [pending, setPending] = useState(false);
  const [moving, setMoving] = useState<Tile | null>(null);
  const [newcomer, setNewcomer] = useState<Animal | null>(null);
  // Un nouvel habitant s'annonce après la fête de plantation.
  const welcome = useCallback((before: IslandData, after: IslandData) => {
    const arrived = newcomers(before.plants, after.plants)[0];
    if (arrived) window.setTimeout(() => setNewcomer(arrived), 900);
  }, []);

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
  const live = useRef({ own, data, seed, tile, pending, mine, moving });
  live.current = { own, data, seed, tile, pending, mine, moving };

  /** Applique la réponse du serveur, ou revient en arrière avec le message d'erreur. */
  const settle = useCallback(
    async (before: IslandData, request: Promise<PlantResult>) => {
      setPending(true);
      const res = await request;
      setPending(false);
      if (res.ok) setOwn(res.data);
      else {
        setOwn(before);
        setToast({ text: res.error, tone: "erreur" });
      }
    },
    [],
  );

  const move = useCallback(
    async (from: Tile, to: Tile) => {
      const { own: before, pending: busy } = live.current;
      if (busy) return;
      const next = moveLocally(before, from, to);
      if (next === before) return;
      setOwn(next);
      setMoving(null);
      setInspect(null);
      sceneRef.current?.celebrate(to.x, to.z, "nouvelle");
      setToast({ text: "Plante déplacée", tone: "ok" });
      welcome(before, next);
      await settle(before, movePlant({ from, to }));
    },
    [settle, welcome],
  );

  const uproot = useCallback(
    async (at: Tile) => {
      const { own: before, pending: busy } = live.current;
      if (busy) return;
      const plant = before.plants.find((p) => p.x === at.x && p.z === at.z);
      if (!plant) return;
      const look = lookOf(plant);
      setOwn(uprootLocally(before, at));
      setInspect(null);
      sceneRef.current?.celebrate(at.x, at.z, "grandit");
      const back = plant.spent ?? 0;
      setToast({
        text: back
          ? `Plante arrachée : ${back} pousses rendues`
          : look?.rare
            ? `Plante arrachée : ${look.name} t'attend dans tes graines`
            : "Plante arrachée",
        tone: "ok",
      });
      await settle(before, uprootPlant(at));
    },
    [settle],
  );

  const plant = useCallback(
    async (s: Seed, at: Tile) => {
      const { own: before, pending: busy } = live.current;
      if (busy) return;
      if (s.cost > (before.pousses ?? 0)) {
        say(`Il te faut ${s.cost} pousses pour planter : enregistre une action pour en gagner.`, "erreur");
        return;
      }
      const next = plantLocally(before, s, at.x, at.z);
      const now = next.plants.find((p) => p.x === at.x && p.z === at.z);
      const look = now ? lookOf(now) : null;
      if (!now || !look || next === before) return;

      setOwn(next);
      welcome(before, next);
      setTile(null);
      sceneRef.current?.celebrate(at.x, at.z, "nouvelle");
      try {
        navigator.vibrate?.(15);
      } catch {
        // Pas de vibration sur cet appareil.
      }
      say(`Nouvelle plante : ${look.name}${s.cost ? ` · −${s.cost} pousses` : " · offerte"}`);

      await settle(before, plantSeed({ species: s.key, x: at.x, z: at.z }));
    },
    [say, settle, welcome],
  );

  const grow = useCallback(
    async (at: Tile) => {
      const { own: before, pending: busy } = live.current;
      if (busy) return;
      const old = before.plants.find((p) => p.x === at.x && p.z === at.z);
      const look = old ? lookOf(old) : null;
      if (!old || !look) return;
      if (!look.next) {
        say(`${look.name} est déjà adulte.`, "erreur");
        return;
      }
      const next = growLocally(before, at);
      if (!next) {
        say(`Il te faut ${look.next} pousses : enregistre des actions pour en gagner.`, "erreur");
        return;
      }
      const stage = stageOf(next.plants.find((p) => p.x === at.x && p.z === at.z)!);
      setOwn(next);
      welcome(before, next);
      sceneRef.current?.celebrate(at.x, at.z, "stade");
      try {
        navigator.vibrate?.([20, 40, 30]);
      } catch {
        // Pas de vibration sur cet appareil.
      }
      say(`${look.name} : ${ISLAND_STAGE_NAMES[stage]} ! −${look.next} pousses`);
      await settle(before, growPlant(at));
    },
    [say, settle, welcome],
  );

  const onTileTap = useCallback(
    (x: number, z: number) => {
      const { data: d, seed: s, tile: selected, mine: isMine, moving: from } = live.current;
      if (isMine && from) {
        const species = d.plants.find((p) => p.x === from.x && p.z === from.z)?.species ?? "";
        const zone = zoneOfSpecies(species);
        if (from.x === x && from.z === z) setMoving(null);
        else if (d.plants.some((p) => p.x === x && p.z === z)) say("Cette case est prise : choisis une case libre.", "erreur");
        else if (!tileFits(species, x, z) && zone) say(`Cette plante reste dans la zone ${ZONE_BY_KEY[zone].name} : choisis une case en surbrillance.`, "erreur");
        else void move(from, { x, z });
        return;
      }
      if (!isMine || !s) {
        setInspect(d.plants.some((p) => p.x === x && p.z === z) ? { x, z } : null);
        return;
      }
      setInspect(null);
      const check = checkTile(d.plants, s, x, z);
      if (check === "occupe") {
        // Une plante pousse ici : on ouvre sa fiche (pour la faire grandir), sans quitter la plantation.
        setTile(null);
        setInspect({ x, z });
        return;
      }
      if (check === "hors_ile") return;
      if (check === "hors_zone") {
        const zone = zoneOfSpecies(s.key);
        say(`${s.name} pousse dans la zone ${zone ? ZONE_BY_KEY[zone].name : ""} : touche une case en surbrillance.`, "erreur");
        return;
      }
      if (selected && selected.x === x && selected.z === z) void plant(s, { x, z });
      else setTile({ x, z });
    },
    [plant, say, move],
  );

  const onEmptyTap = useCallback(() => {
    setTile(null);
    setInspect(null);
    setMoving(null);
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
        scene.setPlants(live.current.data.plants, guestsOf(live.current.data));
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
    sceneRef.current?.setPlants(data.plants, guestsOf(data));
  }, [data, status]);
  useEffect(() => {
    // En déplacement, seules les cases libres de sa zone s'allument (rare : pas de case « grandit »).
    const movingSpecies = moving ? data.plants.find((p) => p.x === moving.x && p.z === moving.z)?.species ?? "" : null;
    sceneRef.current?.setPlanting(movingSpecies !== null ? { key: movingSpecies, rare: true } : seed ? { key: seed.key, rare: seed.rare } : null);
  }, [seed, moving, data, status]);
  useEffect(() => {
    sceneRef.current?.setSelected(moving ?? tile);
  }, [tile, moving, status]);
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
    setMoving(null);
  }, []);

  const startMove = useCallback((at: Tile | null) => {
    setMoving(at);
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
    grow,
    moving,
    startMove,
    uproot,
    newcomer,
    dismissNewcomer: () => setNewcomer(null),
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
                    return l ? `${l.name} (${ISLAND_STAGE_NAMES[l.stage]})` : "";
                  })
                  .filter(Boolean)
                  .join(", ")}.`
              : "Une île vide, prête à accueillir tes premières plantes."
          }
        />
        {status === "erreur" ? <div aria-hidden="true" className="absolute inset-0 bg-creme" /> : null}
        {children}
      </div>
    </IslandContext.Provider>
  );
}

