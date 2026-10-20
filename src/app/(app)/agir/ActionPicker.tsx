"use client";
import { useMemo, useState, useTransition } from "react";
import { formatKg } from "@/lib/co2/challenges.ts";
import { THEMES, type ActionItem, type Theme } from "@/lib/actions-catalog";
import { logAction, type LoggedAction } from "./actions";
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
}: {
  items: ActionItem[];
  favorites: string[];
  counts: Record<string, number>;
  doneToday: Record<string, boolean>;
  inChallenge: string[];
}) {
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<Theme | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<LoggedAction | null>(null);

  const byKey = useMemo(() => Object.fromEntries(items.map((i) => [i.key, i])), [items]);
  const list = useMemo(() => {
    const q = normalize(query.trim());
    if (q) return items.filter((i) => normalize(i.title).includes(q));
    if (theme) return items.filter((i) => i.theme === theme);
    return null;
  }, [items, query, theme]);

  const record = (item: ActionItem) => {
    setError(null);
    setBusyKey(item.key);
    startTransition(async () => {
      const res = await logAction(item.templateId, item.variant);
      setBusyKey(null);
      if (res.ok) setDone(res.action);
      else setError(res.error);
    });
  };

  const row = (item: ActionItem) => {
    const count = counts[item.key] ?? 0;
    const challenge = inChallenge.includes(item.key);
    const busy = pending && busyKey === item.key;
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
            <span className="block text-xs text-terre">
              {busy
                ? "Enregistrement…"
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
            <span className="text-xs font-semibold text-argile-fonce">+{item.points}</span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold">Qu&apos;as-tu fait de bien ?</h1>
        <p className="text-sm text-terre">Un tap suffit. Le CO₂ vient de ton bilan, les pousses arrivent tout de suite.</p>
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

      <p className="text-center text-xs text-terre">
        Pas de preuve demandée. Un plafond par jour s&apos;applique (2 trajets, 2 repas…) pour que le compteur de
        l&apos;entreprise reste juste.
      </p>

      {done ? <ActionDone action={done} onClose={() => setDone(null)} /> : null}
    </>
  );
}
