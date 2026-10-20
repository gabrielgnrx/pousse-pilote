"use client";
import { useActionState } from "react";
import { FormError, SubmitButton } from "@/components/ui";
import { toDuel } from "./actions";

export function DuelFromChallenge({
  challengeId,
  rivals,
}: {
  challengeId: string;
  rivals: { id: string; name: string; team: string }[];
}) {
  const [state, action] = useActionState(toDuel, {});
  const teams = [...new Set(rivals.map((r) => r.team))];
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="challenge" value={challengeId} />
      <label className="flex flex-col gap-1 text-sm font-bold">
        Ton adversaire, dans une autre équipe
        <select name="opponent" defaultValue="" required className="input">
          <option value="" disabled>Choisis un adversaire</option>
          {teams.map((t) => (
            <optgroup key={t} label={`Équipe ${t}`}>
              {rivals.filter((r) => r.team === t).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <FormError message={state.error} />
      <SubmitButton pendingLabel="Envoi…">Envoyer le défi</SubmitButton>
    </form>
  );
}
