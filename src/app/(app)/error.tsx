"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Une page a planté (base injoignable, réseau coupé…) : un message clair et de quoi réessayer. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section role="alert" className="card mt-6 flex flex-col items-center gap-3 py-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-peche" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6b4e0a" strokeWidth="2" strokeLinecap="round">
          <path d="M12 8v5M12 16.5v.5" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </span>
      <h1 className="font-display text-xl">Cette page n&apos;a pas pu se charger</h1>
      <p className="text-sm text-brun">
        La connexion a peut-être coupé, ou le service est momentanément indisponible. Tes actions déjà enregistrées ne sont
        pas perdues.
      </p>
      <div className="flex w-full flex-col gap-2 pt-1">
        <button type="button" onClick={reset} className="btn-dark">
          Réessayer
        </button>
        <Link href="/fil" className="btn-ghost">
          Retour à l&apos;accueil
        </Link>
      </div>
      {error.digest ? <p className="text-xs text-terre">Code : {error.digest}</p> : null}
    </section>
  );
}
