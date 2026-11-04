"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ISLAND_STAGE_NAMES, ZONE_BY_KEY, bestTile, guestsOf, lookOf, playableTiles, zoneOfSpecies, type Reward, type Seed } from "@/lib/game/island.ts";
import { ITEM_BY_KEY, TIER_LABEL, rewardLabel } from "@/lib/game/catalog.ts";
import { ANIMALS, ANIMAL_BY_KEY, animalsOn, type AnimalKey } from "@/lib/game/ecosystem.ts";
import { useIsland } from "./IslandProvider";
import { ANIMAL_ART } from "./ecosystem-layer.ts";

function SeedDot({ seed, size = 22 }: { seed: Pick<Seed, "color" | "accent" | "rare">; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 22 22" className="shrink-0">
      <circle cx="11" cy="11" r="10" fill={seed.color} />
      <circle cx="11" cy="11" r="4" fill={seed.accent} />
      {seed.rare ? <circle cx="11" cy="11" r="10" fill="none" stroke="#f2c14e" strokeWidth="2.5" /> : null}
    </svg>
  );
}

/** Les récompenses déjà fêtées sur cet appareil (ids), pour ne les annoncer qu'une fois. */
const SEEN_KEY = "pousse:recompenses-vues";

function readSeen(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function rewardTitle(r: Reward): string {
  const item = ITEM_BY_KEY[r.item];
  if (r.source === "cadeau") return r.from ? `Cadeau de ${r.from}` : "Un cadeau";
  if (r.source === "equipe") return "Accueilli par ton équipe";
  return item?.tier === "commune" ? "Défi terminé : une plante pour la suite" : "Défi réussi";
}

/** Les commandes du jeu, posées sur l'île de l'accueil : graines, plantation, fiche d'une plante. */
/** `top` et `bottom` : marges (px) laissées libres en haut (en-tête) et en bas (feuille du fil). */
export function IslandControls({ top = 12, bottom = 12, compact = false }: { top?: number; bottom?: number; compact?: boolean } = {}) {
  const { data, mine, status, seeds, seed, tile, inspect, toast, pending, chooseSeed, setTile, setInspect, say, plant, grow, moving, startMove, uproot, newcomer, dismissNewcomer } =
    useIsland();
  const living = animalsOn(data.plants, guestsOf(data)).length;
  // La première récompense pas encore fêtée sur cet appareil (lue après le premier rendu).
  const [seen, setSeen] = useState<string[] | null>(null);
  useEffect(() => setSeen(readSeen()), []);
  const unseen = mine && seen ? (data.recent ?? []).filter((r) => !seen.includes(r.id) && ITEM_BY_KEY[r.item]) : [];
  // Plus de deux d'un coup (premier passage après la mise à jour) : une seule carte qui les résume.
  const reward = unseen.length > 0 && unseen.length <= 2 ? unseen[0] : null;
  const rewardItem = reward ? ITEM_BY_KEY[reward.item] : null;
  const markSeen = (...ids: string[]) => {
    const next = [...(seen ?? []), ...ids].slice(-60);
    setSeen(next);
    try {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch {
      // Navigation privée : la carte reviendra à la prochaine visite.
    }
  };
  const seedZone = seed ? zoneOfSpecies(seed.key) : null;
  // La plante dont on demande confirmation avant de l'arracher.
  const [confirming, setConfirming] = useState<string | null>(null);
  const full = seed ? playableTiles(data.plants, seed) === 0 : false;
  const movingPlant = moving ? data.plants.find((p) => p.x === moving.x && p.z === moving.z) ?? null : null;
  const movingLook = movingPlant ? lookOf(movingPlant) : null;
  const inspected = inspect ? data.plants.find((p) => p.x === inspect.x && p.z === inspect.z) ?? null : null;
  const look = inspected ? lookOf(inspected) : null;
  const pousses = data.pousses ?? 0;
  const name = data.name.split(" ")[0] ?? data.name;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute inset-x-0 mx-auto flex max-w-md flex-col items-start gap-2 px-4" style={{ top }}>
        <div className="flex w-full items-center justify-between gap-2">
          {mine ? (
            <Link
              href="/ile/carnet"
              className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-full bg-papier/90 px-3 text-sm font-bold shadow-sm backdrop-blur"
              aria-label={`Carnet de biodiversité : ${living} animaux revenus sur ${ANIMALS.length}`}
            >
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2e7a4c" strokeWidth="2.2" strokeLinecap="round">
                <path d="M4 18c3-6 7-9 16-12" />
                <circle cx="7" cy="8" r="3" />
              </svg>
              <span className="tabular-nums">
                Biodiversité {living}/{ANIMALS.length}
              </span>
            </Link>
          ) : null}
          {mine ? (
            <Link
              href="/ile/serre"
              className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-full bg-pollen px-3 text-sm font-bold text-encre shadow-sm"
              aria-label={`La Serre : ${pousses} pousses à dépenser`}
            >
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 21V11" />
                <path d="M12 13C12 8 8 5 4 5c0 4 3 8 8 8z" />
                <path d="M12 11c0-4 3-7 8-7 0 4-3 7-8 7z" />
              </svg>
              <span className="tabular-nums">{pousses.toLocaleString("fr-FR")}</span>
              <span className="sr-only sm:not-sr-only">Serre</span>
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
          ) : full && seed && status === "pret" ? (
            <p className="rounded-[18px] bg-papier px-3 py-1.5 text-center text-xs font-semibold text-alerte shadow-sm">
              Plus de case libre pour : {seed.name}. Touche une plante pour la déplacer ou l&apos;arracher.
            </p>
          ) : seed && status === "pret" ? (
            <p className="rounded-full bg-papier/90 px-3 py-1.5 text-center text-xs font-semibold backdrop-blur">
              {seedZone ? `Zone ${ZONE_BY_KEY[seedZone].name} : touche une case en surbrillance` : "Touche une case libre"}
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

      <div className="absolute inset-x-0 mx-auto flex max-w-md flex-col gap-2 px-3" style={{ bottom }}>
        {newcomer ? (
          <section
            aria-labelledby="nouvel-habitant"
            className="pointer-events-auto flex flex-col gap-3 rounded-[24px] bg-nuit p-4 text-white shadow-lg motion-safe:animate-[panel-up_0.4s_cubic-bezier(0.2,0.9,0.3,1.2)]"
          >
            <div>
              <p className="text-xs font-bold tracking-wider text-pollen uppercase">Nouvel habitant</p>
              <h2 id="nouvel-habitant" className="font-display text-2xl">
                {newcomer.title}
              </h2>
            </div>
            <p className="text-sm text-nuit-pale">
              <strong className="text-white">{newcomer.how}.</strong> {newcomer.why}
            </p>
            <div className="flex gap-2">
              <Link href="/ile/carnet" className="btn-ghost min-h-11 flex-1 text-sm">
                Voir le carnet
              </Link>
              <button type="button" className="btn-primary min-h-11 flex-1 text-sm" onClick={dismissNewcomer}>
                Super !
              </button>
            </div>
          </section>
        ) : unseen.length > 2 ? (
          <section aria-labelledby="recompenses" className="pointer-events-auto flex flex-col gap-3 rounded-[24px] bg-nuit p-4 text-white shadow-lg">
            <div>
              <p className="text-xs font-bold tracking-wider text-pollen uppercase">{unseen.length} récompenses</p>
              <h2 id="recompenses" className="font-display text-2xl leading-tight">
                Tes défis et ton équipe t&apos;ont gâté
              </h2>
            </div>
            <p className="text-sm text-nuit-pale">{rewardLabel(unseen.map((r) => r.item))}. Débloquées pour toujours, la première de chaque offerte.</p>
            <button type="button" className="btn-primary min-h-11 text-sm" onClick={() => markSeen(...unseen.map((r) => r.id))}>
              Super !
            </button>
          </section>
        ) : reward && rewardItem ? (
          <section
            aria-labelledby="recompense"
            className="pointer-events-auto flex flex-col gap-3 rounded-[24px] bg-nuit p-4 text-white shadow-lg motion-safe:animate-[panel-up_0.4s_cubic-bezier(0.2,0.9,0.3,1.2)]"
          >
            <div className="flex items-center gap-3">
              {rewardItem.kind === "visiteur" ? (
                <svg
                  aria-hidden="true"
                  width="52"
                  height="44"
                  viewBox="-28 -40 56 48"
                  className="shrink-0 rounded-[14px] bg-nuit-pale/20"
                  dangerouslySetInnerHTML={{ __html: `<g transform="translate(0 ${reward.item === "grue" || reward.item === "hirondelles" ? 100 : 0})">${ANIMAL_ART[reward.item as AnimalKey] ?? ""}</g>` }}
                />
              ) : (
                <SeedDot seed={{ color: rewardItem.color, accent: rewardItem.accent, rare: true }} size={44} />
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-wider text-pollen uppercase">{rewardTitle(reward)}</p>
                <h2 id="recompense" className="font-display text-2xl leading-tight">
                  {rewardItem.name}
                </h2>
              </div>
            </div>
            <p className="text-sm text-nuit-pale">
              {rewardItem.kind === "visiteur"
                ? ANIMAL_BY_KEY[reward.item as AnimalKey]?.why ?? "Il rejoint ton carnet de biodiversité."
                : `${TIER_LABEL[rewardItem.tier]} débloquée pour toujours. La première est offerte : plante-la ${
                    rewardItem.zone ? `dans la zone ${ZONE_BY_KEY[rewardItem.zone].name}` : "où tu veux"
                  }, puis fais-la grandir avec tes pousses.`}
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost min-h-11 flex-1 text-sm" onClick={() => markSeen(reward.id)}>
                {rewardItem.kind === "visiteur" ? "Super !" : "Plus tard"}
              </button>
              {rewardItem.kind !== "visiteur" && seeds.some((s) => s.key === reward.item) ? (
                <button
                  type="button"
                  className="btn-primary min-h-11 flex-1 text-sm"
                  onClick={() => {
                    markSeen(reward.id);
                    chooseSeed(reward.item);
                  }}
                >
                  Planter
                </button>
              ) : null}
            </div>
          </section>
        ) : moving && movingLook ? (
          <div className="pointer-events-auto flex items-center gap-2 rounded-[22px] bg-papier p-2 pl-4 shadow-lg">
            <SeedDot seed={movingLook} />
            <p className="min-w-0 flex-1 text-sm font-bold">Touche une case libre pour déplacer : {movingLook.name}</p>
            <button type="button" className="btn-ghost min-h-11 px-4 text-sm" onClick={() => startMove(null)}>
              Annuler
            </button>
          </div>
        ) : tile && seed ? (
          <div className="pointer-events-auto flex items-center gap-2 rounded-[22px] bg-papier p-2 pl-4 shadow-lg">
            <SeedDot seed={seed} />
            <p className="min-w-0 flex-1 text-sm font-bold">Planter : {seed.name}</p>
            <button type="button" className="btn-ghost min-h-11 px-4 text-sm" onClick={() => setTile(null)}>
              Annuler
            </button>
            <button type="button" className="btn-primary min-h-11 px-4 text-sm" disabled={pending || seed.cost > pousses} onClick={() => void plant(seed, tile)}>
              {seed.cost ? `Planter · ${seed.cost}` : "Planter · offert"}
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
            <ol className="grid grid-cols-4 gap-1.5" aria-label={`Stade : ${ISLAND_STAGE_NAMES[look.stage]}`}>
              {[1, 2, 3, 4].map((n) => (
                <li key={n} className="flex flex-col items-center gap-1">
                  <span
                    aria-hidden="true"
                    className={`h-2 w-full rounded-full ${n <= look.stage ? "bg-chloro" : n === look.stage + 1 && mine ? "bg-pollen" : "bg-trait"}`}
                  />
                  <span className={`text-[11px] font-bold ${n <= look.stage ? "text-encre" : "text-terre"}`}>{ISLAND_STAGE_NAMES[n]}</span>
                </li>
              ))}
            </ol>
            {mine && look.next ? (
              <button
                type="button"
                className="flex min-h-12 flex-col items-center justify-center rounded-full bg-pollen px-4 py-1.5 text-encre disabled:opacity-60"
                disabled={pending || look.next > pousses}
                onClick={() => void grow({ x: inspected.x, z: inspected.z })}
              >
                <span className="text-sm font-extrabold">Faire grandir · {look.next} pousses</span>
                <span className="text-xs font-semibold">
                  {look.next > pousses ? `Il t'en manque ${look.next - pousses}` : `Il t'en restera ${pousses - look.next}`}
                </span>
              </button>
            ) : !look.next ? (
              <p className="text-sm text-terre">Adulte : elle compte pleinement pour sa zone.</p>
            ) : null}
            {mine && confirming === inspected.id ? (
              <div className="flex flex-col gap-2 rounded-[16px] bg-sable p-3">
                <p className="text-sm">
                  {inspected.spent
                    ? `Arracher cette plante ? Les ${inspected.spent} pousses dépensées pour elle te seront rendues.`
                    : "Arracher cette plante ? Tu pourras en replanter une autre."}
                </p>
                <div className="flex gap-2">
                  <button type="button" className="btn-ghost min-h-11 flex-1 text-sm" onClick={() => setConfirming(null)}>
                    Garder
                  </button>
                  <button
                    type="button"
                    className="min-h-11 flex-1 rounded-full bg-alerte text-sm font-bold text-white disabled:opacity-50"
                    disabled={pending}
                    onClick={() => {
                      setConfirming(null);
                      void uproot({ x: inspected.x, z: inspected.z });
                    }}
                  >
                    Arracher
                  </button>
                </div>
              </div>
            ) : mine ? (
              <div className="flex gap-2">
                <button type="button" className="btn-ghost min-h-11 flex-1 text-sm" disabled={pending} onClick={() => startMove({ x: inspected.x, z: inspected.z })}>
                  Déplacer
                </button>
                <button type="button" className="btn-ghost min-h-11 flex-1 text-sm text-alerte" disabled={pending} onClick={() => setConfirming(inspected.id)}>
                  Arracher
                </button>
              </div>
            ) : null}
          </div>
        ) : mine ? (
          <section aria-labelledby="graines" className={`pointer-events-auto flex flex-col gap-2 rounded-[24px] bg-papier/90 shadow-lg backdrop-blur ${compact ? "p-2" : "p-3"}`}>
            <div className={`items-center justify-between gap-2 px-1 ${compact && !seed ? "sr-only" : "flex"}`}>
              <h2 id="graines" className="label">
                Tes graines · planter : 10 pousses
              </h2>
              {seed ? (
                <button
                  type="button"
                  className="min-h-11 rounded-full px-3 text-xs font-bold text-chloro underline"
                  disabled={pending}
                  onClick={() => {
                    const at = bestTile(data.plants, seed);
                    if (seed.cost > pousses) say(`Il te faut ${seed.cost} pousses pour planter : enregistre une action pour en gagner.`, "erreur");
                    else if (at) void plant(seed, at);
                    else say("Ton île est pleine : déplace ou arrache une plante pour faire de la place.", "erreur");
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
                        <span className={`rounded-full px-1.5 text-xs tabular-nums ${on ? "bg-white/20" : s.cost ? "bg-sable" : "bg-pollen-pale text-pollen-texte"}`}>
                          {s.cost ? s.cost : `offert${s.free > 1 ? ` ×${s.free}` : ""}`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-1 pb-1 text-sm">
                Chaque action enregistrée avec le <strong>+</strong> te rapporte des pousses : touche une plante pour la faire grandir.
              </p>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
