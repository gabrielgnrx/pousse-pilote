"use client";
import { useState, useTransition } from "react";
import { DEFAULT_ANSWERS, STEPS, type Field } from "./questions";
import { saveBilan } from "./actions";
import type { BilanAnswers } from "@/lib/co2/footprint.ts";
import { FormError } from "@/components/ui";

export function Questionnaire({ initial }: { initial?: BilanAnswers }) {
  const [answers, setAnswers] = useState<BilanAnswers>(initial ?? DEFAULT_ANSWERS);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  const set = (key: keyof BilanAnswers, value: string | number) =>
    setAnswers((a) => ({ ...a, [key]: value }));

  const submit = () =>
    startTransition(async () => {
      const res = await saveBilan(JSON.stringify(answers));
      if (res?.error) setError(res.error);
    });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 py-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          aria-label="Question précédente"
          className="flex size-11 items-center justify-center rounded-full bg-sable disabled:opacity-40"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="h-2 flex-1 rounded-full bg-trait" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
          <div className="h-2 rounded-full bg-sapin transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <span className="text-xs font-bold text-terre">
          {step + 1}/{STEPS.length}
        </span>
      </div>

      <p className="label">{current.category}</p>
      <h1 className="-mt-3 font-display text-2xl leading-tight">{current.question}</h1>

      <div className="flex flex-col gap-5">
        {current.fields.map(({ label, field }) => (
          <div key={field.key} className="flex flex-col gap-2">
            {label ? <p className="text-sm font-bold">{label}</p> : null}
            <FieldInput field={field} value={answers[field.key]} onChange={(v) => set(field.key, v)} />
          </div>
        ))}
      </div>

      <p className="text-sm leading-relaxed text-terre">{current.why}</p>
      <FormError message={error} />

      <div className="mt-auto">
        {last ? (
          <button type="button" onClick={submit} disabled={pending} className="btn-primary w-full">
            {pending ? "Calcul en cours…" : "Voir mon résultat"}
          </button>
        ) : (
          <button type="button" onClick={() => setStep((s) => s + 1)} className="btn-primary w-full">
            Question suivante
          </button>
        )}
      </div>
    </main>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string | number;
  onChange: (v: string | number) => void;
}) {
  if (field.kind === "range") {
    return (
      <div className="flex flex-col gap-2">
        <div className="font-display text-3xl">
          {value} {field.unit}
        </div>
        <input
          type="range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={Number(value)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-sapin"
          aria-label={field.unit}
        />
      </div>
    );
  }
  const compact = field.options.every((o) => o.label.length <= 8);
  return (
    <div className={compact ? "flex flex-wrap gap-2" : "flex flex-col gap-2"} role="radiogroup">
      {field.options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`rounded-2xl border-2 font-semibold ${compact ? "min-h-12 min-w-14 px-4" : "min-h-14 px-4 text-left"} ${
              on ? "border-sapin bg-sauge" : "border-transparent bg-sable"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
