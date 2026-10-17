"use client";
import { useActionState } from "react";
import Link from "next/link";
import { requestMagicLink, type JoinState } from "./actions";
import { FormError, SubmitButton } from "@/components/ui";
import { Logo } from "@/components/Logo";

export default function RejoindrePage() {
  const [state, action] = useActionState<JoinState, FormData>(requestMagicLink, {});

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 py-8">
      <div className="flex items-center gap-3">
        <Logo />
        <span className="chip bg-sapin text-sapin-clair">Pilote entreprise</span>
      </div>

      {state.sentTo ? (
        <section className="mt-6 flex flex-col gap-4">
          <h1 className="font-display text-3xl font-bold">Vérifie ta boîte mail</h1>
          <p className="text-[15px] leading-relaxed text-brun">
            Un lien de connexion pour rejoindre <strong>{state.companyName}</strong> vient d&apos;être
            envoyé à <strong>{state.sentTo}</strong>. Ouvre-le sur cet appareil.
          </p>
          <p className="text-sm text-terre">Pas reçu ? Regarde dans les indésirables, ou recommence dans une minute.</p>
        </section>
      ) : (
        <form action={action} className="mt-2 flex flex-col gap-4">
          <h1 className="font-display text-3xl leading-tight font-bold">
            Ton entreprise participe au défi climat
          </h1>
          <p className="text-[15px] leading-relaxed text-brun">
            8 semaines pour réduire ton empreinte avec tes collègues. Participation volontaire :
            ton employeur ne voit jamais tes données personnelles.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="label">Code de l&apos;entreprise</span>
            <input name="code" required autoCapitalize="characters" placeholder="Ex. DEMO-2026" className="input tracking-wider uppercase" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">E-mail professionnel</span>
            <input name="email" type="email" required autoComplete="email" placeholder="prenom.nom@entreprise.fr" className="input" />
            <span className="text-xs text-terre">Tu reçois un lien de connexion, pas besoin de mot de passe.</span>
          </label>
          <FormError message={state.error} />
          <SubmitButton pendingLabel="Envoi du lien…">Recevoir mon lien</SubmitButton>
        </form>
      )}

      <Link href="/confidentialite" className="mt-auto text-center text-sm font-semibold text-brun underline">
        Tes données, en clair
      </Link>
    </main>
  );
}
