"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui";
import { buyItem, type BuyState } from "./actions";

/** Le bouton « Acheter » d'une plante, avec le message de réussite ou d'erreur juste dessous. */
export function BuyButton({ item, price, name, affordable }: { item: string; price: number; name: string; affordable: boolean }) {
  const [state, action] = useActionState<BuyState, FormData>(buyItem, {});
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="item" value={item} />
      <SubmitButton
        className={`min-h-11 w-full rounded-full px-3 text-sm font-bold disabled:opacity-50 ${affordable ? "bg-chloro text-white" : "bg-sable text-terre"}`}
        disabled={!affordable}
        pendingLabel="Achat…"
      >
        <span className="sr-only">Acheter {name} pour </span>
        {price} pousses
      </SubmitButton>
      <p aria-live="polite" className={`text-xs leading-snug ${state.error ? "font-semibold text-alerte" : "text-sapin"}`}>
        {state.error ?? state.ok ?? ""}
      </p>
    </form>
  );
}
