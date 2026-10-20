"use client";

/** Dernier filet : même la mise en page principale n'a pas pu s'afficher. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, background: "#f4e8d0", color: "#2b2418", fontFamily: "system-ui, sans-serif" }}>
        <main role="alert" style={{ maxWidth: 420, margin: "0 auto", padding: "64px 20px", textAlign: "center" }}>
          <h1 style={{ fontSize: 22 }}>Pousse n&apos;a pas pu se charger</h1>
          <p style={{ lineHeight: 1.5 }}>La connexion a peut-être coupé. Tes actions déjà enregistrées ne sont pas perdues.</p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 12, minHeight: 48, padding: "0 24px", borderRadius: 999, border: 0, background: "#2f5b36", color: "#f7f1e3", fontSize: 16, fontWeight: 700 }}
          >
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
