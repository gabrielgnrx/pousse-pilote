"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { isIslandPath } from "./IslandProvider";

/**
 * Les rubriques s'ouvrent en panneau par-dessus l'île, comme les menus d'un jeu : l'île reste visible
 * en haut, en pause. Sur l'île elle-même, la page (les commandes du jeu) se pose directement dessus.
 */
export function GamePanel({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const scroller = useRef<HTMLDivElement>(null);
  const section = path.split("/")[1] ?? "";

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [path]);

  if (isIslandPath(path)) return <>{children}</>;

  return (
    // Pas de z-index ici : il enfermerait les fenêtres des pages (z-40) sous la barre du bas.
    <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col" style={{ top: "calc(env(safe-area-inset-top, 0px) + 116px)" }}>
      <div
        key={section}
        className="flex min-h-0 flex-1 flex-col rounded-t-[28px] bg-creme shadow-[0_-10px_30px_rgba(20,38,27,0.22)] motion-safe:animate-[panel-up_0.32s_cubic-bezier(0.2,0.9,0.3,1.15)]"
      >
        <Link href="/ile" aria-label="Revenir sur l'île" className="flex h-7 shrink-0 items-center justify-center">
          <span aria-hidden="true" className="h-1.5 w-11 rounded-full bg-trait" />
        </Link>
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <main className="flex flex-col gap-4 px-4 pb-28">{children}</main>
        </div>
      </div>
    </div>
  );
}
