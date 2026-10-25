"use client";

/** Ouvre la boîte d'impression du navigateur (« Enregistrer en PDF »). */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-dark min-h-11 text-sm print:hidden">
      Imprimer ou enregistrer en PDF
    </button>
  );
}
