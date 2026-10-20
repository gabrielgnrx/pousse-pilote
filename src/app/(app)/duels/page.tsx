import Link from "next/link";
import { requireProfile } from "@/lib/session";
import { duelOutcome, getDuels, type Duel } from "@/lib/game/data.ts";
import { DUEL_KINDS } from "@/lib/game/labels.ts";
import { formatDay } from "@/lib/dates";
import { answerDuel } from "@/lib/game/actions";
import { DuelForm } from "./DuelForm";

export const metadata = { title: "Duels · Pousse" };

export default async function DuelsPage({
  searchParams,
}: {
  searchParams: Promise<{ avec?: string; type?: string; lance?: string; accepte?: string; erreur?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, user } = await requireProfile();
  const [duels, { data: people }] = await Promise.all([
    getDuels(supabase),
    supabase.from("profiles").select("id, display_name").neq("id", user.id).order("display_name"),
  ]);
  const colleagues = (people ?? []).map((p) => ({ id: p.id as string, name: p.display_name as string }));
  const invites = duels.filter((d) => d.status === "pending" && d.role === "opponent");
  const sent = duels.filter((d) => d.status === "pending" && d.role === "challenger");
  const active = duels.filter((d) => d.status === "active");
  const past = duels.filter((d) => !["pending", "active"].includes(d.status));

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">Duels</h1>
        <p className="mt-1 text-sm text-terre">Un collègue, une action, 7 jours. Le meilleur moyen de s&apos;y mettre à deux.</p>
      </div>
      {sp.lance ? <p role="status" className="rounded-2xl bg-sauge px-4 py-3 text-sm font-bold text-[#2e3a22]">Défi envoyé ! Il a 3 jours pour l&apos;accepter.</p> : null}
      {sp.accepte ? <p role="status" className="rounded-2xl bg-sauge px-4 py-3 text-sm font-bold text-[#2e3a22]">C&apos;est parti pour 7 jours !</p> : null}
      {sp.erreur ? <p role="alert" className="rounded-2xl bg-peche px-4 py-3 text-sm font-bold">Ce duel n&apos;est plus disponible.</p> : null}

      {invites.map((d) => (
        <section key={d.id} className="flex flex-col gap-3 rounded-[20px] bg-abricot p-4 text-[#402a16]">
          <p className="text-sm">
            <strong>{d.other_name}</strong> te défie : <strong>{d.target} {DUEL_KINDS[d.kind]?.units}</strong> en 7 jours.
          </p>
          <div className="flex gap-2">
            <form action={answerDuel} className="flex-1">
              <input type="hidden" name="duel" value={d.id} />
              <input type="hidden" name="accept" value="1" />
              <button type="submit" className="btn-dark w-full text-sm">J&apos;accepte</button>
            </form>
            <form action={answerDuel}>
              <input type="hidden" name="duel" value={d.id} />
              <input type="hidden" name="accept" value="0" />
              <button type="submit" className="btn-ghost text-sm">Pas cette fois</button>
            </form>
          </div>
        </section>
      ))}

      {active.length > 0 ? (
        <section className="flex flex-col gap-2" aria-labelledby="en-cours">
          <h2 id="en-cours" className="label">En cours</h2>
          {active.map((d) => <ActiveDuel key={d.id} d={d} />)}
        </section>
      ) : null}

      {sent.length > 0 ? (
        <section className="card flex flex-col gap-1.5" aria-labelledby="envoyes">
          <h2 id="envoyes" className="label">En attente de réponse</h2>
          {sent.map((d) => (
            <p key={d.id} className="text-sm">
              {d.other_name} · {d.target} {DUEL_KINDS[d.kind]?.units}
            </p>
          ))}
        </section>
      ) : null}

      <DuelForm colleagues={colleagues} defaultOpponent={sp.avec} defaultKind={sp.type} />

      {past.length > 0 ? (
        <section className="card flex flex-col gap-1" aria-labelledby="termines">
          <h2 id="termines" className="label">Terminés</h2>
          {past.map((d) => {
            const o = duelOutcome(d);
            const txt =
              d.status === "declined" ? "refusé" : d.status === "expired" ? "sans réponse" :
              o === "gagne" ? "gagné · +40" : o === "partage" ? "réussi à deux · +25" : o === "perdu" ? `gagné par ${d.other_name}` : "personne n'a atteint l'objectif";
            return (
              <p key={d.id} className="flex justify-between gap-2 border-t border-encre/10 py-1.5 text-sm first-of-type:border-0">
                <span>{d.other_name} · {DUEL_KINDS[d.kind]?.label}</span>
                <span className={`shrink-0 font-semibold ${o === "gagne" || o === "partage" ? "text-sapin" : "text-terre"}`}>{txt}</span>
              </p>
            );
          })}
        </section>
      ) : null}

      <Link href="/fil" className="text-center text-xs font-bold underline underline-offset-2">Retour au fil</Link>
    </>
  );
}

function ActiveDuel({ d }: { d: Duel }) {
  const k = DUEL_KINDS[d.kind];
  const bar = (n: number) => `${Math.min(100, (n / d.target) * 100)}%`;
  return (
    <article className="card flex flex-col gap-2.5">
      <p className="text-sm">
        <strong>Toi contre {d.other_name}</strong> · {d.target} {k?.units} · jusqu&apos;au {d.ends_on ? formatDay(d.ends_on) : ""}
      </p>
      {[
        { who: "Toi", n: d.mine, cls: "bg-sapin" },
        { who: d.other_name, n: d.theirs, cls: "bg-argile" },
      ].map((r) => (
        <div key={r.who} className="flex items-center gap-2 text-sm">
          <span className="w-20 truncate font-semibold">{r.who}</span>
          <span className="h-2.5 flex-1 rounded-full bg-trait">
            <span className={`block h-2.5 rounded-full ${r.cls}`} style={{ width: bar(r.n) }} />
          </span>
          <span className="w-10 text-right font-bold">{Math.min(r.n, d.target)}/{d.target}</span>
        </div>
      ))}
      <Link href={d.kind === "scan" ? "/scanner" : "/agir"} className="text-xs font-bold underline underline-offset-2">
        {d.mine >= d.target ? "Objectif atteint, bravo !" : `Ajouter un ${k?.unit}`}
      </Link>
    </article>
  );
}
