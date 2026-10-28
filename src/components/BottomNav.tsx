"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string; also?: string[]; icon: React.ReactNode };

const LEFT: Tab[] = [
  {
    href: "/fil",
    label: "Accueil",
    icon: (
      <>
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </>
    ),
  },
  {
    href: "/defis",
    label: "Mon plan",
    also: ["/duels"],
    icon: (
      <>
        <path d="M12 21v-9" />
        <path d="M12 12c0-4 3-7 8-7 0 5-3 7-8 7Z" />
        <path d="M12 15c0-3-2.5-5.5-7-5.5 0 4 2.5 5.5 7 5.5Z" />
      </>
    ),
  },
];

const RIGHT: Tab[] = [
  {
    href: "/informer",
    label: "S'informer",
    also: ["/scanner", "/quiz"],
    icon: (
      <>
        <path d="M9 18h6M10 21h4" />
        <path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3Z" />
      </>
    ),
  },
  {
    href: "/equipes",
    label: "Équipe",
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6M15 14.5c3 0 6 2 6 5" />
      </>
    ),
  },
];

function TabLink({ t, path }: { t: Tab; path: string }) {
  const active = [t.href, ...(t.also ?? [])].some((h) => path === h || path.startsWith(`${h}/`));
  return (
    <li className="flex flex-1 justify-center">
      <Link
        href={t.href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-[52px] min-w-14 flex-col items-center justify-center gap-0.5 ${active ? "text-sapin" : "text-brun"}`}
      >
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" style={active ? { fill: "var(--color-sauge)" } : undefined} stroke="currentColor" strokeWidth={active ? 2.2 : 1.9} strokeLinecap="round" strokeLinejoin="round">
          {t.icon}
        </svg>
        <span className={`text-[11px] ${active ? "font-bold" : "font-semibold"}`}>{t.label}</span>
      </Link>
    </li>
  );
}

export function BottomNav() {
  const path = usePathname();
  const recording = path === "/agir" || path.startsWith("/agir/");
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-20 bg-papier pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--color-trait)]"
    >
      <ul className="mx-auto flex h-[68px] max-w-md items-center px-2">
        {LEFT.map((t) => (
          <TabLink key={t.href} t={t} path={path} />
        ))}
        <li className="flex flex-1 justify-center">
          <Link
            href="/agir"
            aria-label="Enregistrer une action"
            aria-current={recording ? "page" : undefined}
            className="-mt-8 flex size-[60px] items-center justify-center rounded-full bg-pollen text-encre shadow-[0_0_0_5px_var(--color-papier),0_8px_18px_rgba(20,38,27,0.18)] transition active:scale-95"
          >
            <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        </li>
        {RIGHT.map((t) => (
          <TabLink key={t.href} t={t} path={path} />
        ))}
      </ul>
    </nav>
  );
}
