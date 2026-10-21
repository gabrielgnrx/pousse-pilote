"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatKg } from "@/lib/co2/challenges.ts";
import { levelFor, weekStart } from "@/lib/co2/engagement.ts";
import { addDays, todayParis } from "@/lib/dates";
import { publishAction, type LoggedAction } from "./actions";
import { ThemeIcon } from "./ThemeIcon";
import { BONUS, fmtMult } from "@/lib/boosts";
import { formatDay } from "@/lib/dates";

const LEAVES = [
  { left: "8%", top: "6%", fill: "#dce6c4", rot: -20 },
  { left: "80%", top: "4%", fill: "#f0a97b", rot: 30 },
  { left: "88%", top: "22%", fill: "#dce6c4", rot: 60 },
  { left: "4%", top: "26%", fill: "#f6d9c0", rot: -50 },
  { left: "46%", top: "2%", fill: "#dce6c4", rot: 10 },
];
const DAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];

/** La pop-up après une action : ce que tu as évité, tes pousses, ta série, et pourquoi recommencer. */
export function ActionDone({ action, onClose }: { action: LoggedAction; onClose: () => void }) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
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

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-encre/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-done-title"
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {LEAVES.map((l, i) => (
          <svg key={i} width="26" height="26" viewBox="0 0 24 24" className="animate-pousse-pop absolute" style={{ left: l.left, top: l.top, transform: `rotate(${l.rot}deg)` }}>
            <path d="M12 2C6 6 4 12 6 20c8-2 12-8 6-18Z" fill={l.fill} />
          </svg>
        ))}
      </div>

      <div className="relative mt-10 flex max-h-[88dvh] w-full max-w-sm flex-col items-center gap-3 overflow-y-auto rounded-[28px] bg-creme px-5 pt-12 pb-5 text-center">
        <span className={`absolute -top-9 left-1/2 flex size-[76px] -translate-x-1/2 items-center justify-center rounded-full border-[6px] border-creme ${c ? "bg-argile" : "bg-sapin"}`}>
          {c ? (
            <svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff7ee" strokeWidth="2">
              <path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10Z" />
            </svg>
          ) : (
            <ThemeIcon theme={action.theme} size={34} color="#ede8d3" />
          )}
        </span>

        {c ? (
          <>
            <p className="text-xs font-bold tracking-wider text-argile-fonce uppercase">Défi · {action.title}</p>
            <h2 id="action-done-title" className="font-display text-3xl leading-tight font-bold">
              {challengeDone ? "Défi réussi !" : "Continue comme ça !"}
            </h2>
            <p className="text-sm text-brun">
              {c.done} sur {c.target} {c.target > 1 ? action.unit.many : action.unit.one}
              {challengeDone ? (action.duel ? ". Bravo, tu es allé au bout." : `. Bravo, tu es allé au bout : +${BONUS.seul} pousses.`) : ". Tu tiens bon."}
            </p>
            <ol className="grid w-full grid-cols-7 gap-1.5" aria-label="Ta semaine">
              {week.map((d) => (
                <li key={d.day} className="flex flex-col items-center gap-1">
                  <span
                    className={`flex size-9 items-center justify-center rounded-full ${
                      d.done
                        ? d.isToday
                          ? "border-[3px] border-peche bg-argile"
                          : "bg-sapin"
                        : d.isToday
                          ? "border-2 border-argile"
                          : d.inChallenge && d.future
                            ? "border-2 border-dashed border-[#b8a880]"
                            : "bg-sable"
                    }`}
                  >
                    {d.done ? (
                      <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
                    ) : null}
                  </span>
                  <span className={`text-[11px] ${d.isToday ? "font-bold text-argile-fonce" : "text-terre"}`}>{d.letter}</span>
                  <span className="sr-only">{d.done ? "fait" : d.future ? "à venir" : "pas fait"}</span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <>
            <h2 id="action-done-title" className="font-display text-[26px] leading-tight font-bold">
              Bien joué, {action.firstName} !
            </h2>
            <p className="text-sm text-brun">{action.title}</p>
          </>
        )}

        {action.kg > 0 ? (
          <div className="flex flex-col items-center">
            <span className="text-sm text-terre">Tu as évité</span>
            <span className="font-display text-5xl leading-none font-bold text-sapin">{formatKg(action.kg)}</span>
            <span className="text-sm font-semibold text-sapin">de CO₂</span>
          </div>
        ) : (
          <p className="rounded-2xl bg-sable px-3 py-2 text-xs leading-snug text-brun">
            {action.theme === "bureau"
              ? "Pas de CO₂ mesurable sur cette petite action, mais il compte pour ta série."
              : "Pas de CO₂ pour toi sur cette action (elle ne remplace rien dans ton bilan), mais il compte pour ta série."}
            {action.points === 0
              ? " Tu as déjà tes 5 pousses du jour pour les actions à 0 kg : celle-ci ne t'en rapporte pas."
              : " Les actions à 0 kg rapportent 5 pousses par jour au plus."}
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-2">
{action.points > 0 ? (
          <span className="animate-pousse-pop flex h-10 items-center gap-1.5 rounded-full bg-sauge px-3.5 font-bold text-sapin">
            <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 21v-9" /><path d="M12 12c0-4 3-7 8-7 0 5-3 7-8 7Z" /><path d="M12 15c0-3-2.5-5.5-7-5.5 0 4 2.5 5.5 7 5.5Z" /></svg>
            +{action.points} pousses
            {action.multiplier > 1 ? (
              <span className="ml-1 rounded-full bg-abricot px-2 py-0.5 text-xs text-[#402a16]">
                {fmtMult(action.multiplier)} {action.boost === "equipe" ? "équipe" : "duel"}
              </span>
            ) : null}
          </span>
          ) : null}
          <span className="flex h-10 items-center gap-1.5 rounded-full bg-sable px-3.5 font-bold text-brun">
            <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="#f0a97b" stroke="#c15f2c" strokeWidth="2"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10Z" /></svg>
            {action.streak} {action.streak > 1 ? "jours" : "jour"}
          </span>
        </div>

        {action.multiplier > 1 && action.points > 0 ? (
          <p className="-mt-1 text-xs text-terre">
            {action.basePoints} seul, {action.points} parce que tu joues {action.boost === "equipe" ? "en équipe" : "en duel"}
          </p>
        ) : null}

        {action.duel ? (
          <section aria-labelledby="duel-titre" className="flex w-full flex-col gap-2 rounded-2xl bg-papier px-4 py-3 text-left">
            <div className="flex items-baseline justify-between">
              <h3 id="duel-titre" className="text-sm font-bold">Ton duel contre {action.duel.otherName}</h3>
              <span className="text-xs text-terre">jusqu&apos;au {formatDay(action.duel.endsOn, "short")}</span>
            </div>
            {[
              { who: "Toi", n: action.duel.mine, color: "bg-sapin" },
              { who: action.duel.otherName, n: action.duel.theirs, color: "bg-argile" },
            ].map((r) => (
              <div key={r.who} className="flex items-center gap-2 text-xs">
                <span className="w-16 truncate font-bold">{r.who}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-trait">
                  <span className={`block h-full rounded-full ${r.color}`} style={{ width: `${Math.min(100, (r.n / action.duel!.target) * 100)}%` }} />
                </span>
                <span className="w-9 text-right font-bold">{Math.min(r.n, action.duel!.target)}/{action.duel!.target}</span>
              </div>
            ))}
            <p className="text-xs text-brun">
              {action.duel.mine >= action.duel.target
                ? action.duel.theirs >= action.duel.target
                  ? `Vous avez réussi tous les deux : +${BONUS.duelDeux} chacun à la fin du duel.`
                  : `Objectif atteint ! Si ${action.duel.otherName} n'y arrive pas, les +${BONUS.duelSeul} sont pour toi.`
                : `${action.duel.mine >= action.duel.theirs ? "Tu mènes !" : "Accroche-toi !"} Encore ${action.duel.target - action.duel.mine} et les +${BONUS.duelSeul} sont pour toi.`}
            </p>
          </section>
        ) : null}

        {c && !challengeDone ? (
          <p className="w-full rounded-2xl bg-papier px-4 py-3 text-left text-sm text-brun">
            Encore <strong>{remaining} {remaining > 1 ? action.unit.many : action.unit.one}</strong> pour réussir ton défi.
          </p>
        ) : (
          <div className="w-full rounded-2xl bg-papier px-4 py-3 text-left">
            <div className="flex justify-between text-xs">
              <span className="font-bold">{level.next ? `${level.name} → ${level.next.name}` : level.name}</span>
              <span className="text-terre">{action.total.toLocaleString("fr-FR")}{level.next ? ` / ${level.next.min.toLocaleString("fr-FR")}` : ""}</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-trait">
              <div className="h-2.5 rounded-full bg-sapin transition-[width] duration-1000" style={{ width: `${Math.max(4, level.progress * 100)}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-brun">
              {level.next
                ? `Encore ${level.next.missing} pousses : ta plante devient ${level.next.name.toLowerCase()}.`
                : "Niveau maximum : tu es une forêt !"}
            </p>
          </div>
        )}

        <p className="w-full rounded-2xl bg-sapin px-4 py-2.5 text-left text-xs leading-snug text-sapin-clair">
          {action.monthCount > 1 ? `${action.monthCount} fois ce mois-ci` : "Première fois ce mois-ci"}
          {action.monthKg > 0 ? `, soit ${formatKg(action.monthKg)} évités` : ""}.
          {action.companyKg !== null ? ` L'entreprise en est à ${formatKg(action.companyKg)}.` : ""}
        </p>

        {action.receipt ? (
          <div className="flex w-full flex-col gap-2">
            <p className="rounded-2xl bg-sable px-3 py-2 text-xs text-brun">Ton reçu reste privé : tes collègues ne le voient jamais, et il est effacé après 90 jours.</p>
            <button ref={primary} type="button" onClick={finish} className="btn-dark min-h-12 px-3">Super !</button>
          </div>
        ) : publishing ? (
          <form action={publish} className="flex w-full flex-col gap-2 text-left">
            <input type="hidden" name="validation" value={action.id} />
            <label className="text-sm font-bold" htmlFor="photo">Ta photo</label>
            <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required className="text-sm" />
            <label className="text-sm font-bold" htmlFor="caption">Un mot pour tes collègues (facultatif)</label>
            <input id="caption" name="caption" maxLength={280} className="input" />
            {state.error ? <p role="alert" className="text-sm font-semibold text-argile-fonce">{state.error}</p> : null}
            <button type="submit" disabled={sending} className="btn-primary">{sending ? "Publication…" : "Publier · +5 pousses"}</button>
          </form>
        ) : (
          <div className="flex w-full gap-2">
            <button type="button" onClick={() => setPublishing(true)} className="btn-ghost min-h-12 flex-1 px-3 text-sm">
              Ajouter une photo · +5
            </button>
            <button ref={primary} type="button" onClick={finish} className="btn-dark min-h-12 flex-1 px-3">
              {c && !challengeDone ? "Je continue !" : "Super !"}
            </button>
          </div>
        )}
        <button type="button" onClick={close} className="text-xs font-bold text-terre underline underline-offset-2">
          Enregistrer autre chose
        </button>
        <p className="text-xs text-terre">Refais-le demain pour garder ta série.</p>
      </div>
    </div>
  );
}
