"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { sendFeedback, type FeedbackState } from "./actions";
import { FormError, SubmitButton } from "@/components/ui";

const BRAKES = ["Pas le temps", "Défis pas adaptés", "Appli pas claire", "J'ai oublié", "Rien"];

export function FeedbackForm() {
  const [state, action] = useActionState<FeedbackState, FormData>(sendFeedback, {});
  const [motivation, setMotivation] = useState<number>();
  const [recommend, setRecommend] = useState<number>();

  if (state.sent) {
    return (
      <section className="flex flex-col items-center gap-3 pt-10 text-center">
        <p className="font-display text-2xl">Merci !</p>
        <p className="max-w-xs text-sm text-brun">Tes réponses aident à construire la suite de Pousse.</p>
        <Link href="/fil" className="btn-dark mt-2 w-full">Retour au fil</Link>
      </section>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="motivation" value={motivation ?? ""} />
      <input type="hidden" name="recommend" value={recommend ?? ""} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-bold">1. Pousse t&apos;a-t-il donné envie d&apos;agir cette semaine ?</legend>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-pressed={motivation === n} onClick={() => setMotivation(n)} className={`h-12 flex-1 rounded-xl font-bold ${motivation === n ? "bg-sapin text-sapin-clair" : "bg-sable"}`}>
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-terre"><span>Pas du tout</span><span>Énormément</span></div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-bold">2. Qu&apos;est-ce qui t&apos;a freiné ?</legend>
        <div className="flex flex-wrap gap-2">
          {BRAKES.map((b) => (
            <label key={b} className="relative">
              <input type="checkbox" name="brakes" value={b} className="peer sr-only" />
              <span className="flex min-h-10 cursor-pointer items-center rounded-full bg-sable px-4 text-sm font-semibold peer-checked:bg-sapin peer-checked:text-sapin-clair peer-focus-visible:outline-3 peer-focus-visible:outline-argile">
                {b}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-bold">3. Recommanderais-tu Pousse à un collègue ?</legend>
        <div className="grid grid-cols-11 gap-1">
          {Array.from({ length: 11 }, (_, n) => (
            <button key={n} type="button" aria-label={`${n} sur 10`} aria-pressed={recommend === n} onClick={() => setRecommend(n)} className={`h-10 rounded-lg text-sm font-bold ${recommend === n ? "bg-sapin text-sapin-clair" : "bg-sable"}`}>
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-terre"><span>Pas du tout</span><span>Certainement</span></div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="font-bold">Un mot de plus ? (facultatif)</span>
        <textarea name="comment" rows={3} maxLength={1000} placeholder="Une idée, un bug, un défi qui manque…" className="input resize-none" />
      </label>

      <FormError message={state.error} />
      <SubmitButton pendingLabel="Envoi…" disabled={motivation === undefined || recommend === undefined}>Envoyer</SubmitButton>
    </form>
  );
}
