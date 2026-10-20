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
}

/** Sur l'accueil : mes défis en cours, avec de quoi avancer… ou annuler. */
export function ActiveChallenges({ items, cancel }: { items: ActiveChallenge[]; cancel: (form: FormData) => Promise<void> }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!items.length) return null;
  return (
    <section className="flex flex-col gap-2" aria-labelledby="mes-defis">
      <div className="flex items-baseline justify-between">
        <h2 id="mes-defis" className="font-display text-xl font-bold">Mes défis en cours</h2>
        <Link href="/defis?onglet=catalogue" className="text-xs font-bold underline underline-offset-2">+ Défi</Link>
      </div>
      {items.map((c) => {
        const pct = Math.min(100, (c.done / c.target) * 100);
        return (
          <article key={c.id} className="flex flex-col gap-2 rounded-[18px] bg-papier p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className={`mb-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${c.duel ? "bg-sapin text-sapin-clair" : "bg-sable text-brun"}`}>
                  {c.duel ? "Duel · ×1,5" : "Seul · ×1"}
                </span>
                <p className="text-[15px] leading-snug font-bold">{c.title}</p>
                <p className="text-xs text-[#5e5240]">
                  {c.done}/{c.target} {c.target > 1 ? c.unit.many : c.unit.one} · jusqu&apos;au {c.endsOn}
                </p>
              </div>
              {c.duel ? (
                <span className="shrink-0 rounded-full bg-peche px-2 py-1 text-xs font-bold text-argile-fonce">
                  {c.duel.status === "pending" ? `Duel envoyé à ${c.duel.other}` : `⚔ ${c.duel.other} : ${Math.min(c.duel.theirs, c.target)}`}
                </span>
              ) : null}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#e6dcc6]">
              <div className="h-2 rounded-full bg-[#2f6b3a]" style={{ width: `${Math.max(pct, c.done > 0 ? 3 : 0)}%` }} />
            </div>
            {confirm === c.id ? (
              <div className="flex flex-col gap-2 rounded-xl bg-peche p-3">
                <p className="text-sm font-semibold text-[#5a4324]">
                  Annuler ce défi ?{" "}
                  {c.duel
                    ? "Le duel, lui, continue : pour garder ta mise de 10 pousses, il faudra quand même atteindre l'objectif."
                    : "Ce que tu as déjà fait reste compté."}
                </p>
                <div className="flex gap-2">
                  <form action={cancel} className="flex-1">
                    <input type="hidden" name="challenge" value={c.id} />
                    <button type="submit" className="btn-primary min-h-10 w-full text-sm">Oui, annuler</button>
                  </form>
                  <button type="button" onClick={() => setConfirm(null)} className="btn-ghost min-h-10 flex-1 text-sm">Garder</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link href="/agir" className="flex h-10 flex-1 items-center justify-center rounded-xl bg-[#2f5b36] text-[13px] font-bold text-[#f7f1e3]">
                  Je l&apos;ai fait
                </Link>
                <button
                  type="button"
                  onClick={() => setConfirm(c.id)}
                  className="flex h-10 items-center rounded-xl border border-[#cdbf9f] px-3.5 text-[13px] font-semibold"
                >
                  Annuler le défi
                </button>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
