"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { requestMagicLink, verifyCode, type JoinState, type VerifyState } from "./actions";
import { FormError, SubmitButton } from "@/components/ui";
import { Logo } from "@/components/Logo";

// Le code à 6 chiffres n'apparaît dans l'e-mail qu'une fois le modèle d'e-mail Supabase modifié
// (possible seulement avec un SMTP personnalisé). D'ici là, la connexion se fait par le lien.
const CODE_LOGIN = process.env.NEXT_PUBLIC_LOGIN_CODE === "1";

function CodeStep({ state, onRestart }: { state: JoinState; onRestart: () => void }) {
  const [verify, action] = useActionState<VerifyState, FormData>(verifyCode, {});
  return (
    <section className="mt-6 flex flex-col gap-4">
      <h1 className="font-display text-3xl">Vérifie ta boîte mail</h1>
      <p className="text-[15px] leading-relaxed text-brun">
        Un e-mail vient d&apos;être envoyé à <strong>{state.sentTo}</strong>
        {state.companyName ? (
          <>
            {" "}pour rejoindre <strong>{state.companyName}</strong>
          </>
        ) : null}
        .{" "}
        {CODE_LOGIN
          ? "Tape le code qu'il contient, ou clique sur son lien depuis cet appareil."
          : "Clique sur son lien depuis cet appareil et ce navigateur."}
      </p>
      {CODE_LOGIN ? (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="email" value={state.sentTo} />
          <label className="flex flex-col gap-1.5">
            <span className="label">Code reçu par e-mail</span>
            <input
              name="token"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,12}"
              maxLength={12}
              placeholder="123456"
              className="input text-center font-display text-2xl tracking-[0.4em]"
            />
          </label>
          <FormError message={verify.error} />
          <SubmitButton pendingLabel="Vérification…">Valider le code</SubmitButton>
        </form>
      ) : (
        <p className="rounded-2xl bg-sable px-4 py-3 text-sm text-brun">
          Sur téléphone, si le lien s&apos;ouvre dans un autre navigateur, reviens ici avec ce navigateur-là
          et choisis « J&apos;ai déjà un compte ».
        </p>
      )}
      <p className="text-sm text-terre">
        Pas reçu ? Regarde dans les indésirables, ou{" "}
        <button type="button" onClick={onRestart} className="font-semibold underline">
          recommence
        </button>{" "}
        dans une minute.
      </p>
    </section>
  );
}

export function JoinFlow({ initialMode = "join" }: { initialMode?: "join" | "login" }) {
  const [mode, setMode] = useState<"join" | "login">(initialMode);
  const [attempt, setAttempt] = useState(0);
  return <RequestForm key={`${mode}-${attempt}`} mode={mode} setMode={setMode} restart={() => setAttempt((n) => n + 1)} />;
}

function RequestForm({
  mode,
  setMode,
  restart,
}: {
  mode: "join" | "login";
  setMode: (m: "join" | "login") => void;
  restart: () => void;
}) {
  const [state, action] = useActionState<JoinState, FormData>(requestMagicLink, {});

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 py-8">
      <div className="flex items-center gap-3">
        <Logo />
        <span className="chip bg-sapin text-sapin-clair">Pilote entreprise</span>
      </div>

      {state.sentTo ? (
        <CodeStep state={state} onRestart={restart} />
      ) : (
        <>
          <nav aria-label="Première fois ou déjà inscrit" className="mt-2 flex rounded-full bg-sable p-1">
            {[
              { id: "join" as const, label: "Première fois" },
              { id: "login" as const, label: "J'ai déjà un compte" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={mode === t.id}
                onClick={() => setMode(t.id)}
                className={`flex h-10 flex-1 items-center justify-center rounded-full text-sm font-bold ${mode === t.id ? "bg-sapin text-sapin-clair" : "text-brun"}`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name="mode" value={mode} />
            {mode === "join" ? (
              <>
                <h1 className="font-display text-3xl leading-tight">Ton entreprise participe au défi climat</h1>
                <p className="text-[15px] leading-relaxed text-brun">
                  8 semaines pour réduire ton empreinte avec tes collègues. Participation volontaire : ton employeur
                  ne voit jamais tes données personnelles.
                </p>
                <label className="flex flex-col gap-1.5">
                  <span className="label">Code de l&apos;entreprise</span>
                  <input name="code" required autoCapitalize="characters" placeholder="Ex. ACME-2026" className="input tracking-wider uppercase" />
                </label>
              </>
            ) : (
              <>
                <h1 className="font-display text-3xl leading-tight">Bon retour !</h1>
                <p className="text-[15px] leading-relaxed text-brun">
                  Ton adresse suffit : on t&apos;envoie un e-mail pour te connecter sur cet appareil.
                </p>
              </>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="label">E-mail {mode === "join" ? "professionnel" : ""}</span>
              <input name="email" type="email" required autoComplete="email" placeholder="prenom.nom@entreprise.fr" className="input" />
              <span className="text-xs text-terre">Pas de mot de passe : tu reçois un e-mail de connexion.</span>
            </label>
            <FormError message={state.error} />
            <SubmitButton pendingLabel="Envoi…">Recevoir mon e-mail de connexion</SubmitButton>
          </form>
        </>
      )}

      <Link href="/confidentialite" className="mt-auto text-center text-sm font-semibold text-brun underline">
        Tes données, en clair
      </Link>
    </main>
  );
}
