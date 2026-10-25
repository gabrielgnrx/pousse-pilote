import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Espace RSE · Pousse" };

/** L'espace des responsables RSE : sur ordinateur d'abord, utilisable sur téléphone. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/admin" aria-label="Tableau de bord RSE">
          <Logo />
        </Link>
        <nav aria-label="Espace RSE" className="flex flex-wrap gap-1.5 text-sm font-semibold">
          <Link href="/admin" className="chip min-h-9 bg-papier text-encre">Tableau de bord</Link>
          <Link href="/admin/rapport" className="chip min-h-9 bg-papier text-encre">Rapport mensuel</Link>
          <Link href="/admin/lancer" className="chip min-h-9 bg-papier text-encre">Organisation</Link>
        </nav>
      </header>
      <main className="flex flex-col gap-5">{children}</main>
    </div>
  );
}
