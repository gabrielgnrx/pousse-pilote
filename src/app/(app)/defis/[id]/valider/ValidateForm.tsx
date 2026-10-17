"use client";
import { useActionState, useState } from "react";
import { validateDay } from "./actions";
import { FormError, SubmitButton } from "@/components/ui";
import { formatKg } from "@/lib/co2/challenges.ts";

export function ValidateForm({
  challengeId,
  unitKg,
  unit,
  maxUnits,
  proofHint,
  colleagues,
}: {
  challengeId: string;
  unitKg: number;
  unit: { one: string; many: string };
  maxUnits: number;
  proofHint: string;
  colleagues: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(validateDay, {});
  const [units, setUnits] = useState(1);
  const [photoName, setPhotoName] = useState<string>();
  const [witness, setWitness] = useState("");
  const [visibility, setVisibility] = useState<"company" | "private">("company");
  const proofLevel = (photoName ? 1 : 0) + (witness ? 1 : 0);
  const willPublish = proofLevel > 0 && visibility === "company";

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="challenge" value={challengeId} />
      <input type="hidden" name="units" value={units} />
      <input type="hidden" name="visibility" value={visibility} />

      {maxUnits > 1 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="label mb-2">Aujourd&apos;hui</legend>
          <div className="flex gap-2">
            {Array.from({ length: maxUnits }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={units === n}
                onClick={() => setUnits(n)}
                className={`h-12 flex-1 rounded-2xl font-bold ${units === n ? "bg-sapin text-sapin-clair" : "bg-sable"}`}
              >
                {n} {n > 1 ? unit.many : unit.one}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <p className="rounded-2xl bg-sauge px-4 py-3 text-sm font-bold text-[#2e3a22]">
        −{formatKg(unitKg * units)} de CO₂ · calcul confirmé par la base à l&apos;envoi
      </p>

      <fieldset className="flex flex-col gap-3">
        <legend className="label mb-2">Ta preuve</legend>
        <label className={`flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-4 py-4 text-center ${photoName ? "border-sapin bg-sauge" : "border-[#c7b78c] bg-sable"}`}>
          <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
          <span className="text-sm font-bold">{photoName ? "Photo ajoutée" : "Ajouter une photo"}</span>
          <span className="text-xs text-terre">{photoName ?? proofHint}</span>
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="sr-only"
            onChange={(e) => setPhotoName(e.target.files?.[0]?.name)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Un collègue peut confirmer ? (facultatif)</span>
          <select name="witness" value={witness} onChange={(e) => setWitness(e.target.value)} className="input">
            <option value="">Personne</option>
            {colleagues.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <span className="text-xs text-terre">S&apos;il refuse, la validation est annulée.</span>
        </label>
        <div className="flex items-center gap-3 rounded-xl bg-papier px-3 py-2">
          <span className="text-xs font-bold">Niveau de preuve</span>
          <div className="h-2 flex-1 rounded-full bg-trait">
            <div className={`h-2 rounded-full ${proofLevel === 2 ? "bg-sapin" : "bg-argile"}`} style={{ width: `${[6, 55, 100][proofLevel]}%` }} />
          </div>
          <span className="text-xs font-bold">{["Aucun", "Moyen", "Fort"][proofLevel]}</span>
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="label">Légende</span>
        <textarea name="caption" rows={2} maxLength={280} placeholder="Raconte ta journée en une phrase" className="input resize-none" />
      </label>

      <fieldset className="card flex flex-col gap-2">
        <legend className="sr-only">Partage</legend>
        <p className="font-display font-bold">Partager dans le fil de ton entreprise ?</p>
        <p className="text-xs text-brun">Rien n&apos;est publié sans ton accord, ni sans preuve.</p>
        {[
          { id: "company" as const, label: "Mes collègues", sub: "Visible dans le fil interne" },
          { id: "private" as const, label: "Garder pour moi", sub: "Compté dans tes défis, non publié" },
        ].map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={visibility === o.id}
            onClick={() => setVisibility(o.id)}
            className={`flex min-h-12 flex-col justify-center rounded-xl border-2 px-3 text-left ${visibility === o.id ? "border-sapin bg-sauge" : "border-transparent bg-creme"}`}
          >
            <span className="text-sm font-bold">{o.label}</span>
            <span className="text-xs text-terre">{o.sub}</span>
          </button>
        ))}
      </fieldset>

      <FormError message={state.error} />
      <SubmitButton pendingLabel="Validation…">{willPublish ? "Valider et publier" : "Valider sans publier"}</SubmitButton>
    </form>
  );
}
