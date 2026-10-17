import Link from "next/link";
import type { DailyState, QuestKey } from "@/lib/engagement-data";
import { POINTS } from "@/lib/co2/engagement.ts";

const QUESTS: Record<QuestKey, { label: string; href: string }> = {
  preuve: { label: "Valide un défi avec une preuve", href: "/defis" },
  defi: { label: "Valide un défi", href: "/defis" },
  expert: { label: "Valide un défi expert", href: "/defis" },
  lancer: { label: "Lance ton premier défi", href: "/defis?onglet=catalogue" },
  scan: { label: "Scanne un produit", href: "/scanner" },
  meilleur_choix: { label: "Choisis une alternative mieux notée au scanner", href: "/scanner" },
  bravo: { label: "Encourage un collègue dans le fil", href: "/fil#publications" },
  cap: { label: "Garde le cap sur une habitude", href: "/defis" },
};

/** Les trois quêtes du jour, tirées chaque matin selon ton profil : +15 pousses quand tout est fait. */
export function DailyQuests({ daily }: { daily: DailyState }) {
  const order = daily.order.filter((k) => k in QUESTS);
  const done = order.filter((k) => daily.quests[k]).length;
  return (
    <section className="card flex flex-col gap-2.5" aria-labelledby="quetes">
      <div className="flex items-center justify-between">
        <h2 id="quetes" className="font-display text-lg font-bold">Quêtes du jour</h2>
        <span className={`chip ${daily.questDone ? "bg-sapin text-sapin-clair" : "bg-peche"}`}>
          {daily.questDone ? `+${POINTS.quete} gagnées` : `${done}/${order.length} · +${POINTS.quete} pousses`}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {order.map((k) => {
          const ok = Boolean(daily.quests[k]);
          const q = QUESTS[k];
          return (
            <li key={k}>
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
                <span className={`flex-1 text-sm font-semibold ${ok ? "text-[#2e3a22] line-through decoration-2" : ""}`}>{q.label}</span>
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
          : done === order.length - 1
            ? "Plus qu'une quête pour le bonus du jour !"
            : "Elles changent chaque matin. Chaque action compte aussi pour ta série."}
      </p>
    </section>
  );
}
