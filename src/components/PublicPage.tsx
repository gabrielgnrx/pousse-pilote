import Link from "next/link";
import { Logo } from "./Logo";

export function PublicPage({ title, lead, children }: { title: string; lead: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 px-6 py-8">
      <Link href="/" aria-label="Accueil Pousse">
        <Logo />
      </Link>
      <h1 className="font-display text-3xl">{title}</h1>
      <p className="text-[15px] leading-relaxed text-brun">{lead}</p>
      <div className="flex flex-col gap-4">{children}</div>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card flex flex-col gap-2 text-sm leading-relaxed">
      <h2 className="font-display text-lg">{title}</h2>
      {children}
    </section>
  );
}
