"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { joinCompany, type WelcomeState } from "./actions";
import { FormError, SubmitButton } from "@/components/ui";

export function WelcomeForm({
  code,
  companyName,
  teams,
  defaultName,
}: {
  code: string;
  companyName: string;
  teams: { id: string; name: string }[];
  defaultName: string;
}) {
  const [state, action] = useActionState<WelcomeState, FormData>(joinCompany, {});
  const [team, setTeam] = useState<string>("");
  const [consentData, setConsentData] = useState(false);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 py-8">
      <h1 className="font-display text-3xl leading-tight">Bienvenue chez {companyName}</h1>

      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="code" value={code} />
        <input type="hidden" name="team" value={team} />

        <label className="flex flex-col gap-1.5">
          <span className="label">Ton prénom, visible par tes collègues</span>
          <input name="display_name" required maxLength={40} defaultValue={defaultName} className="input" />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="label mb-2">Ton équipe pour le défi inter-équipes</legend>
          <div className="grid grid-cols-2 gap-2">
            {teams.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={team === t.id}
                onClick={() => setTeam(t.id)}
                className={`min-h-12 rounded-2xl border-2 px-3 text-sm font-bold ${
                  team === t.id ? "border-sapin bg-sauge" : "border-transparent bg-sable"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="card flex flex-col gap-3">
          <legend className="sr-only">Tes données</legend>
          <p className="text-sm font-bold">Tes données, en clair</p>
          <label className="flex items-start gap-3 text-sm leading-snug">
            <input type="checkbox" name="consent_data" checked={consentData} onChange={(e) => setConsentData(e.target.checked)} className="mt-0.5 size-5 accent-sapin" />
            <span>J&apos;accepte que Pousse traite mes réponses et mes défis pour calculer mon empreinte (obligatoire).</span>
          </label>
          <label className="flex items-start gap-3 text-sm leading-snug">
            <input type="checkbox" name="consent_team_stats" defaultChecked className="mt-0.5 size-5 accent-sapin" />
            <span>Mes pousses comptent pour mon équipe (totaux anonymes). Sans cette case, tu comptes quand même dans l&apos;effectif de ton équipe, avec 0 pousse.</span>
          </label>
          <label className="flex items-start gap-3 text-sm leading-snug">
            <input type="checkbox" name="consent_feedback" defaultChecked className="mt-0.5 size-5 accent-sapin" />
            <span>Pousse peut me proposer un court questionnaire pendant le pilote.</span>
          </label>
          <Link href="/confidentialite" className="text-xs font-bold underline">Lire la politique de confidentialité</Link>
        </fieldset>

        <FormError message={state.error} />
        <SubmitButton disabled={!consentData || !team}>Faire mon bilan (2 min)</SubmitButton>
      </form>
    </main>
  );
}
