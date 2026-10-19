import Link from "next/link";
import { POINT_RULES } from "@/lib/co2/engagement.ts";

export const metadata = { title: "Comment ça marche · Pousse" };

export default function ReglesPage() {
  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">Comment ça marche</h1>
        <p className="mt-1 text-sm text-terre">Deux chiffres, deux rôles : les pousses pour jouer, les kg pour la planète.</p>
      </div>

      <section className="card flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="chip bg-peche">Le jeu</span>
          <h2 className="font-display text-lg font-bold">Les pousses</h2>
        </div>
        <p className="text-sm leading-relaxed">
          C&apos;est le seul chiffre qui compte pour le classement. On en gagne avec ce qui se vérifie : un défi
          validé avec une preuve, les quêtes du jour, une série de jours actifs, un meilleur choix au scanner,
          les habitudes déjà acquises. Quelqu&apos;un de très sobre gagne autant de pousses que quelqu&apos;un
          qui part de loin.
        </p>
        <table className="w-full text-left text-sm">
          <tbody>
            {POINT_RULES.map((r) => (
              <tr key={r.label} className="border-t border-encre/10">
                <td className="py-2 pr-3">{r.label}</td>
                <td className="py-2 text-right font-bold whitespace-nowrap">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="chip bg-abricot">Pour pimenter</span>
          <h2 className="font-display text-lg font-bold">Les à-côtés du jeu</h2>
        </div>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed">
          <li><strong>Défi collectif de la semaine.</strong> Chaque lundi, un objectif commun à toute l&apos;entreprise
            (repas végé, trajets, scanner, quiz…). S&apos;il est atteint, +30 pour chaque personne qui y a contribué.</li>
          <li><strong>Duels.</strong> Défie un collègue sur 7 jours. Seules les actions avec preuve comptent. Les deux
            réussissent : +25 chacun ; un seul : +40. Personne ne perd de pousses.</li>
          <li><strong>Quiz du jour.</strong> Une question, la même pour toute l&apos;entreprise : +5 si c&apos;est juste,
            et ça compte pour ta série.</li>
          <li><strong>Graine mystère.</strong> Quand tes 3 quêtes du jour sont faites : +5, +10, +20 pousses ou une
            plante rare pour ton jardin.</li>
          <li><strong>Jardin.</strong> Chaque type d&apos;action fait pousser une espèce (4 stades), les exploits
            débloquent des plantes rares. Tes collègues peuvent le voir.</li>
        </ul>
      </section>

      <section className="card flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="chip bg-sauge">Gagner ensemble</span>
          <h2 className="font-display text-lg font-bold">Le classement des équipes</h2>
        </div>
        <p className="text-sm leading-relaxed">
          Chaque équipe est classée sur ses pousses par participant, pour que les grandes équipes n&apos;écrasent
          pas les petites. Une personne inactive compte 0 : chaque participant compte. Les équipes de moins de
          5 personnes sont regroupées pour que personne ne soit identifiable.
        </p>
      </section>

      <section className="card flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="chip bg-sapin text-sapin-clair">L&apos;impact</span>
          <h2 className="font-display text-lg font-bold">Les kg de CO₂ évités</h2>
        </div>
        <p className="text-sm leading-relaxed">
          C&apos;est l&apos;impact réel, calculé avec les facteurs de l&apos;ADEME : un défi ne compte que
          s&apos;il remplace une habitude déclarée dans ton bilan. Ce chiffre ne sert pas à gagner. Il fait
          avancer l&apos;objectif commun de l&apos;entreprise, et c&apos;est lui que voit ton employeur, en
          total par équipe uniquement.
        </p>
      </section>

      <Link href="/methodologie" className="btn-ghost text-sm">Le détail des calculs</Link>
    </>
  );
}
