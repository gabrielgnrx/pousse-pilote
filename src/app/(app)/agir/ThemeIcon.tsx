import type { Theme } from "@/lib/actions-catalog";

const PATHS: Record<Theme, React.ReactNode> = {
  trajets: (
    <>
      <circle cx="6" cy="17" r="3" />
      <circle cx="18" cy="17" r="3" />
      <path d="M6 17 10 9h5l3 8M10 9 8 6H6" />
    </>
  ),
  repas: (
    <>
      <path d="M4 11h16a8 8 0 0 1-16 0Z" />
      <path d="M12 7c0-2 1-3 3-3" />
    </>
  ),
  achats: (
    <>
      <path d="M5 7h14l-1.5 12h-11Z" />
      <path d="M9 11c1 1.5 5 1.5 6 0" />
      <path d="M9 7a3 3 0 0 1 6 0" />
    </>
  ),
  maison: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M12 13v4" />
    </>
  ),
  voyages: (
    <>
      <rect x="6" y="3" width="12" height="14" rx="3" />
      <path d="M6 11h12M9 21l-2 0M15 21l2 0M9 17l-1.5 4M15 17l1.5 4" />
    </>
  ),
  bureau: (
    <>
      <path d="M4 20h4v-4h4v-4h4V8h4" />
    </>
  ),
  nature: (
    <>
      <path d="M12 22V12" />
      <path d="M12 12C7 12 4 9 4 4c5 0 8 3 8 8Z" />
      <path d="M12 15c0-4 3-7 8-7 0 4-3 7-8 7Z" />
    </>
  ),
};

/** Une seule couleur pour toutes les icônes de thème : elles sont posées sur une pastille lichen. */
const COLOR = "#1e5634";

export function ThemeIcon({ theme, size = 22, color }: { theme: Theme; size?: number; color?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[theme]}
    </svg>
  );
}
