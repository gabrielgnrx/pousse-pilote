"use client";
import { useActionState, useState } from "react";
import { createChallenge } from "./actions";
import { FormError, SubmitButton } from "@/components/ui";
import { carKmEquivalent, formatKg, impactLevel } from "@/lib/co2/challenges.ts";
import { DUEL_STAKES } from "@/lib/game/labels.ts";

interface VariantView {
  key: string;
  label: string;
  kg: number;
  eligible: boolean;
  reason?: string;
  formula: string;
}

const DURATIONS = [
  { days: 7, label: "1 semaine" },
  { days: 30, label: "1 mois" },
  { days: 90, label: "3 mois" },
];

export function NewChallengeForm({
  template,
  variants,
  initialVariant,
  inspiredBy,
  rivals,
}: {
  template: {
    id: string;
    unit: { one: string; many: string };
    variantQuestion?: string;
    proofHint: string;
    defaultTarget: number;
    pointsPerUnit: number;
    source: string;
  };
  variants: VariantView[];
  initialVariant: string;
  /** Publication d'un collègue à l'origine du défi (« Relever aussi »). */
  inspiredBy?: { id: string; name: string };
  /** Collègues des autres équipes, pour lancer le défi en duel. */
  rivals: { id: string; name: string; team: string }[];
}) {
  const [state, action] = useActionState(createChallenge, {});
  const [variant, setVariant] = useState(initialVariant);
  const [target, setTarget] = useState(template.defaultTarget);
  const [days, setDays] = useState(30);
  const [duel, setDuel] = useState(false);
  const [rival, setRival] = useState("");
  const teams = [...new Set(rivals.map((r) => r.team))];
  const chooseDuel = (on: boolean) => {
    setDuel(on);
    if (on) {
      setDays(7);
      setTarget((n) => Math.min(n, 10));
    }
  };
  const current = variants.find((v) => v.key === variant)!;
  const total = current.kg * target;
  const level = impactLevel(total);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="template" value={template.id} />
      <input type="hidden" name="variant" value={variant} />
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="days" value={days} />
      <input type="hidden" name="opponent" value={duel ? rival : ""} />
      {inspiredBy ? (
        <>
          <input type="hidden" name="via" value={inspiredBy.id} />
          <p className="rounded-2xl bg-sauge px-4 py-3 text-sm text-[#2e3a22]">
            Tu relèves ce défi grâce à <strong>{inspiredBy.name}</strong> : ta première validation lui
            rapportera 15 pousses.
          </p>
        </>
      ) : null}

      {variants.length > 1 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="label mb-2">{template.variantQuestion ?? "Option"}</legend>
          {variants.map((v) => (
            <button
              key={v.key}
              type="button"
              disabled={!v.eligible}
              aria-pressed={variant === v.key}
              onClick={() => setVariant(v.key)}
              className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border-2 px-4 py-2 text-left disabled:opacity-55 ${
                variant === v.key ? "border-sapin bg-sauge" : "border-transparent bg-sable"
              }`}
            >
              <span>
                <span className="block text-sm font-bold">{v.label}</span>
                {!v.eligible ? <span className="block text-xs text-terre">{v.reason}</span> : null}
              </span>
              <span className="text-xs font-bold whitespace-nowrap">{v.eligible ? formatKg(v.kg) : "0 kg pour toi"}</span>
            </button>
          ))}
        </fieldset>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-2">Ton objectif</legend>
        <div className="flex items-center justify-between rounded-2xl bg-sable p-3">
          <button type="button" aria-label="Diminuer l'objectif" onClick={() => setTarget((n) => Math.max(1, n - 1))} className="flex size-11 items-center justify-center rounded-full bg-creme text-2xl font-bold">−</button>
          <div className="text-center">
            <div className="font-display text-3xl font-bold">{target}</div>
            <div className="text-xs text-terre">{target > 1 ? template.unit.many : template.unit.one}</div>
          </div>
          <button type="button" aria-label="Augmenter l'objectif" onClick={() => setTarget((n) => Math.min(duel ? 10 : 100, n + 1))} className="flex size-11 items-center justify-center rounded-full bg-creme text-2xl font-bold">+</button>
        </div>
        <div className="flex gap-2">
          {(duel ? DURATIONS.slice(0, 1) : DURATIONS).map((d) => (
            <button
              key={d.days}
              type="button"
              aria-pressed={days === d.days}
              onClick={() => setDays(d.days)}
              className={`h-11 flex-1 rounded-full text-sm font-bold ${days === d.days ? "bg-sapin text-sapin-clair" : "bg-sable"}`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-2">Seul ou en duel ?</legend>
        <div className="flex gap-2">
          {[
            { on: false, label: "Seul" },
            { on: true, label: "En duel" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={duel === o.on}
              onClick={() => chooseDuel(o.on)}
              disabled={o.on && rivals.length === 0}
              className={`h-11 flex-1 rounded-full text-sm font-bold disabled:opacity-50 ${duel === o.on ? "bg-sapin text-sapin-clair" : "bg-sable"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {rivals.length === 0 ? (
          <p className="text-xs text-terre">Aucun collègue d&apos;une autre équipe n&apos;est encore inscrit.</p>
        ) : null}
        {duel ? (
          <div className="flex flex-col gap-2 rounded-2xl border-2 border-argile bg-peche p-3">
            <label className="flex flex-col gap-1 text-sm font-bold">
              Contre qui, dans une autre équipe ?
              <select value={rival} onChange={(e) => setRival(e.target.value)} required className="input">
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
            <p className="text-xs leading-relaxed text-[#5a4324]">
              Vous avez 7 jours pour faire {target} {target > 1 ? template.unit.many : template.unit.one} chacun. {DUEL_STAKES} Les
              pénalités valent aussi pour toi.
            </p>
          </div>
        ) : null}
      </fieldset>

      <section className="rounded-2xl bg-sapin p-4 text-sapin-clair" aria-live="polite">
        <p className="text-xs font-bold tracking-wider uppercase">Si tu réussis · calculé, non modifiable</p>
        <div className="mt-2 flex gap-4">
          <div className="flex-1">
            <p className="font-display text-2xl font-bold">+{target * template.pointsPerUnit} pousses</p>
            <p className="text-xs">avec une preuve à chaque fois (+5 de bonus par validation)</p>
          </div>
          <div className="flex-1">
            <p className="font-display text-2xl font-bold">{formatKg(total)}</p>
            <p className="text-xs">de CO₂ évités pour l&apos;entreprise</p>
          </div>
        </div>
        <p className="mt-2 text-xs">
          Impact {level} · soit {carKmEquivalent(total)} km en voiture thermique
        </p>
        <p className="mt-2 text-xs leading-relaxed">
          Calcul : {target} × ({current.formula}). Preuve : {template.proofHint.toLowerCase()}.{" "}
          <a href={template.source} target="_blank" rel="noreferrer" className="underline">Source ADEME</a>
        </p>
      </section>

      <FormError message={state.error} />
      <SubmitButton pendingLabel="Création…">{duel ? "Lancer le défi en duel" : "Lancer le défi"}</SubmitButton>
    </form>
  );
}
