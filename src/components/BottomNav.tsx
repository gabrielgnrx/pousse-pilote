"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/fil",
    label: "Fil",
    icon: (
      <>
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </>
    ),
  },
  {
    href: "/bilan",
    label: "Bilan",
    icon: (
      <>
        <path d="M12 2v10l7 7" />
        <circle cx="12" cy="12" r="10" />
      </>
    ),
  },
  {
    href: "/defis",
    label: "Défis",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
  },
  {
    href: "/scanner",
    label: "Scanner",
    icon: (
      <>
        <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
        <path d="M8 8v8M11 8v8M14 8v8M17 8v8" />
      </>
    ),
  },
  {
    href: "/equipes",
    label: "Équipes",
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6M15 14.5c3 0 6 2 6 5" />
      </>
    ),
  },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-encre/10 bg-sable pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex h-[72px] max-w-md items-center justify-around">
        {TABS.map((t) => {
          const active = path === t.href || path.startsWith(`${t.href}/`);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-14 flex-col items-center gap-1 py-1 ${active ? "text-argile" : "text-terre"}`}
              >
                <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
                  {t.icon}
                </svg>
                <span className={`text-[11px] ${active ? "font-bold" : "font-semibold"}`}>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
