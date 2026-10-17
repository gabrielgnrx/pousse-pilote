"use client";
import { useEffect, useState, useTransition } from "react";
import { isIOS, isStandalone, keyBytes, onInstallPrompt, pushSupported, type InstallEvent } from "@/lib/push/client";
import { ShareIcon } from "@/components/InstallPrompt";
import { removeSubscription, saveSubscription, sendTestReminder } from "./actions";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

/** Sur ton téléphone : installer l'appli et activer le rappel du soir (série en danger, quêtes à faire). */
export function PhoneCard({ vapidKey }: { vapidKey: string | null }) {
  const [state, setState] = useState<State>("loading");
  const [installed, setInstalled] = useState(false);
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIOS());
    const off = onInstallPrompt(setEvt);
    (async () => {
      if (!vapidKey || !pushSupported()) return setState(isIOS() && !isStandalone() ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
    return off;
  }, [vapidKey]);

  const enable = () =>
    start(async () => {
      setMsg(null);
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
        const reg = await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey!) }));
        const r = await saveSubscription(sub.toJSON());
        setState(r.ok ? "on" : "off");
        setMsg(r.ok ? "C'est noté : un rappel vers 18 h les jours où tu n'as encore rien fait." : "Impossible d'enregistrer ce téléphone, réessaie.");
      } catch {
        setMsg("Ton navigateur a refusé l'abonnement. Réessaie depuis l'appli installée.");
      }
    });

  const disable = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removeSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      setMsg("Rappels coupés sur ce téléphone.");
    });

  const test = () =>
    start(async () => {
      const r = await sendTestReminder();
      setMsg(r.error ?? "Rappel envoyé : il arrive dans quelques secondes.");
    });

  return (
    <section className="card flex flex-col gap-3" aria-labelledby="telephone">
      <h2 id="telephone" className="label">Sur ton téléphone</h2>

      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" width={40} height={40} className="rounded-[10px]" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-bold">Appli Pousse</p>
          <p className="text-xs text-terre">
            {installed
              ? "Installée sur cet appareil."
              : ios
                ? <>Dans Safari : touche <ShareIcon /> puis « Sur l&apos;écran d&apos;accueil ».</>
                : evt
                  ? "Ajoute-la à ton écran d'accueil, sans passer par un store."
                  : "Dans le menu du navigateur : « Installer l'application » ou « Ajouter à l'écran d'accueil »."}
          </p>
        </div>
        {!installed && evt ? (
          <button type="button" className="btn-primary min-h-10 px-4 text-sm" onClick={() => evt.prompt()}>
            Installer
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-3 border-t border-encre/10 pt-3">
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-bold">Rappel du soir</p>
          <p className="text-xs text-terre">
            {state === "on" && "Activé : vers 18 h, seulement si tu n'as encore rien fait dans la journée."}
            {state === "off" && "Vers 18 h, seulement les jours où ta série est en danger. Jamais plus d'un par jour."}
            {state === "ios-install" && "Sur iPhone, installe d'abord l'appli (ci-dessus), puis active le rappel depuis l'appli."}
            {state === "denied" && "Les notifications sont bloquées pour Pousse : autorise-les dans les réglages du navigateur."}
            {state === "unsupported" && (vapidKey ? "Ce navigateur ne gère pas les notifications." : "Bientôt disponible.")}
            {state === "loading" && "…"}
          </p>
        </div>
        {state === "off" ? (
          <button type="button" disabled={pending} onClick={enable} className="btn-primary min-h-10 px-4 text-sm">Activer</button>
        ) : null}
        {state === "on" ? (
          <button type="button" disabled={pending} onClick={disable} className="btn-ghost min-h-10 px-4 text-sm">Couper</button>
        ) : null}
      </div>
      {state === "on" ? (
        <button type="button" disabled={pending} onClick={test} className="self-start text-xs font-bold underline underline-offset-2">
          M&apos;envoyer un rappel de test
        </button>
      ) : null}
      {msg ? <p role="status" className="text-xs font-semibold text-sapin">{msg}</p> : null}
    </section>
  );
}
