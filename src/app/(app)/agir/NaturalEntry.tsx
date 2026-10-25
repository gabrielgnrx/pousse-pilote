"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatKg } from "@/lib/co2/challenges.ts";
import { ACTION_BY_SLUG, computeAvoided } from "@/lib/co2/engine.ts";
import type { Habits } from "@/lib/co2/footprint.ts";
import type { ConfirmCard } from "@/lib/ai/parse/interpret.ts";
import { themeOf } from "@/lib/actions-catalog";
import { compressImage } from "@/lib/image/compress";
import { logParsedAction, parseActionText, type LoggedAction } from "./actions";

/* Web Speech API : présente sur Chrome et Safari, absente ailleurs (le champ texte suffit alors). */
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;
function speechRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const REASONS: Record<string, string> = {
  not_understood: "Je n'ai pas bien compris. Choisis l'action ci-dessous, ou dans la liste.",
  unavailable: "La saisie libre est indisponible pour le moment. Choisis l'action ci-dessous, ou dans la liste.",
  rate_limited: "Tu as beaucoup utilisé la saisie libre aujourd'hui. Choisis l'action ci-dessous, ou dans la liste.",
  invalid: "Écris quelques mots sur ce que tu as fait.",
};

const CHOICE_HINT: Record<NonNullable<ConfirmCard["needsChoice"]>, string> = {
  low_confidence: "Je ne suis pas sûr : c'est bien ça ?",
  unknown_action: "Je n'ai pas trouvé exactement. C'est l'une de ces actions ?",
  unit_mismatch: "L'unité ne colle pas avec cette action : indique la quantité.",
  quantity_out_of_range: "Cette quantité n'est pas possible : corrige-la.",
};

/**
 * Le champ « dis-le comme tu veux » : une phrase tapée ou dictée devient des cartes à confirmer.
 * Rien n'est enregistré sans un clic sur « Valider ». Le CO₂ affiché est un aperçu calculé ici avec le
 * même moteur que la base ; la base refait le calcul à l'enregistrement.
 */
export function NaturalEntry({
  habits,
  onLogged,
  onProvisional,
  onFailed,
}: {
  habits: Habits;
  onLogged: (a: LoggedAction) => void;
  onProvisional: (a: LoggedAction) => void;
  onFailed: () => void;
}) {
  const [text, setText] = useState("");
  const [cards, setCards] = useState<ConfirmCard[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [canDictate, setCanDictate] = useState(false);
  const [pending, startTransition] = useTransition();
  const recognition = useRef<Recognition | null>(null);

  useEffect(() => setCanDictate(speechRecognition() !== null), []);

  const submit = (value: string) => {
    if (value.trim().length < 2) {
      setNotice(REASONS.invalid);
      return;
    }
    setNotice(null);
    startTransition(async () => {
      const r = await parseActionText(value);
      setCards(r.cards);
      if (!r.ok) setNotice(REASONS[r.reason] ?? REASONS.unavailable);
    });
  };

  const dictate = () => {
    const Ctor = speechRecognition();
    if (!Ctor) return;
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = "fr-FR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const said = e.results[0]?.[0]?.transcript ?? "";
      setText(said);
      submit(said);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognition.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <div className="relative flex flex-col gap-3">
      <form
        className="flex items-center gap-2 rounded-[20px] bg-papier p-1.5 pl-4 text-encre shadow-[inset_0_-3px_0_var(--color-sable)]"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <label htmlFor="saisie-libre" className="sr-only">Décris ton action</label>
        <input
          id="saisie-libre"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          autoComplete="off"
          placeholder="« Vélo jusqu'au bureau, 8 km »"
          className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-terre/70"
        />
        {canDictate ? (
          <button
            type="button"
            onClick={dictate}
            aria-label={listening ? "Arrêter la dictée" : "Dicter mon action"}
            aria-pressed={listening}
            className={`flex size-11 shrink-0 items-center justify-center rounded-[14px] ${listening ? "animate-pousse-pop bg-argile text-white" : "bg-sauge text-sapin"}`}
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>
        ) : null}
        <button type="submit" disabled={pending} aria-label="Comprendre ma phrase" className="btn-primary min-h-11 shrink-0 px-4 text-sm">
          {pending ? "…" : "OK"}
        </button>
      </form>
      <p className="relative text-xs text-[#dfe9da]">
        {listening ? "Je t'écoute…" : "Écris ou dicte ce que tu as fait. Tu confirmes avant tout enregistrement."}
      </p>

      {notice ? (
        <p role="status" className="rounded-2xl bg-peche px-4 py-3 text-sm font-semibold text-argile-fonce">{notice}</p>
      ) : null}

      {cards.length ? (
        <ul className="flex flex-col gap-2" aria-label="Actions à confirmer">
          {cards.map((c) => (
            <ConfirmCardView
              key={c.slug}
              card={c}
              habits={habits}
              onProvisional={onProvisional}
              onFailed={onFailed}
              onLogged={(a) => {
                setCards((cs) => cs.filter((x) => x.slug !== c.slug));
                setText("");
                onLogged(a);
              }}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ConfirmCardView({
  card,
  habits,
  onLogged,
  onProvisional,
  onFailed,
}: {
  card: ConfirmCard;
  habits: Habits;
  onLogged: (a: LoggedAction) => void;
  onProvisional: (a: LoggedAction) => void;
  onFailed: () => void;
}) {
  const [slug, setSlug] = useState(card.slug);
  const action = ACTION_BY_SLUG[slug];
  const [quantity, setQuantity] = useState<string>(card.quantity === null ? "" : String(card.quantity));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const receiptRef = useRef<HTMLInputElement>(null);

  const q = quantity === "" ? null : Number(quantity.replace(",", "."));
  const preview = computeAvoided(slug, q, habits);
  const quantityMissing = action.kind === "distance" ? q === null && !["velo", "transports", "covoiturage"].includes(action.template) : false;
  const needsReceipt = ["train", "vacances_train", "reparation", "appli_antigaspi", "appli_occasion"].includes(action.template);

  const confirm = async () => {
    if (!preview.ok) {
      setError("Corrige la quantité avant de valider.");
      return;
    }
    if (quantityMissing) {
      setError("Indique la distance avant de valider.");
      return;
    }
    const file = receiptRef.current?.files?.[0];
    if (needsReceipt && !file) {
      setError("Joins ton justificatif (billet, réservation ou facture) : il reste privé.");
      return;
    }
    const form = new FormData();
    form.set("slug", slug);
    if (q !== null) form.set("quantity", String(q));
    if (file) form.set("receipt", await compressImage(file));
    setError(null);
    // Interface optimiste : la célébration s'ouvre avec l'aperçu, puis prend les chiffres de la base.
    onProvisional({
      id: "",
      title: action.label,
      theme: themeOf(action.template),
      habit: false,
      kg: preview.kg,
      points: 0,
      monthCount: 0,
      monthKg: 0,
      streak: 0,
      total: 0,
      companyKg: null,
      firstName: "",
      unit: { one: action.unit, many: action.unit },
      challenge: null,
      basePoints: 0,
      multiplier: 1,
      boost: null,
      duel: null,
      receipt: needsReceipt,
      provisional: true,
    } satisfies LoggedAction);
    startTransition(async () => {
      const r = await logParsedAction(form);
      if (r.ok) onLogged(r.action);
      else {
        onFailed();
        setError(r.error);
      }
    });
  };

  const choices = card.candidates.length ? card.candidates : [card.slug];

  return (
    <li className="card flex flex-col gap-3 text-encre">
      {card.needsChoice ? <p className="label">{CHOICE_HINT[card.needsChoice]}</p> : <p className="label">À confirmer</p>}

      {card.needsChoice && choices.length > 1 ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="sr-only">Quelle action ?</legend>
          {choices.map((s) => (
            <label
              key={s}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 text-sm ${s === slug ? "border-sapin bg-sauge font-semibold" : "border-trait"}`}
            >
              <input type="radio" name={`choix-${card.slug}`} value={s} checked={s === slug} onChange={() => setSlug(s)} className="accent-sapin" />
              {ACTION_BY_SLUG[s]?.label}
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="text-[15px] leading-snug font-semibold">{action.label}</p>
      )}

      {action.min !== action.max || action.kind === "distance" ? (
        <label className="flex items-center gap-3 text-sm">
          <span className="font-semibold">{action.kind === "distance" ? "Distance" : "Combien ?"}</span>
          <input
            type="number"
            inputMode="decimal"
            min={action.min}
            max={action.max}
            step={action.kind === "distance" ? 0.1 : 1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="input h-11 w-28 py-0"
            aria-describedby={`unite-${card.slug}`}
          />
          <span id={`unite-${card.slug}`} className="text-terre">{action.unit}</span>
        </label>
      ) : null}
      {card.fromBilan && slug === card.slug ? <p className="-mt-2 text-xs text-terre">Distance de ton trajet déclaré dans ton bilan.</p> : null}

      {needsReceipt ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Justificatif (gardé privé, vérifié puis effacé)</span>
          <input ref={receiptRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="text-sm" />
        </label>
      ) : null}

      <p className="rounded-2xl bg-sauge px-3 py-2 text-[13px] text-sapin" aria-live="polite">
        {preview.ok
          ? preview.kg > 0
            ? `≈ ${formatKg(preview.kg)} de CO₂ évités${preview.capped ? ", plafonné à ton trajet déclaré" : ""}`
            : (preview.reason ?? "Pas de CO₂ mesurable, mais des pousses pour ta série.")
          : `Quantité possible : de ${action.min} à ${action.max} ${action.unit}.`}
      </p>

      {error ? <p role="alert" className="text-sm font-semibold text-argile-fonce">{error}</p> : null}
      <button type="button" onClick={confirm} disabled={pending} className="btn-dark">
        {pending ? "Enregistrement…" : "Valider"}
      </button>
    </li>
  );
}
