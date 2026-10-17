import Link from "next/link";
import type { DailyState } from "@/lib/engagement-data";
import { POINTS } from "@/lib/co2/engagement.ts";

const QUESTS = [
  { key: "defi", label: "Valide un défi", href: "/defis" },
  { key: "preuve", label: "Ajoute une preuve (photo ou collègue)", href: "/defis" },
  { key: "lien", label: "Encourage un collègue ou garde le cap", href: "/defis" },
] as const;

/** Les trois quêtes du jour : un petit objectif quotidien, +15 pousses quand tout est fait. */
export function DailyQuests({ daily }: { daily: DailyState }) {
  const done = QUESTS.filter((q) => daily.quests[q.key]).length;
  return (
    <section className="card flex flex-col gap-2.5" aria-labelledby="quetes">
      <div className="flex items-center justify-between">
        <h2 id="quetes" className="font-display text-lg font-bold">Quêtes du jour</h2>
        <span className={`chip ${daily.questDone ? "bg-sapin text-sapin-clair" : "bg-peche"}`}>
          {daily.questDone ? `+${POINTS.quete} gagnées` : `${done}/3 · +${POINTS.quete} pousses`}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {QUESTS.map((q) => {
          const ok = daily.quests[q.key];
          return (
            <li key={q.key}>
              <Link
                href={q.href}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 ${ok ? "bg-sauge" : "bg-creme hover:bg-sable"}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${ok ? "border-sapin bg-sapin text-sapin-clair" : "border-terre/50"}`}
                >
                  {ok ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M5 12l5 5 9-10" /></svg>
                  ) : null}
                </span>
                <span className={`flex-1 text-sm ${ok ? "font-semibold text-[#2e3a22] line-through decoration-2" : "font-semibold"}`}>
                  {q.label}
                </span>
                <span className="sr-only">{ok ? "fait" : "à faire"}</span>
                {!ok ? <span aria-hidden="true" className="text-terre">›</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-terre">
        {daily.questDone
          ? "Les trois sont faites. De nouvelles quêtes t'attendent demain."
          : done === 2
            ? "Plus qu'une quête pour le bonus du jour !"
            : "Elles se renouvellent chaque matin. Elles comptent aussi pour ta série."}
      </p>
    </section>
  );
}
