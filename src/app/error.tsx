"use client";

import AppError from "./(app)/error";

/** Erreurs hors des pages de l'appli (y compris l'en-tête commun) : même message, avec des marges. */
export default function RootError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <AppError {...props} />
    </main>
  );
}
