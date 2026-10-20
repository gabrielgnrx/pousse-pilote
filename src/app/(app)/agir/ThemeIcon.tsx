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
};

const COLOR: Record<Theme, string> = {
  trajets: "#a24e22",
  repas: "#7a5a12",
  achats: "#3b4a2c",
  maison: "#4a4030",
  voyages: "#1f4a6b",
  bureau: "#3b4a2c",
};

export function ThemeIcon({ theme, size = 22, color }: { theme: Theme; size?: number; color?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? COLOR[theme]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[theme]}
    </svg>
  );
}
