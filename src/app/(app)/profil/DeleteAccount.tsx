"use client";
import { useActionState, useState } from "react";
import { deleteAccount } from "./actions";
import { FormError, SubmitButton } from "@/components/ui";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteAccount, {});
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-bold text-argile-fonce underline">
        Supprimer mon compte et mes données
      </button>
    );
  }
  return (
    <form action={action} className="card flex flex-col gap-3 border-argile">
      <p className="text-sm leading-relaxed">
        Ton profil, tes bilans, tes défis et tes photos seront supprimés définitivement. Tes réponses au
        questionnaire restent, sans aucun lien avec toi.
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">Écris SUPPRIMER pour confirmer</span>
        <input name="confirm" autoComplete="off" className="input" />
      </label>
      <FormError message={state.error} />
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1 text-sm">Annuler</button>
        <SubmitButton className="btn-primary flex-1 text-sm" pendingLabel="Suppression…">Supprimer</SubmitButton>
      </div>
    </form>
  );
}
