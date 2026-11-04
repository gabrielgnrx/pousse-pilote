"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { levelFor } from "@/lib/co2/engagement.ts";

/** Fait défiler un nombre depuis la dernière valeur vue sur cet appareil. */
function useCountUp(target: number, storageKey: string) {
  const [shown, setShown] = useState(target);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    let previous = target;
    try {
      const raw = window.localStorage.getItem(storageKey);
      previous = raw !== null && Number.isFinite(Number(raw)) ? Number(raw) : target;
      window.localStorage.setItem(storageKey, String(target));
    } catch {
      return;
    }
    if (previous >= target || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setShown(previous);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1200);
      setShown(previous + (target - previous) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, storageKey]);
  return shown;
}

const RING = 2 * Math.PI * 19;

/** Le titre affiché à côté de l'avatar, pour les 4 onglets de la barre du bas. */
const TITLES: { prefix: string; title: string }[] = [
  { prefix: "/fil", title: "Pousse" },
  { prefix: "/defis", title: "Mon plan" },
  { prefix: "/duels", title: "Mon plan" },
  { prefix: "/informer", title: "S'informer" },
  { prefix: "/scanner", title: "S'informer" },
  { prefix: "/quiz", title: "S'informer" },
  { prefix: "/equipes", title: "Équipe" },
  // Les pages du profil (ouvertes par l'avatar) : pas d'onglet allumé, donc un bouton retour.
  { prefix: "/profil", title: "Profil" },
  { prefix: "/bilan", title: "Mon bilan" },
  { prefix: "/jardin", title: "Jardin" },
  { prefix: "/notifications", title: "Notifications" },
  { prefix: "/regles", title: "Le barème" },
  { prefix: "/avis", title: "Ton avis" },
];
const BACK = ["/profil", "/bilan", "/jardin", "/notifications", "/regles", "/avis"];

/**
 * La barre du haut, identique sur toutes les pages : l'avatar (ton niveau en anneau) qui ouvre ton profil,
 * le nom de la rubrique, et un seul compteur pour le jeu : tes pousses et ta série.
 * La jauge de l'entreprise vit sur l'accueil (CompanyHero), plus ici.
 */
export function ProgressHud({
  initial,
  total,
  streak,
  notifications,
  teamName,
}: {
  initial: string;
  total: number;
  streak: number;
  notifications: number;
  /** Le nom de ton équipe : l'onglet Équipe s'appelle « QG <équipe> ». */
  teamName: string | null;
}) {
  const path = usePathname();
  const router = useRouter();
  const withBack = BACK.some((p) => path === p || path.startsWith(`${p}/`));
  const level = levelFor(total);
  const pousses = Math.round(useCountUp(total, "pousse.hud.total"));
  const found = TITLES.find((t) => path === t.prefix || path.startsWith(`${t.prefix}/`))?.title ?? "Pousse";
  const title = path === "/equipes" ? (teamName ? `QG ${teamName}` : "QG de l'équipe") : found;

  return (
    <header className="flex items-center gap-2.5 px-5 pt-4 pb-2">
      {withBack ? (
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/fil"))}
          aria-label="Retour"
          className="-mr-1 flex size-11 shrink-0 items-center justify-center rounded-full bg-papier shadow-[inset_0_0_0_1px_var(--color-trait)]"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#14261b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="m11 6-6 6 6 6" />
          </svg>
        </button>
      ) : null}
      <Link
        href="/profil"
        aria-label={`Ton profil : niveau ${level.index + 1}, ${level.name}, ${total} pousses${level.next ? ` sur ${level.next.min}` : ""}`}
        className="relative size-11 shrink-0"
      >
        <svg aria-hidden="true" width="44" height="44" viewBox="0 0 44 44" className="absolute inset-0">
          <circle cx="22" cy="22" r="19" fill="none" stroke="#d5dfcf" strokeWidth="4" />
          <circle
            cx="22"
            cy="22"
            r="19"
            fill="none"
            stroke="#2e7a4c"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - Math.max(0.03, level.progress))}
            transform="rotate(-90 22 22)"
            className="transition-[stroke-dashoffset] duration-1000"
          />
        </svg>
        <span className="absolute inset-[6px] flex items-center justify-center rounded-full bg-pollen-pale font-display text-[16px] text-encre">
          {initial}
        </span>
        <span className="absolute -right-1 -bottom-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-creme bg-nuit px-1 text-[11px] font-bold text-white">
          {level.index + 1}
        </span>
      </Link>

      <p className={`min-w-0 flex-1 truncate font-display ${withBack ? "text-xl" : "text-[26px]"}`}>{title}</p>

      <Link
        href="/profil#pousses"
        aria-label={`${total} pousses, série de ${streak} jour${streak > 1 ? "s" : ""} d'affilée`}
        className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-papier px-3 text-sm font-bold text-encre shadow-[inset_0_0_0_1px_var(--color-trait)]"
      >
        <span className="flex items-center gap-1 tabular-nums">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2e7a4c" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 21v-9" />
            <path d="M12 12c0-4 3-7 8-7 0 5-3 7-8 7Z" />
            <path d="M12 15c0-3-2.5-5.5-7-5.5 0 4 2.5 5.5 7 5.5Z" />
          </svg>
          {pousses.toLocaleString("fr-FR")}
        </span>
        <span aria-hidden="true" className="h-4 w-px bg-trait" />
        <span className="flex items-center gap-1">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill={streak > 0 ? "#f2c14e" : "none"} stroke="#8a6512" strokeWidth="1.8">
            <path d="M12 2c2 4-2 5-2 8a4 4 0 1 0 8 0c0-2-1-3-2-4 1 3-1 4-2 3 1-2-1-3-2-7Z" />
          </svg>
          {streak} j
        </span>
      </Link>
      <Link
        href="/notifications"
        aria-label={notifications ? `Notifications, ${notifications} nouvelle${notifications > 1 ? "s" : ""}` : "Notifications"}
        className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-papier shadow-[inset_0_0_0_1px_var(--color-trait)]"
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a5a4e" strokeWidth="1.8">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {notifications ? <span className="absolute top-2 right-2.5 size-2.5 rounded-full bg-alerte" /> : null}
      </Link>
    </header>
  );
}
