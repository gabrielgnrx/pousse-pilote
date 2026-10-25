"use client";
import { useActionState } from "react";
import { createOrganization, type LaunchState } from "./actions";
import { FormError, SubmitButton } from "@/components/ui";

export function LaunchForm({ emailDomain }: { emailDomain: string }) {
  const [state, action] = useActionState<LaunchState, FormData>(createOrganization, {});
  return (
    <form action={action} className="card flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="label">Nom de l&apos;organisation</span>
        <input name="name" required minLength={2} maxLength={80} className="input" placeholder="Ex. Verdure Conseil" />
      </label>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="label">Qui peut rejoindre ?</legend>
        <input type="hidden" name="domain" value={emailDomain} />
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="restrict" defaultChecked className="mt-0.5 size-5 accent-sapin" />
          <span>Seulement les adresses <strong>@{emailDomain}</strong> (recommandé). Sinon, toute personne qui a le lien d&apos;invitation.</span>
        </label>
      </fieldset>
      <label className="flex flex-col gap-1.5">
        <span className="label">Équipes, une par ligne</span>
        <textarea name="teams" required rows={5} className="input" placeholder={"Data\nConseil\nOps"} />
        <span className="text-xs text-terre">5 personnes minimum par équipe pour apparaître au classement (anonymat).</span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="consent" required className="mt-0.5 size-5 accent-sapin" />
        <span>
          Je m&apos;engage à présenter Pousse comme une participation volontaire, sans lien avec l&apos;évaluation des salariés. Je
          n&apos;aurai accès qu&apos;à des totaux, jamais aux données d&apos;une personne.
        </span>
      </label>
      <FormError message={state.error} />
      <SubmitButton pendingLabel="Création…">Créer l&apos;organisation</SubmitButton>
    </form>
  );
}
