"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TEAM_KINDS, type TeamWeek } from "@/lib/team";
import { reportTeamMessage, sendTeamMessage, voteTeamWeek } from "./actions";
import { Mascot } from "@/components/Mascot";

export interface ChatMessage {
  id: string;
  mine: boolean;
  fromPousse: boolean;
  /** Message de l'animateur de Pousse : signalé comme venant d'un bot. */
  bot?: boolean;
  author: string;
  body: string;
  at: string;
}

const AVATAR = ["#b9d3e8", "#d7e3c8", "#f6d9a8", "#e3c9e8", "#e1ebdb", "#f2c14e"];
const colorOf = (name: string) => AVATAR[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR.length];
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).replace(":", " h ");
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
const left = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}` : `${min} min`);

function PousseAvatar() {
  return (
    <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-sapin">
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cfe2cd" strokeWidth="2.2" strokeLinecap="round">
        <path d="M12 21v-9" />
        <path d="M12 12c0-4 3-7 8-7 0 5-3 7-8 7Z" />
        <path d="M12 15c0-3-2.5-5.5-7-5.5 0 4 2.5 5.5 7 5.5Z" />
      </svg>
    </span>
  );
}

/** Le chat de l'équipe, avec le vote du défi de la semaine posté par Pousse le lundi à 9 h. */
export function TeamChat({
  week,
  messages,
  voteOpen,
  minutesLeft,
  voteAt,
}: {
  week: TeamWeek;
  messages: ChatMessage[];
  voteOpen: boolean;
  minutesLeft: number;
  voteAt: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [menu, setMenu] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  // Le chat se met à jour tout seul toutes les 15 secondes quand la page est visible.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 15000);
    return () => window.clearInterval(id);
  }, [router]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const run = (fn: () => Promise<{ error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
      else {
        after?.();
        router.refresh();
      }
    });

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    run(() => sendTeamMessage(body), () => setDraft(""));
  };

  // Le message de vote prend sa place dans la conversation, le lundi à 9 h.
  type Item = { kind: "msg"; m: ChatMessage } | { kind: "vote"; at: string };
  const items: Item[] = messages.map((m) => ({ kind: "msg" as const, m }));
  if (week.phase !== "upcoming") {
    const i = items.findIndex((x) => x.kind === "msg" && x.m.at > voteAt);
    items.splice(i < 0 ? items.length : i, 0, { kind: "vote", at: voteAt });
  }
  const totalVotes = week.options.reduce((s, o) => s + o.votes, 0);
  const chosen = week.chosen ? TEAM_KINDS[week.chosen] : null;
  const pct = week.target ? Math.min(100, ((week.progress ?? 0) / week.target) * 100) : 0;

  let lastDay = "";
  const dayChip = (iso: string) => {
    const d = dayLabel(iso);
    if (d === lastDay) return null;
    lastDay = d;
    return (
      <span className="self-center text-[11px] font-bold tracking-[0.08em] text-brun uppercase">{d}</span>
    );
  };

  const voteBubble = (
    <div className="flex items-end gap-2">
      <PousseAvatar />
      <div className="flex flex-1 flex-col gap-2.5 rounded-[20px] bg-papier p-3.5 shadow-[inset_0_0_0_2px_var(--color-pollen)]">
        <div className="flex items-start justify-between gap-2">
          <span className="font-display text-lg leading-tight">Quel défi pour l&apos;équipe cette semaine ?</span>
          <span className="flex h-6 shrink-0 items-center rounded-full bg-pollen-pale px-2.5 text-xs font-bold whitespace-nowrap text-pollen-texte">
            {voteOpen ? `Fin à 14 h · ${left(minutesLeft)}` : "Vote clos"}
          </span>
        </div>
        {week.options.map((o) => {
          const share = totalVotes ? (o.votes / totalVotes) * 100 : 0;
          const mine = week.my_vote === o.kind;
          const won = week.chosen === o.kind;
          return (
            <button
              key={o.kind}
              type="button"
              disabled={!voteOpen || pending}
              onClick={() => run(() => voteTeamWeek(o.kind))}
              aria-pressed={mine}
              className={`relative flex min-h-11 items-center justify-between gap-2 overflow-hidden rounded-[14px] px-3 text-left text-sm ${
                mine || won ? "border-2 border-chloro font-bold" : "border-2 border-transparent font-semibold"
              } bg-creme disabled:cursor-default`}
            >
              <span aria-hidden="true" className={`absolute inset-y-0 left-0 ${mine || won ? "bg-sauge-fonce" : "bg-sauge"}`} style={{ width: `${share}%` }} />
              <span className="relative">
                {TEAM_KINDS[o.kind].option(o.per_member)}
                {mine ? " · ton vote" : ""}
                {won ? " · choisi" : ""}
              </span>
              <span className="relative">{o.votes}</span>
            </button>
          );
        })}
        <span className="text-xs text-brun">
          Vote ouvert le lundi de 9 h à 14 h · {week.voters} vote{week.voters > 1 ? "s" : ""} sur {week.members}
          {voteOpen ? " · tu peux changer d'avis jusqu'à la fin" : ""}
        </span>
      </div>
    </div>
  );

  return (
    <section aria-label="Chat de l'équipe" className="-mx-4 flex flex-col">
      {chosen && week.target ? (
        <Link href={chosen.href} className="mx-4 mb-1 flex flex-col gap-2 rounded-[24px] bg-nuit px-4 py-3.5 text-white">
          <span className="flex items-center justify-between gap-2">
            <span className="flex h-6 items-center rounded-full bg-pollen px-2.5 text-[11px] font-extrabold tracking-wider text-encre uppercase">Défi de la semaine</span>
            <span className="text-xs text-nuit-pale">jusqu&apos;à dimanche</span>
          </span>
          <span className="font-display text-xl leading-tight">
            {week.target} {chosen.unit} pour l&apos;équipe
          </span>
          <span className="flex items-center gap-2.5">
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
              <span className="block h-2 rounded-full bg-pollen transition-[width] duration-1000" style={{ width: `${Math.max(pct, (week.progress ?? 0) > 0 ? 3 : 0)}%` }} />
            </span>
            <span className="text-[13px] font-semibold">
              {week.progress ?? 0}/{week.target} · toi : {week.mine ?? 0}
            </span>
          </span>
          <span className="text-xs text-nuit-pale">
            {pct >= 100
              ? "Objectif atteint : +50 pousses pour chaque contributeur !"
              : "Chaque action qui y compte rapporte double. Lundi de 9 h à 14 h, le vote du prochain défi s'ouvre ici."}
          </span>
        </Link>
      ) : null}
      {week.gained > 0 ? (
        <p role="status" className="animate-pousse-pop mx-4 mb-2 rounded-2xl bg-abricot px-4 py-2.5 text-sm font-bold text-encre">
          Défi d&apos;équipe réussi : +{week.gained} pousses pour toi !
        </p>
      ) : null}

      <div className="flex min-h-[40dvh] flex-col gap-3 px-4 pt-3 pb-24">
        {week.phase === "upcoming" ? (
          <p className="self-center rounded-full bg-sable px-3 py-1 text-xs font-semibold text-brun">
            Le vote du défi de la semaine ouvre ce lundi à 9 h
          </p>
        ) : null}
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-terre">Personne n&apos;a encore écrit. Lance la conversation !</p>
        ) : null}
        {items.map((it) => {
          if (it.kind === "vote") {
            return (
              <div key="vote" className="flex flex-col gap-3">
                {dayChip(it.at)}
                {voteBubble}
              </div>
            );
          }
          const m = it.m;
          return (
            <div key={m.id} className="flex flex-col gap-3">
              {dayChip(m.at)}
              {m.mine ? (
                <div className="flex flex-col items-end pl-12">
                  <span className="flex flex-col gap-0.5 rounded-[20px_20px_6px_20px] bg-sapin px-3 py-2 text-sapin-clair">
                    <span className="sr-only">Toi, </span>
                    <span className="text-sm leading-snug whitespace-pre-wrap">{m.body}</span>
                    <span className="self-end text-[10px] text-sapin-pale">{time(m.at)}</span>
                  </span>
                </div>
              ) : (
                <div className="flex items-end gap-2 pr-10">
                  {m.bot ? (
                    <span className="flex size-[30px] shrink-0 items-end justify-center overflow-hidden rounded-full bg-sauge">
                      <Mascot size={26} />
                    </span>
                  ) : m.fromPousse ? (
                    <PousseAvatar />
                  ) : (
                    <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full text-xs font-bold text-encre" style={{ background: colorOf(m.author) }}>
                      {m.author.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className={`flex min-w-0 flex-col gap-0.5 rounded-[20px_20px_20px_6px] px-3 py-2 ${m.fromPousse ? "bg-sauge text-sapin" : "bg-papier"}`}>
                    <span className="flex items-center gap-1 text-xs font-bold text-brun">
                      {m.author} · {time(m.at)}
                      {m.bot ? (
                        <span className="chip bg-sapin px-1.5 py-0 text-[10px] text-sapin-clair" title="Message automatique de l'animateur de Pousse">
                          bot
                        </span>
                      ) : null}
                      {!m.fromPousse ? (
                        <button
                          type="button"
                          onClick={() => setMenu(menu === m.id ? null : m.id)}
                          aria-expanded={menu === m.id}
                          aria-label={`Options du message de ${m.author}`}
                          className="-my-2 -mr-2 flex size-8 items-center justify-center rounded-full text-brun"
                        >
                          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                        </button>
                      ) : null}
                    </span>
                    <span className="text-[15px] leading-snug whitespace-pre-wrap">{m.body}</span>
                    {menu === m.id ? (
                      <button
                        type="button"
                        onClick={() => run(() => reportTeamMessage(m.id), () => setMenu(null))}
                        className="self-start rounded-full bg-sable px-3 py-1.5 text-xs font-bold text-alerte"
                      >
                        Signaler ce message
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={end} />
      </div>

      <form
        onSubmit={send}
        className="fixed inset-x-0 z-20 mx-auto flex max-w-md items-center gap-2 bg-creme px-4 py-2"
        style={{ bottom: "calc(72px + env(safe-area-inset-bottom))" }}
      >
        <label className="flex h-12 flex-1 items-center rounded-full border-[1.5px] border-trait bg-papier px-4 focus-within:border-chloro">
          <span className="sr-only">Écrire à l&apos;équipe</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            placeholder="Écrire à l'équipe…"
            className="h-full flex-1 bg-transparent text-base outline-none placeholder:text-terre/70"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          aria-label="Envoyer"
          className="flex size-12 items-center justify-center rounded-full bg-nuit disabled:opacity-50"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></svg>
        </button>
      </form>
      {error ? (
        <p role="alert" className="fixed inset-x-0 z-30 mx-auto max-w-md px-4" style={{ bottom: "calc(136px + env(safe-area-inset-bottom))" }}>
          <span className="block rounded-[20px] bg-pollen-pale px-4 py-2.5 text-sm font-semibold text-alerte shadow">{error}</span>
        </p>
      ) : null}
    </section>
  );
}
