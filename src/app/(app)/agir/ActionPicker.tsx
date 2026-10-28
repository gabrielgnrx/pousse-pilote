"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { formatKg } from "@/lib/co2/challenges.ts";
import { THEMES, type ActionItem, type Theme } from "@/lib/actions-catalog";
import { logAction, logSheet, type LoggedAction } from "./actions";
import { boostedPoints, fmtMult, type Boost } from "@/lib/boosts";
import { TEMPLATE_BY_ID } from "@/lib/co2/challenges.ts";
import { ActionDone } from "./ActionDone";
import { NaturalEntry } from "./NaturalEntry";
import type { Habits } from "@/lib/co2/footprint.ts";
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
  openConfirm,
  habits,
}: {
  items: ActionItem[];
  favorites: string[];
  counts: Record<string, number>;
  doneToday: Record<string, boolean>;
  inChallenge: string[];
  boosts: Record<string, Boost>;
  openConfirm: string | null;
  habits: Habits;
}) {
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<Theme | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<LoggedAction | null>(null);
  const [confirmFor, setConfirmFor] = useState<string | null>(openConfirm);

  const byKey = useMemo(() => Object.fromEntries(items.map((i) => [i.key, i])), [items]);
  const list = useMemo(() => {
    const q = normalize(query.trim());
    if (q) return items.filter((i) => normalize(i.title).includes(q));
    if (theme) return items.filter((i) => i.theme === theme);
    return null;
  }, [items, query, theme]);

  const record = (item: ActionItem) => {
    if (item.requiresConfirm || item.pick) {
      setError(null);
      setConfirmFor(item.key);
      return;
    }
    setError(null);
    setBusyKey(item.key);
    // Interface optimiste : la célébration s'ouvre tout de suite avec l'aperçu, la base confirme ensuite.
    setDone({
      id: "",
      title: item.title,
      theme: item.theme,
      habit: false,
      kg: item.kg,
      points: boostedPoints(item.points, boosts[item.key]),
      monthCount: 0,
      monthKg: 0,
      streak: 0,
      total: 0,
      companyKg: null,
      firstName: "",
      unit: TEMPLATE_BY_ID[item.templateId]?.unit ?? { one: "fois", many: "fois" },
      challenge: null,
      basePoints: item.points,
      multiplier: 1,
      boost: null,
      duel: null,
      provisional: true,
    });
    startTransition(async () => {
      const res = await logAction(item.templateId, item.variant);
      setBusyKey(null);
      if (res.ok) setDone(res.action);
      else {
        setDone(null);
        setError(res.error);
      }
    });
  };

  const sendConfirmed = (form: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await logSheet(form);
      if (res.ok) {
        setConfirmFor(null);
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
          className="flex min-h-16 w-full items-center gap-3 rounded-[20px] bg-papier p-3 text-left transition active:translate-y-px disabled:opacity-60"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-sauge">
            <ThemeIcon theme={item.theme} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] leading-snug font-semibold">{item.title}</span>
            {boost ? (
              <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${boost.kind === "equipe" ? "bg-abricot text-encre" : "bg-sapin text-sapin-clair"}`}>
                {boost.label} · {fmtMult(boost.mult)}
              </span>
            ) : null}
            <span className="block text-xs text-terre">
              {busy
                ? "Enregistrement…"
                : item.pick === "items"
                  ? "Choisis quoi et combien"
                  : item.pick === "distance"
                    ? "Indique la distance · sur l'honneur"
                    : item.requiresConfirm
                      ? "Sur l'honneur · plafonné selon ton bilan"
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
              {item.kg > 0 ? `${item.pick ? "dès " : ""}−${formatKg(item.kg)}` : "≈ 0 kg"}
            </span>
            <span className="text-xs font-semibold text-argile-fonce">+{boostedPoints(item.points, boost)}</span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <>
      <div className="relative flex flex-col gap-1 overflow-hidden rounded-[24px] bg-sapin p-5 text-sapin-clair">
        <svg aria-hidden="true" width="150" height="130" viewBox="0 0 170 150" className="absolute -top-5 -right-9">
          <path d="M30 130C20 70 60 20 150 10c10 70-30 120-120 120Z" fill="#2c6a45" />
          <path d="M150 10C110 50 70 90 34 128" stroke="#3f7f57" strokeWidth="3" fill="none" />
        </svg>
        <p className="relative text-[13px] font-semibold text-sapin-pale">Une action, aujourd&apos;hui</p>
        <h1 className="relative font-display text-[28px] leading-tight">Qu&apos;as-tu fait de bien ?</h1>
        <NaturalEntry
          habits={habits}
          onProvisional={(a) => {
            setError(null);
            setDone(a);
          }}
          onLogged={setDone}
          onFailed={() => setDone(null)}
        />
      </div>

      <label className="flex h-[50px] items-center gap-2 rounded-2xl border border-trait bg-papier px-4">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a5a4e" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6" /><path d="m20 20-4-4" /></svg>
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
            <h2 className="font-display text-[19px] normal-case">{query ? "Résultats" : THEMES.find((t) => t.id === theme)?.label}</h2>
            <button type="button" onClick={() => { setQuery(""); setTheme(null); }} className="text-xs font-bold underline underline-offset-2">
              Tout voir
            </button>
          </div>
          {list.length ? <ul className="flex flex-col gap-2">{list.map(row)}</ul> : <p className="card text-sm">Aucune action ne correspond.</p>}
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="font-display text-[19px] normal-case">Ou en un tap · tes habitudes</h2>
            <ul className="flex flex-col gap-2">{favorites.map((k) => byKey[k]).filter(Boolean).map(row)}</ul>
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="font-display text-[19px] normal-case">Ou par thème</h2>
            <div className="flex flex-wrap gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className="flex min-h-11 items-center gap-1.5 rounded-full border border-trait bg-papier px-3.5 text-sm font-medium"
                >
                  <ThemeIcon theme={t.id} size={16} />
                  {t.label}
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      <Link href="/defis?onglet=catalogue" className="self-center py-2 text-center text-sm font-semibold text-sapin">
        Un objectif sur plusieurs jours ? C&apos;est dans Mon plan
      </Link>

      <p className="text-center text-xs text-terre">
        Pas de preuve demandée : chaque action se déclare sur l&apos;honneur. Des plafonds gardent le compteur de l&apos;entreprise
        juste : 2 trajets et 2 repas par jour, chaque semaine 2 trajets par jour de bureau déclaré dans ton bilan, et chaque année
        autant de voyages en train que de vols déclarés. Les petits gestes rapportent 5 pousses par jour au plus, tous confondus.
      </p>

      {confirmFor && byKey[confirmFor] ? (
        <ActionSheet
          item={byKey[confirmFor]}
          boost={boosts[confirmFor]}
          pending={pending}
          error={error}
          onSubmit={sendConfirmed}
          onClose={() => {
            setConfirmFor(null);
            setError(null);
          }}
        />
      ) : null}

      {done ? <ActionDone action={done} onClose={() => setDone(null)} /> : null}
    </>
  );
}

/**
 * Les actions à préciser : vêtements ou appareils (quoi et combien), train (distance), et les grosses
 * actions confirmées sur l'honneur.
 */
function ActionSheet({
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
  const [qty, setQty] = useState<Record<string, number>>({});
  const [km, setKm] = useState("");
  const units = item.pick === "items" ? Object.values(qty).reduce((a, b) => a + b, 0) : 1;
  const kg =
    item.pick === "items"
      ? (item.choices ?? []).reduce((sum, c) => sum + c.kg * (qty[c.variant] ?? 0), 0)
      : item.pick === "distance"
        ? null
        : item.kg;
  const ready = item.pick === "items" ? units > 0 : item.pick === "distance" ? Number(km.replace(",", ".")) >= 50 : true;
  const step = (variant: string, delta: number, max: number) =>
    setQty((q) => ({ ...q, [variant]: Math.min(max, Math.max(0, (q[variant] ?? 0) + delta)) }));

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-encre/60 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-titre"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <form
        action={onSubmit}
        className="flex max-h-[90dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-[28px] bg-creme p-5 sm:rounded-[24px]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-wider text-argile-fonce uppercase">
              {item.pick === "items" ? "Qu'as-tu acheté ou gardé ?" : item.pick === "distance" ? "Quelle distance ?" : "Grosse action · sur l'honneur"}
            </p>
            <h2 id="action-titre" className="font-display text-xl leading-tight">{item.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sable">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <input type="hidden" name="template" value={item.templateId} />
        <input type="hidden" name="variant" value={item.variant} />

        {item.pick === "items" ? (
          <ul className="flex flex-col gap-1.5">
            {(item.choices ?? []).map((c) => {
              const n = qty[c.variant] ?? 0;
              return (
                <li key={c.variant} className="flex min-h-12 items-center gap-3 rounded-2xl bg-papier px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{c.label}</span>
                    <span className="block text-xs text-terre">{c.kg > 0 ? `−${formatKg(c.kg)} chacun` : "≈ 0 kg d'après ton bilan"}</span>
                  </span>
                  <input type="hidden" name={`qty_${c.variant}`} value={n} />
                  <button type="button" onClick={() => step(c.variant, -1, c.max)} disabled={n === 0} aria-label={`Un ${c.label.toLowerCase()} de moins`} className="flex size-10 items-center justify-center rounded-full bg-sable font-bold disabled:opacity-40">−</button>
                  <span className="w-5 text-center font-display text-lg" aria-live="polite">{n}</span>
                  <button type="button" onClick={() => step(c.variant, 1, c.max)} disabled={n >= c.max} aria-label={`Un ${c.label.toLowerCase()} de plus`} className="flex size-10 items-center justify-center rounded-full bg-sauge font-bold text-sapin disabled:opacity-40">+</button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {item.pick === "distance" ? (
          <label className="flex items-center gap-3 text-sm">
            <span className="font-semibold">Distance de l&apos;aller</span>
            <input
              name="km"
              type="number"
              inputMode="decimal"
              min={50}
              max={1500}
              required
              value={km}
              onChange={(e) => setKm(e.target.value)}
              className="input h-11 w-28 py-0"
              aria-describedby="km-unite"
            />
            <span id="km-unite" className="text-terre">km</span>
          </label>
        ) : null}

        {item.requiresConfirm ? (
          <label className="flex items-start gap-3 rounded-2xl bg-sable p-3 text-sm leading-snug">
            <input type="checkbox" name="confirm" required className="mt-0.5 size-5 shrink-0 accent-sapin" />
            <span>
              Je confirme l&apos;avoir fait. <span className="text-terre">Aucun justificatif n&apos;est demandé ; cette action est
              plafonnée pour garder le compteur de l&apos;entreprise juste.</span>
            </span>
          </label>
        ) : null}
        {kg !== null && kg > 0 ? <p className="rounded-2xl bg-sauge px-3 py-2 text-[13px] text-sapin">≈ {formatKg(kg)} de CO₂ évités</p> : null}
        {error ? <p role="alert" className="text-sm font-semibold text-argile-fonce">{error}</p> : null}
        <button type="submit" disabled={pending || !ready} className="btn-dark disabled:opacity-60">
          {pending ? "Enregistrement…" : `Valider · +${boostedPoints(item.points * Math.max(units, 1), boost)}`}
        </button>
      </form>
    </div>
  );
}
