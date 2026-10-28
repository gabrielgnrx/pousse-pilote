"use client";
import { useEffect, useState } from "react";
import { isIOS, isStandalone, onInstallPrompt, type InstallEvent } from "@/lib/push/client";

const SEEN = "pousse.installation.vue";

/** Petit bandeau sur l'accueil : installer Pousse sur l'écran d'accueil (une fois, refermable). */
export function InstallPrompt() {
  const [mode, setMode] = useState<"none" | "prompt" | "ios">("none");
  const [evt, setEvt] = useState<InstallEvent | null>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN) === "1";
    } catch {
      /* stockage indisponible */
    }
    if (seen || isStandalone()) return;
    if (isIOS()) {
      setMode("ios");
      return;
    }
    return onInstallPrompt((e) => {
      setEvt(e);
      setMode(e ? "prompt" : "none");
    });
  }, []);

  const close = () => {
    try {
      localStorage.setItem(SEEN, "1");
    } catch {
      /* rien */
    }
    setMode("none");
  };

  if (mode === "none") return null;
  return (
    <section className="flex items-center gap-3 rounded-[20px] border border-encre/10 bg-papier px-3.5 py-2.5" aria-label="Installer Pousse">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" width={36} height={36} className="rounded-xl" />
      <p className="min-w-0 flex-1 text-xs leading-snug">
        <strong className="block text-sm">Pousse sur ton écran d&apos;accueil</strong>
        {mode === "ios" ? (
          <>Touche <ShareIcon /> puis « Sur l&apos;écran d&apos;accueil ».</>
        ) : (
          <>Une appli en un geste, et des rappels pour ta série.</>
        )}
      </p>
      {mode === "prompt" && evt ? (
        <button
          type="button"
          className="btn-primary min-h-9 px-3.5 text-sm"
          onClick={async () => {
            await evt.prompt();
            const { outcome } = await evt.userChoice;
            if (outcome === "accepted") close();
          }}
        >
          Installer
        </button>
      ) : null}
      <button type="button" onClick={close} aria-label="Fermer" className="flex size-9 items-center justify-center rounded-full text-terre">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </section>
  );
}

export function ShareIcon() {
  return (
    <svg aria-label="Partager" role="img" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline -mt-0.5">
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}
