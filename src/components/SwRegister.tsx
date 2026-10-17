"use client";
import { useEffect } from "react";

/** Enregistre le service worker (appli installable, page hors ligne, rappels). */
export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
      // Ouvrir l'appli efface la pastille du rappel.
      (navigator as Navigator & { clearAppBadge?: () => Promise<void> }).clearAppBadge?.().catch(() => {});
    }
  }, []);
  return null;
}
