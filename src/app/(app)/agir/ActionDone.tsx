"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatKg } from "@/lib/co2/challenges.ts";
import { levelFor, weekStart } from "@/lib/co2/engagement.ts";
import { addDays, todayParis } from "@/lib/dates";
import { publishAction, shareChallengeDone, type LoggedAction } from "./actions";
import { compressInput } from "@/lib/image/compress";
import { ThemeIcon } from "./ThemeIcon";
import { Confetti, Mascot } from "@/components/Mascot";
import { BONUS, fmtMult } from "@/lib/boosts";
import { formatDay } from "@/lib/dates";

const DAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];

/** La pop-up après une action : ce que tu as évité, tes pousses, ta série, et pourquoi recommencer. */
export function ActionDone({ action, onClose }: { action: LoggedAction; onClose: () => void }) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [sharedDone, setSharedDone] = useState(false);
  const [state, publish, sending] = useActionState(publishAction, {});
  const primary = useRef<HTMLButtonElement>(null);
  const level = levelFor(action.total);
  const c = action.challenge;
  const challengeDone = c ? c.done >= c.target : false;

  useEffect(() => {
    primary.current?.focus();
  }, []);

  const close = () => {
    onClose();
    router.refresh();
  };
  const finish = () => {
    onClose();
    router.push("/fil");
  };

  // La semaine en cours, du lundi au dimanche, pour les défis sur plusieurs jours.
  const today = todayParis();
  const monday = weekStart(today);
  const week = DAY_LETTERS.map((letter, i) => {
    const day = addDays(monday, i);
    const inChallenge = c ? day >= c.startsOn && day <= c.endsOn : false;
    const done = c ? c.days.includes(day) : false;
    return { letter, day, inChallenge, done, isToday: day === today, future: day > today };
  });
  const remaining = c ? Math.max(0, c.target - c.done) : 0;

  const segments = c && c.target <= 10 ? Array.from({ length: c.target }, (_, i) => i < c.done) : null;

  return (
    <div
      className="fixed inset-0 z-40 overflow-y-auto bg-creme"
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-done-title"
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      <div className="mx-auto flex min-h-full max-w-md flex-col">
        <section
          className={`relative flex flex-col items-center gap-1 overflow-hidden rounded-b-[40px] px-5 pt-6 pb-7 text-center ${
            c ? "bg-nuit text-white" : "bg-sapin text-sapin-clair"
          }`}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Fermer"
            className={`absolute top-4 right-4 flex size-11 items-center justify-center rounded-full bg-white/10`}
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
          <Confetti className="animate-pousse-pop pointer-events-none absolute top-9 left-1/2 -translate-x-1/2" />
          {c ? (
            <span className="rounded-full bg-pollen px-3 py-1.5 text-[13px] font-bold text-encre">Défi · {action.title}</span>
          ) : null}
          <Mascot size={112} grown pot={c ? "#26392d" : "#17462a"} className="animate-pousse-grow mt-2" />
          {c ? (
            <>
              <h2 id="action-done-title" className="mt-1 font-display text-[30px] leading-tight">
                {challengeDone ? "Défi réussi !" : "Continue comme ça !"}
              </h2>
              <p className="text-[15px] font-semibold">
                {c.done} sur {c.target} {c.target > 1 ? action.unit.many : action.unit.one}
                {challengeDone ? (action.duel ? ". Bravo, tu es allé au bout." : `. Bravo : +${BONUS.seul} pousses.`) : ". Tu tiens bon."}
              </p>
              {segments ? (
                <div className="mt-3 flex w-full gap-2" aria-hidden="true">
                  {segments.map((done, i) => (
                    <span
                      key={i}
                      className={`flex h-11 flex-1 items-center justify-center rounded-[14px] ${
                        done ? "bg-pollen text-encre" : "border-2 border-dashed border-white/40"
                      }`}
                    >
                      {done ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c2562e" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
                      ) : null}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <h2 id="action-done-title" className="mt-1 font-display text-[28px] leading-tight">
                {action.firstName ? `Bien joué, ${action.firstName} !` : "Bien joué !"}
              </h2>
              <p className="flex items-center gap-1.5 text-[15px] text-sapin-pale">
                <ThemeIcon theme={action.theme} size={18} color="#cfe2cd" />
                {action.title}
              </p>
              {action.kg > 0 ? (
                <p className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-[56px] leading-none">{formatKg(action.kg)}</span>
                  <span className="text-base font-semibold text-sapin-pale">de CO₂ évités</span>
                </p>
              ) : null}
            </>
          )}
        </section>

        <div className="flex flex-1 flex-col gap-3 px-5 pt-5 pb-8">
          {c && action.kg > 0 ? (
            <p className="text-center text-sm text-brun">
              Tu as évité <strong className="text-sapin">{formatKg(action.kg)} de CO₂</strong> avec cette action.
            </p>
          ) : null}
          {action.kg <= 0 ? (
            <p className="rounded-2xl bg-sable px-4 py-3 text-[13px] leading-snug text-brun">
              {action.habit
                ? "Tu le fais déjà : pas de CO₂ en plus dans ton bilan, mais cette bonne habitude rapporte toutes ses pousses."
                : action.theme === "bureau"
                  ? "Pas de CO₂ mesurable sur cette petite action, mais elle compte pour ta série."
                  : "Pas de CO₂ pour toi sur cette action (elle ne remplace rien dans ton bilan), mais elle compte pour ta série."}
              {action.habit
                ? ""
                : action.points === 0
                  ? " Tu as déjà tes 5 pousses du jour pour les petites actions : celle-ci ne t'en rapporte pas."
                  : " Les petites actions rapportent 5 pousses par jour au plus."}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2.5">
            <div className="animate-pousse-pop flex items-center gap-2.5 rounded-[20px] bg-sauge p-3">
              <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="#7db878" stroke="#1e5634" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21v-9" /><path d="M12 12c0-4 3-7 8-7 0 5-3 7-8 7Z" /><path d="M12 15c0-3-2.5-5.5-7-5.5 0 4 2.5 5.5 7 5.5Z" /></svg>
              <span className="flex flex-col text-sapin">
                <span className="font-display text-2xl leading-none">{action.provisional ? "…" : `+${action.points}`}</span>
                <span className="text-[13px] font-semibold">
                  pousses
                  {action.multiplier > 1 && action.points > 0 ? ` · ${fmtMult(action.multiplier)} ${action.boost === "equipe" ? "équipe" : "duel"}` : ""}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2.5 rounded-[20px] bg-peche p-3">
              <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="#f2c14e" stroke="#6b4e0a" strokeWidth="1.6" strokeLinejoin="round"><path d="M12 2c2 4-2 5-2 8a4 4 0 1 0 8 0c0-2-1-3-2-4 1 3-1 4-2 3 1-2-1-3-2-7Z" /></svg>
              <span className="flex flex-col text-argile-fonce">
                <span className="font-display text-2xl leading-none">
                  {action.provisional ? "…" : `${action.streak} ${action.streak > 1 ? "jours" : "jour"}`}
                </span>
                <span className="text-[13px] font-semibold">de série</span>
              </span>
            </div>
          </div>
          {action.multiplier > 1 && action.points > 0 ? (
            <p className="-mt-1 text-xs text-terre">
              {action.basePoints} seul, {action.points} parce que tu joues {action.boost === "equipe" ? "en équipe" : "en duel"}
            </p>
          ) : null}

          {c ? (
            <ol className="grid grid-cols-7 gap-1.5 rounded-[20px] border border-trait bg-papier p-3" aria-label="Ta semaine">
              {week.map((d) => (
                <li key={d.day} className="flex flex-col items-center gap-1">
                  <span
                    className={`flex size-8 items-center justify-center rounded-full ${
                      d.done
                        ? d.isToday
                          ? "border-[3px] border-peche bg-argile"
                          : "bg-sapin"
                        : d.isToday
                          ? "border-2 border-argile"
                          : d.inChallenge && d.future
                            ? "border-[1.5px] border-dashed border-trait"
                            : "bg-sable"
                    }`}
                  >
                    {d.done ? (
                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
                    ) : null}
                  </span>
                  <span className={`text-xs ${d.isToday ? "font-bold text-argile" : "text-terre"}`}>{d.letter}</span>
                  <span className="sr-only">{d.done ? "fait" : d.future ? "à venir" : "pas fait"}</span>
                </li>
              ))}
            </ol>
          ) : null}

          {action.duel ? (
            <section aria-labelledby="duel-titre" className="flex w-full flex-col gap-2 rounded-[20px] border border-trait bg-papier px-4 py-3">
              <div className="flex items-baseline justify-between">
                <h3 id="duel-titre" className="text-sm font-semibold">Ton duel contre {action.duel.otherName}</h3>
                <span className="text-xs text-terre">jusqu&apos;au {formatDay(action.duel.endsOn, "short")}</span>
              </div>
              {[
                { who: "Toi", n: action.duel.mine, color: "bg-sapin" },
                { who: action.duel.otherName, n: action.duel.theirs, color: "bg-argile" },
              ].map((r) => (
                <div key={r.who} className="flex items-center gap-2 text-[13px]">
                  <span className="w-16 truncate font-semibold">{r.who}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-trait">
                    <span className={`block h-full rounded-full ${r.color}`} style={{ width: `${Math.min(100, (r.n / action.duel!.target) * 100)}%` }} />
                  </span>
                  <span className="w-9 text-right font-semibold">{Math.min(r.n, action.duel!.target)}/{action.duel!.target}</span>
                </div>
              ))}
              <p className="text-[13px] font-semibold text-argile-fonce">
                {action.duel.mine >= action.duel.target
                  ? action.duel.theirs >= action.duel.target
                    ? `Vous avez réussi tous les deux : +${BONUS.duelDeux} chacun à la fin du duel.`
                    : `Objectif atteint ! Si ${action.duel.otherName} n'y arrive pas, les +${BONUS.duelSeul} sont pour toi.`
                  : `${action.duel.mine >= action.duel.theirs ? "Tu mènes !" : "Accroche-toi !"} Encore ${action.duel.target - action.duel.mine} et les +${BONUS.duelSeul} sont pour toi.`}
              </p>
            </section>
          ) : null}

          {action.provisional ? (
            <p role="status" className="text-center text-sm text-terre">Enregistrement de ton action…</p>
          ) : c && !challengeDone ? (
            <p className="flex items-center gap-3 rounded-[20px] border border-trait bg-papier px-4 py-3 text-sm">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-peche font-display text-lg text-argile-fonce">
                +{action.duel ? BONUS.duelSeul : BONUS.seul}
              </span>
              <span>
                Encore <strong>{remaining} {remaining > 1 ? action.unit.many : action.unit.one}</strong> pour réussir ton défi.
              </span>
            </p>
          ) : (
            <div className="rounded-[20px] border border-trait bg-papier px-4 py-3">
              <div className="flex justify-between text-sm font-semibold">
                <span>{level.next ? `${level.name} → ${level.next.name}` : level.name}</span>
                <span className="font-medium text-terre">
                  {action.total.toLocaleString("fr-FR")}
                  {level.next ? ` / ${level.next.min.toLocaleString("fr-FR")}` : ""}
                </span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-sable">
                <div className="h-3 rounded-full bg-sapin transition-[width] duration-1000" style={{ width: `${Math.max(4, level.progress * 100)}%` }} />
              </div>
              <p className="mt-1.5 text-[13px] text-terre">
                {level.next ? `Encore ${level.next.missing} pousses : ta plante devient ${level.next.name.toLowerCase()}.` : "Niveau maximum : tu es une forêt !"}
              </p>
            </div>
          )}

          {action.provisional ? null : (
          <p className="rounded-2xl bg-sauge px-4 py-2.5 text-[13px] leading-snug text-sapin">
            {action.monthCount > 1 ? `${action.monthCount} fois ce mois-ci` : "Première fois ce mois-ci"}
            {action.monthKg > 0 ? `, soit ${formatKg(action.monthKg)} évités` : ""}.
            {action.companyKg !== null ? ` L'entreprise en est à ${formatKg(action.companyKg)}.` : ""}
          </p>
          )}

          {action.notice ? (
            <p role="status" className="rounded-2xl bg-peche px-4 py-2.5 text-[13px] font-semibold text-argile-fonce">{action.notice}</p>
          ) : null}

          <div className="mt-auto flex flex-col gap-2 pt-2">
            {action.provisional ? (
              <button type="button" disabled className="btn-primary min-h-14 font-display text-[19px] font-normal">
                Un instant…
              </button>
            ) : publishing ? (
              <form action={publish} className="flex w-full flex-col gap-2 rounded-[20px] border border-trait bg-papier p-4 text-left">
                <input type="hidden" name="validation" value={action.id} />
                <label className="text-sm font-semibold" htmlFor="caption">Un mot pour tes collègues (facultatif)</label>
                <input id="caption" name="caption" maxLength={280} className="input" />
                <label className="text-sm font-semibold" htmlFor="photo">Une photo (facultatif, +5 pousses)</label>
                <input
                  id="photo"
                  name="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="text-sm"
                  onChange={(e) => void compressInput(e.currentTarget)}
                />
                {state.error ? <p role="alert" className="text-sm font-semibold text-alerte">{state.error}</p> : null}
                <button type="submit" disabled={sending} className="btn-primary">{sending ? "Publication…" : "Publier dans le fil"}</button>
                <button type="button" onClick={() => setPublishing(false)} className="min-h-11 text-[13px] font-semibold text-terre underline underline-offset-2">
                  Finalement, garder pour moi
                </button>
              </form>
            ) : (
              <>
                <button ref={primary} type="button" onClick={finish} className="btn-primary min-h-14 font-display text-[19px] font-normal">
                  {c && !challengeDone ? "Je continue !" : "Super !"}
                </button>
                <button type="button" onClick={() => setPublishing(true)} className="btn-ghost">
                  Publier dans le fil
                </button>
                {c && challengeDone ? (
                  <button
                    type="button"
                    disabled={sharedDone}
                    onClick={async () => {
                      const r = await shareChallengeDone(c.id);
                      if (r.ok) setSharedDone(true);
                    }}
                    className="btn-ghost"
                  >
                    {sharedDone ? "Réussite partagée dans le fil" : "Partager ma réussite de défi"}
                  </button>
                ) : null}
              </>
            )}
            <button type="button" onClick={close} className="min-h-11 text-[13px] font-semibold text-terre underline underline-offset-2">
              Enregistrer autre chose
            </button>
            <p className="text-center text-xs text-terre">Refais-le demain pour garder ta série.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
