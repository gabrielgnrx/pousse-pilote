"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { formatKg } from "@/lib/co2/challenges.ts";
import { THEMES, type ActionItem, type Theme } from "@/lib/actions-catalog";
import { logAction, logActionWithReceipt, type LoggedAction } from "./actions";
import { boostedPoints, fmtMult, type Boost } from "@/lib/boosts";
import { TEMPLATE_BY_ID } from "@/lib/co2/challenges.ts";
import { ActionDone } from "./ActionDone";
import { ThemeIcon } from "./ThemeIcon";

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function ActionPicker({
  items,
  favorites,
  counts,
  doneToday,
  inChallenge,
  boosts,
  openReceipt,
}: {
  items: ActionItem[];
  favorites: string[];
  counts: Record<string, number>;
  doneToday: Record<string, boolean>;
  inChallenge: string[];
  boosts: Record<string, Boost>;
  openReceipt: string | null;
}) {
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<Theme | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<LoggedAction | null>(null);
  const [receiptFor, setReceiptFor] = useState<string | null>(openReceipt);

  const byKey = useMemo(() => Object.fromEntries(items.map((i) => [i.key, i])), [items]);
  const list = useMemo(() => {
    const q = normalize(query.trim());
    if (q) return items.filter((i) => normalize(i.title).includes(q));
    if (theme) return items.filter((i) => i.theme === theme);
    return null;
  }, [items, query, theme]);

  const record = (item: ActionItem) => {
    if (item.requiresReceipt) {
      setError(null);
      setReceiptFor(item.key);
      return;
    }
    setError(null);
    setBusyKey(item.key);
    startTransition(async () => {
      const res = await logAction(item.templateId, item.variant);
      setBusyKey(null);
      if (res.ok) setDone(res.action);
      else setError(res.error);
    });
  };

  const sendReceipt = (form: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await logActionWithReceipt(form);
      if (res.ok) {
        setReceiptFor(null);
        setDone(res.action);
      } else setError(res.error);
    });
  };

  const row = (item: ActionItem) => {
    const count = counts[item.key] ?? 0;
    const challenge = inChallenge.includes(item.key);
    const busy = pending && busyKey === item.key;
    const boost = boosts[item.key];
    return (
      <li key={item.key}>
        <button
          type="button"
          onClick={() => record(item)}
          disabled={pending}
          className="flex w-full items-center gap-3 rounded-2xl bg-papier p-3 text-left transition active:scale-[0.98] disabled:opacity-60"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sable">
            <ThemeIcon theme={item.theme} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] leading-snug font-bold">{item.title}</span>
            {boost ? (
              <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${boost.kind === "equipe" ? "bg-abricot text-[#402a16]" : "bg-sapin text-sapin-clair"}`}>
                {boost.label} · {fmtMult(boost.mult)}
              </span>
            ) : null}
            <span className="block text-xs text-terre">
              {busy
                ? "Enregistrement…"
                : item.requiresReceipt
                  ? item.templateId.startsWith("appli_")
                    ? "Reçu obligatoire · gardé privé"
                    : "Justificatif obligatoire · gardé privé"
                  : challenge
                  ? "Compte pour ton défi en cours"
                  : count > 0
                    ? `Fait ${count} fois ce mois-ci${doneToday[item.key] ? ", dont aujourd'hui" : ""}`
                    : item.kg > 0
                      ? "Remplace une habitude de ton bilan"
                      : item.note ?? ""}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-0.5">
            <span className={`text-sm font-bold ${item.kg > 0 ? "text-sapin" : "text-terre"}`}>
              {item.kg > 0 ? `−${formatKg(item.kg)}` : "≈ 0 kg"}
            </span>
            <span className="text-xs font-semibold text-argile-fonce">+{boostedPoints(item.points, boost)}</span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-bold tracking-wider text-argile-fonce uppercase">Une action, aujourd&apos;hui</p>
        <h1 className="font-display text-2xl font-bold">Qu&apos;as-tu fait de bien ?</h1>
        <p className="text-sm text-terre">Une action, un tap, des pousses tout de suite. Le CO₂ vient de ton bilan.</p>
      </div>

      <label className="flex h-12 items-center gap-2 rounded-2xl border-[1.5px] border-[#c7b78c] bg-papier px-4">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b5d42" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6" /><path d="m20 20-4-4" /></svg>
        <span className="sr-only">Chercher une action</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher : vélo, repas, occasion…"
          className="h-full flex-1 bg-transparent text-base outline-none placeholder:text-terre/70"
        />
      </label>

      {error ? (
        <p role="alert" className="rounded-2xl bg-peche px-4 py-3 text-sm font-semibold text-argile-fonce">{error}</p>
      ) : null}

      {list ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="label">{query ? "Résultats" : THEMES.find((t) => t.id === theme)?.label}</h2>
            <button type="button" onClick={() => { setQuery(""); setTheme(null); }} className="text-xs font-bold underline underline-offset-2">
              Tout voir
            </button>
          </div>
          {list.length ? <ul className="flex flex-col gap-2">{list.map(row)}</ul> : <p className="card text-sm">Aucune action ne correspond.</p>}
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="label">Tes habitudes · un tap suffit</h2>
            <ul className="flex flex-col gap-2">{favorites.map((k) => byKey[k]).filter(Boolean).map(row)}</ul>
          </section>
          <section className="flex flex-col gap-2" aria-labelledby="applis">
            <div>
              <h2 id="applis" className="label">Achats via une appli durable · +30</h2>
              <p className="text-xs text-terre">Vinted, Leboncoin, Back Market, Too Good To Go… Avec ton reçu, gardé privé.</p>
            </div>
            <ul className="flex flex-col gap-2">
              {[...new Set(items.filter((i) => i.templateId.startsWith("appli_")).map((i) => i.templateId))]
                .map((id) => items.find((i) => i.templateId === id)!)
                .map((i) => ({ ...i, title: TEMPLATE_BY_ID[i.templateId]?.title ?? i.title }))
                .map(row)}
            </ul>
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="label">Ou par thème</h2>
            <div className="flex flex-wrap gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className="flex h-10 items-center gap-1.5 rounded-full border-[1.5px] border-[#c7b78c] bg-papier px-3.5 text-sm font-semibold"
                >
                  <ThemeIcon theme={t.id} size={16} />
                  {t.label}
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      <Link href="/defis?onglet=catalogue" className="self-center py-2 text-center text-[13px] font-semibold text-argile-fonce underline underline-offset-2">
        Un objectif sur plusieurs jours ? C&apos;est dans Mon plan
      </Link>

      <p className="text-center text-xs text-terre">
        Pas de preuve demandée, sauf un justificatif privé pour les achats via une appli, le train, les vacances en train et les réparations. Un plafond par jour s&apos;applique (2 trajets, 2 repas…) pour que le compteur de
        l&apos;entreprise reste juste. Les actions à 0 kg rapportent 5 pousses par jour au plus, tous confondus.
      </p>

      {receiptFor && byKey[receiptFor] ? (
        <ReceiptSheet
          item={byKey[receiptFor]}
          boost={boosts[receiptFor]}
          pending={pending}
          error={error}
          onSubmit={sendReceipt}
          onClose={() => {
            setReceiptFor(null);
            setError(null);
          }}
        />
      ) : null}

      {done ? <ActionDone action={done} onClose={() => setDone(null)} /> : null}
    </>
  );
}

/** Un achat via une appli : choisir ce qu'on a acheté et joindre le reçu (ou une capture de la confirmation). */
function ReceiptSheet({
  item,
  boost,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  item: ActionItem;
  boost: Boost | undefined;
  pending: boolean;
  error: string | null;
  onSubmit: (form: FormData) => void;
  onClose: () => void;
}) {
  const t = TEMPLATE_BY_ID[item.templateId];
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-encre/60 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recu-titre"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <form
        action={onSubmit}
        className="flex max-h-[90dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-[28px] bg-creme p-5 sm:rounded-[28px]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-wider text-argile-fonce uppercase">
              {item.templateId.startsWith("appli_") ? "Achat via une appli · reçu obligatoire" : "Justificatif obligatoire"}
            </p>
            <h2 id="recu-titre" className="font-display text-xl leading-tight font-bold">{t?.title ?? item.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sable">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <input type="hidden" name="template" value={item.templateId} />
        {t && t.variants.length > 1 ? (
          <label className="flex flex-col gap-1 text-sm font-bold">
            {t.variantQuestion ?? "Quoi ?"}
            <select name="variant" defaultValue={item.variant} className="input">
              {t.variants.map((v) => (
                <option key={v.key} value={v.key}>{v.label}</option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="variant" value={item.variant} />
        )}
        <label className="flex flex-col gap-1 text-sm font-bold">
          {item.templateId.startsWith("appli_") ? "Ton reçu ou ta confirmation de commande" : (t?.proofHint ?? "Ton justificatif")}
          <span className="text-xs font-normal text-terre">Une photo ou une capture d&apos;écran. Il reste privé : personne d&apos;autre ne le voit, et il est effacé après 90 jours.</span>
          <input name="receipt" type="file" accept="image/jpeg,image/png,image/webp" required className="text-sm font-normal" />
        </label>
        {error ? <p role="alert" className="text-sm font-semibold text-argile-fonce">{error}</p> : null}
        <button type="submit" disabled={pending} className="btn-dark">
          {pending ? "Envoi…" : `Valider avec ${item.templateId.startsWith("appli_") ? "le reçu" : "le justificatif"} · +${boostedPoints(item.points, boost)}`}
        </button>
      </form>
    </div>
  );
}
