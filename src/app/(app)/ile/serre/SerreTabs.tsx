"use client";
import Link from "next/link";
import { useState } from "react";
import { ITEM_BY_KEY } from "@/lib/game/catalog.ts";
import { lookOf } from "@/lib/game/island.ts";
import type { Goal, GoalAction } from "@/lib/game/goals.ts";
import { plantSvg } from "@/components/island/sprites.ts";

export interface Entry {
  key: string;
  name: string;
  /** D'où vient l'espèce (débloquée) ou comment l'obtenir (verrouillée). */
  how: string;
  tone?: "or";
  /** Exemplaires offerts encore à planter. */
  gifts?: number;
}

export interface SerreTab {
  key: string;
  name: string;
  /** L'objectif le plus proche dans cette zone. */
  goal: Goal | null;
  open: Entry[];
  locked: Entry[];
  /** Le thème des défis de la zone (null : onglet Fleurs). */
  defi: string | null;
}

function Preview({ species, size = 52 }: { species: string; size?: number }) {
  const look = lookOf({ species, rare: Boolean(ITEM_BY_KEY[species]), fed: 1, stage: 4 });
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

function hrefOf(a: GoalAction): string {
  if (a.kind === "planter") return `/ile?planter=${a.species}`;
  if (a.kind === "lien") return a.href;
  return "/ile";
}

/**
 * La Serre, onglet par onglet : l'objectif de la zone, les espèces à planter, puis celles à débloquer.
 * Les onglets changent sans recharger la page (tout est calculé par le serveur à l'ouverture).
 */
export function SerreTabs({ tabs, initial, pousses, plantCost }: { tabs: SerreTab[]; initial: string; pousses: number; plantCost: number }) {
  const [key, setKey] = useState(initial);
  const tab = tabs.find((t) => t.key === key) ?? tabs[0];
  const choose = (next: string) => {
    setKey(next);
    try {
      window.history.replaceState(null, "", `/ile/serre?zone=${next}`);
    } catch {
      // L'adresse ne suit pas l'onglet : sans conséquence.
    }
  };

  return (
    <>
      <h1 className="sr-only">La Serre</h1>
      <p className="-mt-1 text-sm text-brun">
        Une espèce débloquée se plante pour {plantCost} pousses (la première gagnée en défi est offerte), puis grandit avec tes
        pousses : 30, 60, 100. Tu as <strong className="text-encre">{pousses.toLocaleString("fr-FR")} pousses</strong> à dépenser ;
        dépenser ne change pas ton classement.
      </p>

      <div role="tablist" aria-label="Zones de l'île" className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === tab.key}
            onClick={() => choose(t.key)}
            className={`flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-bold transition active:scale-[0.97] ${t.key === tab.key ? "bg-sapin text-sapin-clair" : "bg-papier text-brun"}`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={tab.name} className="flex flex-col gap-4">
        {tab.goal ? (
          <section aria-labelledby="objectif" className="flex flex-col gap-2.5 rounded-[22px] bg-nuit p-4 text-white">
            <p className="text-xs font-bold tracking-wider text-pollen uppercase">Objectif de la zone</p>
            <h2 id="objectif" className="font-display text-xl">
              Faire revenir : {tab.goal.animal.name}
            </h2>
            <ol className="flex flex-col gap-1.5">
              {tab.goal.steps.map((s, i) => (
                <li key={i} className={`flex items-start gap-2 text-sm ${s.done ? "text-nuit-pale line-through" : ""}`}>
                  <span aria-hidden="true" className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${s.done ? "bg-chloro" : "bg-white/15"}`}>
                    {s.done ? "✓" : i + 1}
                  </span>
                  <span>
                    <span className="sr-only">{s.done ? "Fait : " : "À faire : "}</span>
                    {s.label}
                  </span>
                </li>
              ))}
            </ol>
            <Link href={hrefOf(tab.goal.next)} className="btn-primary mt-1 min-h-11 text-sm">
              {tab.goal.next.label}
            </Link>
          </section>
        ) : null}

        <section aria-labelledby="debloquees" className="flex flex-col gap-2">
          <h2 id="debloquees" className="label">
            Débloquées · {tab.open.length}
          </h2>
          {tab.open.length ? (
            <ul className="flex flex-col gap-2">
              {tab.open.map((e) => (
                <li key={e.key} className={`flex items-center gap-3 rounded-[20px] bg-papier p-3 ${e.gifts ? "ring-2 ring-chloro" : ""}`}>
                  <Preview species={e.key} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{e.name}</p>
                    <p className="text-xs leading-snug text-terre">{e.how}</p>
                  </div>
                  <Link
                    href={`/ile?planter=${e.key}`}
                    className={`flex min-h-11 shrink-0 items-center rounded-full px-3.5 text-sm font-bold ${e.gifts || pousses >= plantCost ? "bg-chloro text-white" : "bg-sable text-terre"}`}
                  >
                    {e.gifts ? "Planter · offert" : `Planter · ${plantCost}`}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-[20px] bg-papier p-3 text-sm text-brun">Rien encore ici : regarde ci-dessous comment les débloquer.</p>
          )}
        </section>

        {tab.locked.length ? (
          <section aria-labelledby="a-debloquer" className="flex flex-col gap-2">
            <h2 id="a-debloquer" className="label">
              À débloquer
            </h2>
            <ul className="flex flex-col gap-2">
              {tab.locked.map((e) => (
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

        {tab.defi ? (
          <Link href="/defis?onglet=catalogue" className="btn-dark text-sm">
            Lancer un défi {tab.defi}
          </Link>
        ) : null}
      </div>
    </>
  );
}
