"use client";

/** Petits utilitaires navigateur : installation et abonnement push. */
export interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const bin = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// L'événement d'installation (Chrome, Edge, Android) peut arriver avant que le composant soit monté.
let deferred: InstallEvent | null = null;
const listeners = new Set<(e: InstallEvent | null) => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    listeners.forEach((l) => l(deferred));
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l(null));
  });
}
export function onInstallPrompt(cb: (e: InstallEvent | null) => void) {
  cb(deferred);
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
