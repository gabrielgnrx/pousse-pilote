"use client";
import { useActionState, useState } from "react";
import { requestMagicLink, type JoinState } from "../rejoindre/actions";
import { CodeStep } from "../rejoindre/JoinFlow";
import { FormError, SubmitButton } from "@/components/ui";

/** Accès des responsables RSE : un e-mail, un code ou un lien, puis le lancement de l'organisation. */
export function AdminSignup() {
  const [attempt, setAttempt] = useState(0);
  return <Form key={attempt} restart={() => setAttempt((n) => n + 1)} />;
}

function Form({ restart }: { restart: () => void }) {
  const [state, action] = useActionState<JoinState, FormData>(requestMagicLink, {});
  if (state.sentTo) return <CodeStep state={state} onRestart={restart} next="/admin" />;
  return (
    <form action={action} className="card flex flex-col gap-3">
      <input type="hidden" name="mode" value="admin" />
      <label className="flex flex-col gap-1.5">
        <span className="label">Ton e-mail professionnel</span>
        <input name="email" type="email" required autoComplete="email" placeholder="prenom.nom@entreprise.fr" className="input" />
      </label>
      <FormError message={state.error} />
      <SubmitButton pendingLabel="Envoi…">Recevoir mon lien de connexion</SubmitButton>
      <p className="text-xs text-terre">Création du compte ou connexion : c&apos;est le même e-mail.</p>
    </form>
  );
}
