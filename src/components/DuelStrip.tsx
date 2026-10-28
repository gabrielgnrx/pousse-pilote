import Link from "next/link";
import type { Duel } from "@/lib/game/data.ts";
import { duelUnits } from "@/lib/game/labels.ts";
import { actionTitle } from "@/lib/actions-catalog";

/** Dans Mon plan : les invitations à un duel et les duels en cours, en une ligne chacun. */
export function DuelStrip({ duels }: { duels: Duel[] }) {
  const invites = duels.filter((d) => d.status === "pending" && d.role === "opponent");
  const active = duels.filter((d) => d.status === "active");
  if (!invites.length && !active.length) return null;
  return (
    <section className="flex flex-col gap-1.5" aria-label="Tes duels">
      {invites.map((d) => (
        <Link key={d.id} href="/duels" className="flex items-center gap-3 rounded-[20px] bg-nuit px-4 py-3 text-sapin-clair">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-feuille text-encre"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m14 4 6 6M5 19l9-9M4 14l6 6" /></svg></span>
          <span className="flex-1 text-sm">
            <strong>{d.other_name}</strong>
            {d.other_team ? ` (${d.other_team})` : ""} te défie : {d.target} × {duelUnits(d, actionTitle)} en 7 jours
            {d.stakes ? (
              <span className="block text-xs font-semibold">
                Mise : 10 pousses si tu acceptes. Refuser ne coûte rien.
              </span>
            ) : null}
          </span>
          <span className="flex min-h-11 items-center rounded-[14px] bg-feuille px-3 text-sm font-semibold text-encre">Répondre</span>
        </Link>
      ))}
      {active.map((d) => (
        <Link key={d.id} href="/duels" className="flex items-center gap-3 rounded-[20px] border border-trait bg-papier px-4 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sauge text-sapin"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m14 4 6 6M5 19l9-9M4 14l6 6" /></svg></span>
          <span className="min-w-0 flex-1 text-sm">
            Duel avec <strong>{d.other_name}</strong>
            <span className="block text-xs text-terre">{duelUnits(d, actionTitle)}</span>
          </span>
          <span className="text-sm font-bold whitespace-nowrap">
            {Math.min(d.mine, d.target)} – {Math.min(d.theirs, d.target)}
            <span className="font-normal text-terre"> /{d.target}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}
