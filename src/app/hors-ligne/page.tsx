import { Sprout } from "@/components/Logo";

export const metadata = { title: "Hors ligne · Pousse" };

/** Affichée par le service worker quand le téléphone n'a pas de réseau. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <Sprout size={56} />
      <h1 className="font-display text-2xl">Pas de réseau</h1>
      <p className="text-sm leading-relaxed text-brun">
        Ta plante t&apos;attend. Dès que la connexion revient, recharge la page pour retrouver tes défis et tes pousses.
      </p>
      <a href="/fil" className="btn-primary">Réessayer</a>
    </main>
  );
}
