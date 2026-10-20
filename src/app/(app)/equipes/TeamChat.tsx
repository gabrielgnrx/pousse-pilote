"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TEAM_KINDS, type TeamWeek } from "@/lib/team";
import { reportTeamMessage, sendTeamMessage, voteTeamWeek } from "./actions";

export interface ChatMessage {
  id: string;
  mine: boolean;
  fromPousse: boolean;
  author: string;
  body: string;
  at: string;
}

const AVATAR = ["#b9d3e8", "#d7e3c8", "#f6d9a8", "#e3c9e8", "#ecddbb", "#f0a97b"];
const colorOf = (name: string) => AVATAR[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR.length];
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).replace(":", " h ");
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
const left = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}` : `${min} min`);

function PousseAvatar() {
  return (
    <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#2f5b36]">
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cfe3c4" strokeWidth="2.2" strokeLinecap="round">
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
      <span className="self-center rounded-full bg-[#efe6d3] px-2.5 py-0.5 text-[11px] font-bold text-[#5e5240] first-letter:uppercase">{d}</span>
    );
  };

  const voteBubble = (
    <div className="flex gap-2">
      <PousseAvatar />
      <div className="flex flex-1 flex-col gap-2 rounded-[4px_16px_16px_16px] bg-[#2f5b36] p-3 text-[#f7f1e3]">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-bold">Quel défi pour l&apos;équipe cette semaine ?</span>
          <span className="text-[11px] font-bold whitespace-nowrap text-abricot">
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
              className={`relative flex min-h-11 items-center justify-between gap-2 overflow-hidden rounded-[10px] px-2.5 text-left text-[13px] ${
                mine || won ? "border-2 border-abricot font-bold" : "border-2 border-transparent font-semibold"
              } bg-white/[0.08] disabled:cursor-default`}
            >
              <span aria-hidden="true" className={`absolute inset-y-0 left-0 ${mine ? "bg-abricot/35" : "bg-white/15"}`} style={{ width: `${share}%` }} />
              <span className="relative">
                {TEAM_KINDS[o.kind].option(o.per_member)}
                {mine ? " · ton vote" : ""}
                {won ? " · choisi" : ""}
              </span>
              <span className="relative">{o.votes}</span>
            </button>
          );
        })}
        <span className="text-[11px] text-[#cfe3c4]">
          Vote ouvert le lundi de 9 h à 14 h · {week.voters} vote{week.voters > 1 ? "s" : ""} sur {week.members}
          {voteOpen ? " · tu peux changer d'avis jusqu'à la fin" : ""}
        </span>
      </div>
    </div>
  );

  return (
    <section aria-label="Chat de l'équipe" className="-mx-4 flex flex-col">
      {chosen && week.target ? (
        <Link href={chosen.href} className="sticky top-0 z-10 mx-4 mb-2 flex flex-col gap-1.5 rounded-2xl bg-sapin px-3.5 py-2.5 text-sapin-clair shadow-md">
          <span className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-bold tracking-wider uppercase">Défi d&apos;équipe de la semaine</span>
            <span className="font-bold">{week.progress ?? 0}/{week.target}</span>
          </span>
          <span className="text-sm font-bold">
            {week.target} {chosen.unit} ensemble · toi : {week.mine ?? 0}
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-white/20">
            <span className="block h-2 rounded-full bg-abricot transition-[width] duration-1000" style={{ width: `${Math.max(pct, (week.progress ?? 0) > 0 ? 3 : 0)}%` }} />
          </span>
          <span className="text-[11px] opacity-90">
            {pct >= 100 ? "Objectif atteint : +50 pousses pour chaque contributeur !" : `${chosen.hint} Chaque action qui y compte rapporte double, et +50 pour chaque contributeur.`}
          </span>
        </Link>
      ) : null}
      {week.gained > 0 ? (
        <p role="status" className="animate-pousse-pop mx-4 mb-2 rounded-2xl bg-abricot px-4 py-2.5 text-sm font-bold text-[#402a16]">
          Défi d&apos;équipe réussi : +{week.gained} pousses pour toi !
        </p>
      ) : null}

      <div className="flex min-h-[50dvh] flex-col gap-3 bg-papier px-4 pt-3 pb-24">
        {week.phase === "upcoming" ? (
          <p className="self-center rounded-full bg-[#efe6d3] px-3 py-1 text-xs font-semibold text-[#5e5240]">
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
                <div className="flex flex-col items-end gap-1 pl-12">
                  <span className="text-[11px] font-bold text-[#5e5240]">Toi · {time(m.at)}</span>
                  <span className="rounded-[16px_4px_16px_16px] bg-abricot px-3 py-2 text-sm leading-snug whitespace-pre-wrap text-encre">{m.body}</span>
                </div>
              ) : (
                <div className="flex gap-2 pr-10">
                  {m.fromPousse ? (
                    <PousseAvatar />
                  ) : (
                    <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full text-xs font-bold text-encre" style={{ background: colorOf(m.author) }}>
                      {m.author.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex items-center gap-2 text-[11px] font-bold text-[#5e5240]">
                      {m.author} · {time(m.at)}
                      {!m.fromPousse ? (
                        <button
                          type="button"
                          onClick={() => setMenu(menu === m.id ? null : m.id)}
                          aria-expanded={menu === m.id}
                          aria-label={`Options du message de ${m.author}`}
                          className="flex size-6 items-center justify-center rounded-full text-[#8c7a55]"
                        >
                          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                        </button>
                      ) : null}
                    </span>
                    <span className={`rounded-[4px_16px_16px_16px] px-3 py-2 text-sm leading-snug whitespace-pre-wrap ${m.fromPousse ? "bg-sauge text-sapin" : "bg-[#efe6d3]"}`}>
                      {m.body}
                    </span>
                    {menu === m.id ? (
                      <button
                        type="button"
                        onClick={() => run(() => reportTeamMessage(m.id), () => setMenu(null))}
                        className="self-start rounded-full border border-[#cdbf9f] px-3 py-1.5 text-xs font-bold text-argile-fonce"
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
        className="fixed inset-x-0 z-20 mx-auto flex max-w-md items-center gap-2 border-t border-encre/10 bg-papier px-3 py-2"
        style={{ bottom: "calc(72px + env(safe-area-inset-bottom))" }}
      >
        <label className="flex h-11 flex-1 items-center rounded-full bg-[#efe6d3] px-4">
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
          className="flex size-11 items-center justify-center rounded-full bg-[#2f5b36] disabled:opacity-50"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f7f1e3" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12 20 4l-6 16-3-7Z" /></svg>
        </button>
      </form>
      {error ? (
        <p role="alert" className="fixed inset-x-0 z-30 mx-auto max-w-md px-4" style={{ bottom: "calc(136px + env(safe-area-inset-bottom))" }}>
          <span className="block rounded-2xl bg-peche px-4 py-2.5 text-sm font-semibold text-argile-fonce shadow">{error}</span>
        </p>
      ) : null}
    </section>
  );
}
