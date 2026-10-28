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

/** Dans Mon plan : mes défis en cours, avec de quoi avancer… ou annuler. */
export function ActiveChallenges({ items, cancel }: { items: ActiveChallenge[]; cancel: (form: FormData) => Promise<void> }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!items.length) return null;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="mes-defis">
      <h2 id="mes-defis" className="font-display text-xl">Mes défis en cours</h2>
      {items.map((c) => {
        const pct = Math.min(100, (c.done / c.target) * 100);
        return (
          <article key={c.id} className="flex flex-col gap-3 rounded-[24px] bg-papier p-4 shadow-[0_8px_28px_rgba(31,42,30,0.06)]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className={`mb-1.5 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${c.duel ? "bg-sapin text-sapin-clair" : "bg-sable text-brun"}`}>
                  {c.duel ? "Duel · ×1,5" : "Seul · ×1"}
                </span>
                <p className="font-display text-lg leading-snug">{c.title}</p>
                <p className="text-[13px] text-terre">
                  {c.done}/{c.target} {c.target > 1 ? c.unit.many : c.unit.one} · jusqu&apos;au {c.endsOn}
                </p>
              </div>
              {c.duel ? (
                <span className="shrink-0 rounded-full bg-peche px-2 py-1 text-xs font-bold text-argile-fonce">
                  {c.duel.status === "pending" ? `Duel envoyé à ${c.duel.other}` : `${c.duel.other} : ${Math.min(c.duel.theirs, c.target)}`}
                </span>
              ) : null}
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-sable">
              <div className="h-2.5 rounded-full bg-sapin" style={{ width: `${Math.max(pct, c.done > 0 ? 3 : 0)}%` }} />
            </div>
            {confirm === c.id ? (
              <div className="flex flex-col gap-2 rounded-xl bg-peche p-3">
                <p className="text-sm font-semibold text-brun">
                  Annuler ce défi ?{" "}
                  {c.duel
                    ? "Le duel, lui, continue : pour garder ta mise de 10 pousses, il faudra quand même atteindre l'objectif."
                    : "Ce que tu as déjà fait reste compté."}
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
              <div className="flex gap-2">
                <Link href={c.href ?? "/agir"} className="btn-primary min-h-[46px] flex-1">
                  Je l&apos;ai fait
                </Link>
                <button
                  type="button"
                  onClick={() => setConfirm(c.id)}
                  className="flex min-h-[46px] items-center rounded-2xl border border-trait px-3.5 text-[13px] font-medium text-terre"
                >
                  Annuler le défi
                </button>
              </div>
            )}
            {c.duelHref && confirm !== c.id ? (
              <Link href={c.duelHref} className="self-end text-xs font-bold text-sapin underline underline-offset-2">
                Passer en duel · ×1,5 ›
              </Link>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
