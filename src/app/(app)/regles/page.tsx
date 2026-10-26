import Link from "next/link";
import { POINT_RULES } from "@/lib/co2/engagement.ts";

export const metadata = { title: "Comment ça marche · Pousse" };

export default function ReglesPage() {
  return (
    <>
      <div>
        <h1 className="font-display text-2xl">Comment ça marche</h1>
        <p className="mt-1 text-sm text-terre">Deux chiffres, deux rôles : les pousses pour jouer, les kg pour la planète.</p>
      </div>

      <section className="card flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="chip bg-peche text-argile-fonce">Le jeu</span>
          <h2 className="font-display text-lg">Les pousses</h2>
        </div>
        <p className="text-sm leading-relaxed">
          C&apos;est le seul chiffre qui compte pour le classement. On en gagne avec chaque action
          enregistrée avec le bouton + (sans preuve, sauf pour quelques grosses actions), les quêtes du jour, une série de jours actifs, un meilleur choix au scanner. Quelqu&apos;un de très sobre gagne autant de pousses que quelqu&apos;un
          qui part de loin : une bonne habitude que tu as déjà (vélo, repas végé…) rapporte autant qu&apos;un
          changement, même si elle n&apos;évite pas de CO₂ en plus. Les petits gestes (escaliers, gourde…) rapportent
          5 pousses par jour au plus, tous confondus : ils comptent quand même pour ta série et tes quêtes. Le
          train, les vacances en train et les réparations se confirment sur l&apos;honneur et sont plafonnés chaque
          année d&apos;après ton bilan (autant de voyages en train que de vols déclarés, 2 réparations). Les
          trajets sont plafonnés chaque semaine (2 par jour de bureau déclaré), et le bilan se refait une fois
          par mois au plus.
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
          <h2 className="font-display text-lg">Les à-côtés du jeu</h2>
        </div>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed">
          <li><strong>Actions et défis.</strong> Une action, c&apos;est ce que tu fais au quotidien, enregistré avec le bouton + :
            ses pousses arrivent tout de suite. Un défi, c&apos;est un objectif sur plusieurs jours, seul, en duel ou en
            équipe. À plusieurs, ça rapporte plus : chaque action qui compte dans un duel vaut ×1,5, dans le défi
            d&apos;équipe de la semaine ×2. Défi réussi seul : +20 ; défi d&apos;équipe atteint : +50 pour chaque
            contributeur.</li>
          <li><strong>Achats via une appli durable.</strong> Occasion (Vinted, Leboncoin, Back Market…) ou panier
            anti-gaspi (Too Good To Go, Phenix…) : +30, sur l&apos;honneur, 3 achats par semaine au plus pour chacun.</li>
          <li><strong>Duels.</strong> Défie quelqu&apos;un d&apos;une autre équipe sur 7 jours, par exemple en lançant un
            défi. Les deux réussissent : +30 chacun ; un seul : +40. Chacun mise 10 pousses : ne pas atteindre
            l&apos;objectif te coûte ta mise. Refuser, ou ne pas répondre en 3 jours, ne coûte rien. Une mise perdue
            ne fait jamais passer ton total sous zéro.</li>
          <li><strong>Quiz du jour.</strong> 10 questions difficiles, les mêmes pour toute l&apos;entreprise, jamais
            déjà posées : +1 par bonne réponse, +5 de bonus à 8/10 ou plus. 7/10 ou plus compte comme un quiz réussi
            pour les défis d&apos;équipe.</li>
          <li><strong>Graine mystère.</strong> Quand tes 3 quêtes du jour sont faites : +5, +10, +20 pousses ou une
            plante rare pour ton jardin.</li>
          <li><strong>Jardin.</strong> Chaque type d&apos;action fait pousser une espèce (4 stades), les exploits
            débloquent des plantes rares. Tes collègues peuvent le voir.</li>
        </ul>
      </section>

      <section className="card flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="chip bg-sauge text-sapin">Gagner ensemble</span>
          <h2 className="font-display text-lg">Le classement des équipes</h2>
        </div>
        <p className="text-sm leading-relaxed">
          Chaque équipe est classée sur ses pousses par personne, pour que les grandes équipes n&apos;écrasent
          pas les petites. Tous les membres de l&apos;équipe comptent dans l&apos;effectif, actifs ou non. Le score
          est lissé vers la moyenne de l&apos;entreprise, comme si chaque équipe comptait 3 personnes « moyennes »
          de plus : une petite équipe ne gagne pas sur un coup de chance, et une grande n&apos;est pas noyée.
          Les équipes de moins de 5 membres ne sont pas classées, pour que personne ne soit identifiable.
        </p>
      </section>

      <section className="card flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="chip bg-sapin text-sapin-clair">L&apos;impact</span>
          <h2 className="font-display text-lg">Les kg de CO₂ évités</h2>
        </div>
        <p className="text-sm leading-relaxed">
          C&apos;est une estimation, calculée avec les facteurs de l&apos;ADEME à partir de ce que chacun
          déclare, sans vérification : une action ne compte que si elle remplace une habitude déclarée dans ton
          bilan. C&apos;est pourquoi l&apos;appli parle de CO₂ « déclaré ». Ce chiffre ne sert pas à gagner. Il fait
          avancer l&apos;objectif commun de l&apos;entreprise, et c&apos;est lui que voit ton employeur, en
          total par équipe uniquement.
        </p>
      </section>

      <Link href="/methodologie" className="btn-ghost text-sm">Le détail des calculs</Link>
    </>
  );
}
