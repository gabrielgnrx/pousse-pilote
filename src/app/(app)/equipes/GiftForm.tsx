"use client";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/ui";
import { giftMyosotis } from "../ile/graineterie/actions";

/** Offrir le myosotis du jour à un collègue : il apparaît dans ses graines, sur son île. */
export function GiftForm({ colleagues }: { colleagues: { id: string; name: string; team: boolean }[] }) {
  const [state, action] = useActionState(giftMyosotis, {});
  const [to, setTo] = useState("");
  const mates = colleagues.filter((c) => c.team);
  const others = colleagues.filter((c) => !c.team);

  if (state.ok) {
    return (
      <p role="status" className="rounded-[18px] bg-sauge px-3 py-2.5 text-sm font-bold text-sapin">
        {state.ok}
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-2 rounded-[18px] bg-sable p-3">
      <label htmlFor="cadeau" className="text-sm font-bold">
        Offrir le myosotis du jour
      </label>
      <p className="-mt-1 text-xs text-brun">Une fleur qui ne s&apos;achète pas : trois myosotis sur une île attirent le rouge-gorge.</p>
      <div className="flex gap-2">
        <select id="cadeau" name="to" value={to} onChange={(e) => setTo(e.target.value)} required className="input min-h-11 min-w-0 flex-1">
          <option value="" disabled>
            Choisis un collègue
          </option>
          {mates.length ? (
            <optgroup label="Ton équipe">
              {mates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {others.length ? (
            <optgroup label="Autres équipes">
              {others.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
        <SubmitButton className="btn-primary min-h-11 shrink-0 px-4 text-sm" disabled={!to} pendingLabel="Envoi…">
          Offrir
        </SubmitButton>
      </div>
      {state.error ? (
        <p role="alert" className="text-xs font-semibold text-alerte">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
