"use client";
import Link from "next/link";
import { useState } from "react";

export interface ActiveChallenge {
  id: string;
  title: string;
  unit: { one: string; many: string };
  done: number;
  target: number;
  endsOn: string;
  /** Duel lié au défi : adversaire et score. */
  duel: { other: string; theirs: number; status: string } | null;
  /** Où enregistrer une fois de plus (le bouton +, ou directement la confirmation pour une grosse action). */
  href?: string;
  /** Pour un défi lancé seul : la page qui le passe en duel. */
  duelHref?: string;
}

/** Une pousse par fois à faire : feuillue quand c'est fait, bourgeon pollen pour la prochaine, motte sinon. */
type SproutState = "fait" | "prochain" | "a-venir";

function Sprout({ state }: { state: SproutState }) {
  if (state === "a-venir") {
    return (
      <svg aria-hidden="true" width="28" height="34" viewBox="0 0 28 34">
        <circle cx="14" cy="27" r="6" fill="var(--color-creme)" stroke="var(--color-tige)" strokeWidth="3" />
      </svg>
    );
  }
  const next = state === "prochain";
  return (
    <svg aria-hidden="true" width="28" height="34" viewBox="0 0 28 34">
      <path d="M14 34V14" stroke="#2e7a4c" strokeWidth="3" strokeLinecap="round" />
      {next ? (
        <path d="M14 22c0-7 3-11 8-12 1 7-3 11-8 12Z" fill="#f2c14e" />
      ) : (
        <>
          <path d="M14 16c0-9 5-14 13-14 0 9-5 14-13 14Z" fill="#2e7a4c" />
          <path d="M14 22c0-7-4-11-12-11 0 8 4 11 12 11Z" fill="#7db878" />
        </>
      )}
    </svg>
  );
}

/** Dans Mon plan : mes défis en cours, avec de quoi avancer… ou annuler. */
export function ActiveChallenges({ items, cancel }: { items: ActiveChallenge[]; cancel: (form: FormData) => Promise<void> }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!items.length) return null;
  return (
    <>
      {items.map((c) => {
        const done = Math.min(c.done, c.target);
        const left = c.target - done;
        const pct = Math.min(100, (done / c.target) * 100);
        // Jusqu'à 7 fois, une pousse par fois ; au-delà, une barre.
        const sprouts: SproutState[] | null =
          c.target <= 7 ? Array.from({ length: c.target }, (_, i): SproutState => (i < done ? "fait" : i === done ? "prochain" : "a-venir")) : null;
        return (
          <article key={c.id} className="flex flex-col gap-3.5 rounded-[24px] bg-papier p-4">
            <div className="flex items-start gap-2.5">
              <div className="min-w-0 flex-1">
                <span
                  className={`mb-1.5 inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-extrabold tracking-wider uppercase ${
                    c.duel ? "bg-pollen text-encre" : "bg-sable text-sapin"
                  }`}
                >
                  {c.duel ? "Duel · ×1,5" : "Seul · ×1"}
                </span>
                <p className="font-display text-xl leading-tight">{c.title}</p>
                <p className="mt-1 text-sm text-brun">
                  {done} sur {c.target} {c.target > 1 ? c.unit.many : c.unit.one} · jusqu&apos;au {c.endsOn}
                </p>
              </div>
              {c.duel ? (
                <span className="shrink-0 rounded-full bg-nuit px-2.5 py-1 text-xs font-bold text-white">
                  {c.duel.status === "pending" ? `Envoyé à ${c.duel.other}` : `${c.duel.other} : ${Math.min(c.duel.theirs, c.target)}`}
                </span>
              ) : null}
            </div>

            {sprouts ? (
              <div className="relative flex justify-around" role="img" aria-label={`${done} sur ${c.target}`}>
                <span aria-hidden="true" className="absolute inset-x-[8%] bottom-[4px] h-[3px] rounded-full bg-tige" />
                {sprouts.map((s, i) => (
                  <span key={i} className="relative">
                    <Sprout state={s} />
                  </span>
                ))}
              </div>
            ) : (
              <div
                className="h-2.5 overflow-hidden rounded-full bg-trait"
                role="progressbar"
                aria-label={`${done} sur ${c.target}`}
                aria-valuemin={0}
                aria-valuemax={c.target}
                aria-valuenow={done}
              >
                <div className="h-full rounded-full bg-chloro" style={{ width: `${Math.max(pct, done > 0 ? 3 : 0)}%` }} />
              </div>
            )}

            {left === 1 && confirm !== c.id ? (
              <p className="rounded-[14px] bg-pollen-pale px-3 py-2.5 text-sm leading-snug">
                <strong>Plus qu&apos;une fois.</strong> Le défi est presque bouclé.
              </p>
            ) : null}

            {confirm === c.id ? (
              <div className="flex flex-col gap-2 rounded-[14px] bg-pollen-pale p-3">
                <p className="text-sm font-semibold">
                  Annuler ce défi ?{" "}
                  <span className="font-normal text-brun">
                    {c.duel
                      ? "Le duel, lui, continue : pour garder ta mise de 10 pousses, il faudra quand même atteindre l'objectif."
                      : "Ce que tu as déjà fait reste compté."}
                  </span>
                </p>
                <div className="flex gap-2">
                  <form action={cancel} className="flex-1">
                    <input type="hidden" name="challenge" value={c.id} />
                    <button type="submit" className="btn-dark min-h-11 w-full text-sm">Oui, annuler</button>
                  </form>
                  <button type="button" onClick={() => setConfirm(null)} className="btn-ghost min-h-11 flex-1 text-sm">Garder</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href={c.href ?? "/agir"} className="btn-dark min-h-11 flex-1">
                  Je l&apos;ai fait
                </Link>
                <details className="relative">
                  <summary
                    aria-label="Plus d'options pour ce défi"
                    className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full bg-sable text-sapin [&::-webkit-details-marker]:hidden"
                  >
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="5" cy="12" r="1.8" />
                      <circle cx="12" cy="12" r="1.8" />
                      <circle cx="19" cy="12" r="1.8" />
                    </svg>
                  </summary>
                  <div className="absolute right-0 bottom-12 z-10 flex w-52 flex-col rounded-[14px] bg-papier p-1.5 shadow-[0_8px_28px_rgba(20,38,27,0.16)]">
                    {c.duelHref ? (
                      <Link href={c.duelHref} className="flex h-11 items-center rounded-xl px-3 text-sm font-semibold hover:bg-sable">
                        Passer en duel · ×1,5
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setConfirm(c.id)}
                      className="flex h-11 items-center rounded-xl px-3 text-left text-sm font-semibold text-alerte hover:bg-sable"
                    >
                      Annuler le défi
                    </button>
                  </div>
                </details>
              </div>
            )}
          </article>
        );
      })}
    </>
  );
}
