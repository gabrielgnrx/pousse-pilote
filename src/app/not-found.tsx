import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-3xl font-bold">Page introuvable</p>
      <p className="text-brun">Ce lien ne mène nulle part, ou ce défi n&apos;est pas le tien.</p>
      <Link href="/" className="btn-primary">Retour à l&apos;accueil</Link>
    </main>
  );
}
