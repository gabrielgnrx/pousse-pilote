"use client";
import { useActionState, useState } from "react";
import { createChallenge } from "./actions";
import { FormError, SubmitButton } from "@/components/ui";
import { carKmEquivalent, formatKg, impactLevel } from "@/lib/co2/challenges.ts";
import { BONUS, MODES, fmtMult } from "@/lib/boosts";

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
  teamKind,
}: {
  template: {
    id: string;
    unit: { one: string; many: string };
    variantQuestion?: string;
    proofHint: string;
    defaultTarget: number;
    /** Objectif minimum : 3, ou 1 pour une action hebdomadaire. */
    minTarget: number;
    pointsPerUnit: number;
    source: string;
  };
  variants: VariantView[];
  initialVariant: string;
  /** Publication d'un collègue à l'origine du défi (« Relever aussi »). */
  inspiredBy?: { id: string; name: string };
  /** Collègues des autres équipes, pour lancer le défi en duel. */
  rivals: { id: string; name: string; team: string }[];
  /** Le défi d'équipe que ce geste peut proposer au vote (null : pas faisable par toute l'équipe). */
  teamKind: string | null;
}) {
  const [state, action] = useActionState(createChallenge, {});
  const [variant, setVariant] = useState(initialVariant);
  const [target, setTarget] = useState(template.defaultTarget);
  const [days, setDays] = useState(30);
  const [mode, setMode] = useState<"seul" | "duel" | "equipe">("seul");
  const duel = mode === "duel";
  const [rival, setRival] = useState("");
  const teams = [...new Set(rivals.map((r) => r.team))];
  const chooseMode = (m: "seul" | "duel" | "equipe") => {
    setMode(m);
    if (m === "duel") {
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
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="team_kind" value={mode === "equipe" && teamKind ? teamKind : ""} />
      {inspiredBy ? (
        <>
          <input type="hidden" name="via" value={inspiredBy.id} />
          <p className="rounded-2xl bg-sauge px-4 py-3 text-sm text-[#1f5134]">
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
        <legend className="label mb-2">Avec qui ?</legend>
        {(
          [
            { id: "seul", title: "Seul", mult: MODES.seul.mult, text: `À ton rythme. Réussi : +${BONUS.seul} pousses.`, disabled: false },
            {
              id: "duel",
              title: "En duel",
              mult: MODES.duel.mult,
              text: `Contre quelqu'un d'une autre équipe, sur 7 jours. Réussi : +${BONUS.duelSeul}, ou +${BONUS.duelDeux} chacun si vous réussissez tous les deux. Échoué : −${BONUS.mise} (ta mise).`,
              disabled: rivals.length === 0,
            },
            {
              id: "equipe",
              title: "En équipe",
              mult: MODES.equipe.mult,
              text: teamKind
                ? `Proposé au vote de lundi prochain dans le QG. S'il est choisi, toute l'équipe joue : +${BONUS.equipe} pour chaque contributeur.`
                : "Pas pour cette action : toute l'équipe doit pouvoir le faire (chacun n'a pas le même trajet ou les mêmes achats). En équipe : repas végé ou actions nature, ou le défi voté chaque lundi.",
              disabled: !teamKind,
            },
          ] as const
        ).map((m) => (
          <label
            key={m.id}
            className={`flex gap-3 rounded-2xl border-2 p-3.5 ${mode === m.id ? "border-sapin bg-sauge" : "border-transparent bg-sable"} ${m.disabled ? "opacity-60" : ""}`}
          >
            <input
              type="radio"
              name="mode-choice"
              checked={mode === m.id}
              disabled={m.disabled}
              onChange={() => chooseMode(m.id)}
              className="mt-0.5 size-5 shrink-0 accent-[#1f5134]"
            />
            <span className="flex flex-1 flex-col gap-1">
              <span className="flex justify-between text-[15px] font-bold">
                <span>{m.title}</span>
                <span className={m.id === "equipe" ? "text-argile-fonce" : "text-sapin"}>{fmtMult(m.mult)}</span>
              </span>
              <span className="text-xs leading-snug text-brun">{m.text}</span>
            </span>
          </label>
        ))}
        {rivals.length === 0 ? (
          <p className="text-xs text-terre">Aucun collègue d&apos;une autre équipe n&apos;est encore inscrit pour un duel.</p>
        ) : null}
        {duel ? (
          <div className="flex flex-col gap-2 rounded-2xl border-2 border-argile bg-peche p-3">
            <label className="flex flex-col gap-1 text-sm font-bold">
              Ton adversaire, dans une autre équipe
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
            <p className="text-xs leading-relaxed text-[#3f4a3c]">
              Vous avez 7 jours pour faire {target} {target > 1 ? template.unit.many : template.unit.one} chacun. Refuser ne lui coûte rien.
            </p>
          </div>
        ) : null}
      </fieldset>

      {mode !== "equipe" ? (
      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-2">Ton objectif</legend>
        <div className="flex items-center justify-between rounded-2xl bg-sable p-3">
          <button type="button" aria-label="Diminuer l'objectif" onClick={() => setTarget((n) => Math.max(template.minTarget, n - 1))} className="flex size-11 items-center justify-center rounded-full bg-creme text-2xl font-bold">−</button>
          <div className="text-center">
            <div className="font-display text-3xl">{target}</div>
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
      ) : null}

      {mode === "equipe" ? (
        <section className="rounded-2xl bg-peche p-4 text-[#3a1606]">
          <p className="text-xs font-bold tracking-wider uppercase">Défi d&apos;équipe</p>
          <p className="mt-1 text-sm leading-snug">
            Ta proposition passe en tête du vote de lundi (9 h – 14 h) dans le QG. Si l&apos;équipe la choisit, chaque action qui
            y compte rapporte {fmtMult(MODES.equipe.mult)}, et +{BONUS.equipe} pour chaque contributeur si l&apos;objectif est atteint.
          </p>
        </section>
      ) : (
      <section className="rounded-2xl bg-sapin p-4 text-sapin-clair" aria-live="polite">
        <p className="text-xs font-bold tracking-wider uppercase">Si tu réussis · calculé, non modifiable</p>
        <div className="mt-2 flex gap-4">
          <div className="flex-1">
            <p className="font-display text-2xl">
              +{Math.round(target * template.pointsPerUnit * (duel ? MODES.duel.mult : 1)) + (duel ? BONUS.duelSeul : BONUS.seul)} pousses
            </p>
            <p className="text-xs">
              {target} × {template.pointsPerUnit}
              {duel ? ` × 1,5 (duel) + ${BONUS.duelSeul} si tu gagnes` : ` + ${BONUS.seul} de bonus de défi réussi`}
            </p>
          </div>
          <div className="flex-1">
            <p className="font-display text-2xl">{formatKg(total)}</p>
            <p className="text-xs">de CO₂ évités pour l&apos;entreprise (déclaré)</p>
          </div>
        </div>
        <p className="mt-2 text-xs">
          Impact {level} · soit {carKmEquivalent(total)} km en voiture thermique
        </p>
        <p className="mt-2 text-xs leading-relaxed">
          Calcul : {target} × ({current.formula}).{" "}
          <a href={template.source} target="_blank" rel="noreferrer" className="underline">Source ADEME</a>
        </p>
      </section>
      )}

      <FormError message={state.error} />
      <SubmitButton pendingLabel="Création…">
        {mode === "equipe" ? "Proposer au vote de lundi" : duel ? "Lancer le défi en duel" : "Lancer le défi seul"}
      </SubmitButton>
    </form>
  );
}
