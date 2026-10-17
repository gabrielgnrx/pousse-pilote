"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "idle" | "starting" | "scanning" | "unsupported" | "denied";

// Lecteur de secours (Safari, Firefox) : ZXing, chargé seulement s'il est nécessaire.
const ZXING_URL = "https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js";

interface ZXingGlobal {
  BrowserMultiFormatReader: new () => {
    decodeFromVideoDevice: (
      deviceId: string | undefined,
      video: HTMLVideoElement,
      cb: (result: { getText(): string } | null) => void,
    ) => Promise<unknown>;
    reset: () => void;
  };
}

function loadZXing(): Promise<ZXingGlobal> {
  const w = window as unknown as { ZXing?: ZXingGlobal };
  if (w.ZXing) return Promise.resolve(w.ZXing);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = ZXING_URL;
    s.async = true;
    s.onload = () => (w.ZXing ? resolve(w.ZXing) : reject(new Error("zxing")));
    s.onerror = () => reject(new Error("zxing"));
    document.head.appendChild(s);
  });
}

const valid = (code: string) => /^\d{8}$|^\d{12,14}$/.test(code);

/** Scan du code-barres avec la caméra (BarcodeDetector, sinon ZXing), et saisie à la main. */
export function Scanner() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const stop = useRef<() => void>(() => {});
  const [mode, setMode] = useState<Mode>("idle");
  const [manual, setManual] = useState("");

  useEffect(() => () => stop.current(), []);

  const found = (code: string) => {
    if (!valid(code)) return;
    stop.current();
    if (navigator.vibrate) navigator.vibrate(60);
    router.push(`/scanner/${code}`);
  };

  async function start() {
    setMode("starting");
    try {
      const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      if (Detector) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        setMode("scanning");
        const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
        let alive = true;
        stop.current = () => {
          alive = false;
          stream.getTracks().forEach((t) => t.stop());
        };
        const loop = async () => {
          if (!alive) return;
          try {
            const codes = await detector.detect(v);
            const code = codes.map((c) => c.rawValue).find(valid);
            if (code) return found(code);
          } catch {
            /* image pas prête : on réessaie */
          }
          setTimeout(loop, 250);
        };
        loop();
        return;
      }
      const ZXing = await loadZXing();
      const reader = new ZXing.BrowserMultiFormatReader();
      setMode("scanning");
      stop.current = () => reader.reset();
      await reader.decodeFromVideoDevice(undefined, video.current!, (result) => {
        if (result) found(result.getText());
      });
    } catch (e) {
      stop.current();
      const name = e instanceof Error ? e.name : "";
      setMode(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unsupported");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-encre">
        <video ref={video} muted playsInline className={`h-full w-full object-cover ${mode === "scanning" ? "" : "opacity-0"}`} />
        {mode === "scanning" ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-10 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-abricot" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sapin-clair">
            <svg aria-hidden="true" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
              <path d="M8 8v8M11 8v8M14 8v8M17 8v8" />
            </svg>
            {mode === "denied" ? (
              <p className="text-sm">Accès à la caméra refusé. Autorise-le dans ton navigateur, ou tape le code ci-dessous.</p>
            ) : mode === "unsupported" ? (
              <p className="text-sm">Caméra indisponible sur cet appareil. Tape le code-barres ci-dessous.</p>
            ) : (
              <button type="button" onClick={start} disabled={mode === "starting"} className="btn-primary">
                {mode === "starting" ? "Ouverture de la caméra…" : "Scanner un produit"}
              </button>
            )}
          </div>
        )}
      </div>
      {mode === "scanning" ? (
        <p className="text-center text-sm text-terre">Vise le code-barres, il se lit tout seul.</p>
      ) : null}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          found(manual.trim());
        }}
      >
        <label className="sr-only" htmlFor="code">Code-barres</label>
        <input
          id="code"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Ou tape le code-barres (13 chiffres)"
          value={manual}
          onChange={(e) => setManual(e.target.value.replace(/\D/g, "").slice(0, 14))}
          className="input min-w-0 flex-1"
        />
        <button type="submit" disabled={!valid(manual)} className="btn-dark px-4 text-sm">Voir</button>
      </form>
    </div>
  );
}
