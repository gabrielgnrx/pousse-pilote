import Link from "next/link";
import type { Duel } from "@/lib/game/data.ts";
import { duelUnits } from "@/lib/game/labels.ts";
import { actionTitle } from "@/lib/actions-catalog";

/** Sur l'accueil : les invitations à un duel et les duels en cours, en une ligne chacun. */
export function DuelStrip({ duels }: { duels: Duel[] }) {
  const invites = duels.filter((d) => d.status === "pending" && d.role === "opponent");
  const active = duels.filter((d) => d.status === "active");
  if (!invites.length && !active.length) return null;
  return (
    <section className="flex flex-col gap-1.5" aria-label="Tes duels">
      {invites.map((d) => (
        <Link key={d.id} href="/duels" className="flex items-center gap-3 rounded-[18px] bg-abricot px-4 py-3 text-[#402a16]">
          <span aria-hidden="true" className="font-display text-xl">⚔</span>
          <span className="flex-1 text-sm">
            <strong>{d.other_name}</strong>
            {d.other_team ? ` (${d.other_team})` : ""} te défie : {d.target} × {duelUnits(d, actionTitle)} en 7 jours
            {d.stakes ? (
              <span className="block text-xs font-semibold">
                Mise : 10 pousses si tu acceptes. Refuser ne coûte rien.
              </span>
            ) : null}
          </span>
          <span className="text-sm font-bold">Répondre ›</span>
        </Link>
      ))}
      {active.map((d) => (
        <Link key={d.id} href="/duels" className="flex items-center gap-3 rounded-[18px] border border-encre/10 bg-papier px-4 py-2.5">
          <span aria-hidden="true" className="font-display text-lg">⚔</span>
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
