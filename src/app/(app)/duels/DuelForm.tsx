"use client";
import { useActionState } from "react";
import { challengeDuel } from "@/lib/game/actions";
import { DUEL_KINDS, DUEL_STAKES } from "@/lib/game/labels.ts";

/** Lancer un duel : un collègue, un type d'action, un objectif sur 7 jours. */
export function DuelForm({
  colleagues,
  defaultOpponent,
  defaultKind,
}: {
  colleagues: { id: string; name: string }[];
  defaultOpponent?: string;
  defaultKind?: string;
}) {
  const [state, action, pending] = useActionState(challengeDuel, {});
  return (
    <form action={action} className="card flex flex-col gap-3" aria-labelledby="nouveau-duel">
      <h2 id="nouveau-duel" className="font-display text-lg">Défier un collègue</h2>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Qui ?
        <select name="opponent" required defaultValue={defaultOpponent ?? ""} className="input">
          <option value="" disabled>Choisis quelqu&apos;un d&apos;une autre équipe</option>
          {colleagues.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-semibold">Sur quoi ?</legend>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(DUEL_KINDS).map(([k, v]) => (
            <label key={k} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-creme px-3 text-sm has-[:checked]:bg-sauge has-[:checked]:font-bold">
              <input type="radio" name="kind" value={k} defaultChecked={k === (defaultKind ?? "repas")} className="accent-[#1f5134]" />
              {v.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Combien en 7 jours ?
        <select name="target" defaultValue="3" className="input">
          {[2, 3, 4, 5, 7].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
      <p className="text-xs leading-relaxed text-terre">
        Chaque action enregistrée avec le bouton + compte, avec ou sans photo, et vaut ×1,5 pendant le duel (pour le scanner : chaque meilleur choix). {DUEL_STAKES}
      </p>
      {state.error ? <p role="alert" className="text-sm font-semibold text-argile-fonce">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="btn-primary">{pending ? "Envoi…" : "Envoyer le défi"}</button>
    </form>
  );
}
