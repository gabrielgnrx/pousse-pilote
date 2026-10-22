import Link from "next/link";
import type { DailyState, QuestKey } from "@/lib/engagement-data";
import { POINTS } from "@/lib/co2/engagement.ts";
import { SeedButton } from "./SeedButton";

const QUESTS: Record<QuestKey, { label: string; href: string }> = {
  preuve: { label: "Publie une action avec une photo", href: "/agir" },
  defi: { label: "Enregistre une action", href: "/agir" },
  expert: { label: "Enregistre une action de ton défi expert", href: "/agir" },
  lancer: { label: "Lance ton premier défi", href: "/defis?onglet=catalogue" },
  scan: { label: "Scanne un produit", href: "/scanner" },
  meilleur_choix: { label: "Choisis un produit mieux noté au scanner", href: "/scanner" },
  bravo: { label: "Encourage un collègue dans le fil", href: "/fil#publications" },
  quiz: { label: "Termine le quiz du jour (10 questions)", href: "/quiz" },
};

/** Les trois quêtes du jour, tirées chaque matin selon ton profil : +15 pousses quand tout est fait. */
export function DailyQuests({ daily }: { daily: DailyState }) {
  const order = daily.order.filter((k) => k in QUESTS);
  const done = order.filter((k) => daily.quests[k]).length;
  if (daily.questDone) {
    // Tout est fait : une ligne, et la graine mystère à ouvrir.
    return (
      <section className="flex flex-col gap-2 rounded-[18px] bg-sauge px-4 py-3" aria-labelledby="quetes">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sapin text-sapin-clair">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M5 12l5 5 9-10" /></svg>
          </span>
          <p className="flex-1 text-sm text-[#2e3a22]">
            <strong id="quetes">Quêtes du jour faites</strong> · +{POINTS.quete} pousses. Rendez-vous demain !
          </p>
        </div>
        {daily.seed?.state === "ready" ? <SeedButton /> : null}
        {daily.seed?.state === "opened" ? <SeedButton opened={{ plant: daily.seed.plant, points: daily.seed.points }} /> : null}
      </section>
    );
  }
  return (
    <section className="card flex flex-col gap-2 py-3.5" aria-labelledby="quetes">
      <div className="flex items-center justify-between">
        <h2 id="quetes" className="font-display text-base font-bold">Quêtes du jour</h2>
        <span className="chip bg-peche">
          {done}/{order.length} · +{POINTS.quete} pousses
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
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-1.5 ${ok ? "bg-sauge" : "bg-creme hover:bg-sable"}`}
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
      {daily.seed?.state === "ready" ? <SeedButton /> : null}
      <p className={`text-xs ${done === order.length - 1 ? "font-semibold text-argile-fonce" : "text-terre"}`}>
        {done === order.length - 1
          ? "Plus qu'une pour le bonus du jour et ta graine mystère !"
          : "Les trois : +15 pousses et une graine mystère."}
      </p>
    </section>
  );
}
