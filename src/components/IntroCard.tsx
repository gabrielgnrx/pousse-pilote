import Link from "next/link";
import { dismissIntro } from "@/lib/intro-actions";

/** Affiché tant que la personne n'a pas cliqué « C'est compris ». */
export function IntroCard() {
  return (
    <section className="flex flex-col gap-3 rounded-[20px] bg-abricot p-4 text-[#402a16]" aria-labelledby="intro">
      <h2 id="intro" className="font-display text-lg font-bold">Comment ça marche</h2>
      <ol className="flex flex-col gap-2.5 text-sm leading-snug">
        <li className="flex gap-2.5">
          <span className="font-display font-bold">1</span>
          <span><strong>Les pousses, pour jouer.</strong> Enregistre tes actions, relève des défis, réussis tes quêtes du jour : tu montes de niveau et ton jardin pousse.</span>
        </li>
        <li className="flex gap-2.5">
          <span className="font-display font-bold">2</span>
          <span><strong>Ton équipe, pour gagner.</strong> Les équipes sont classées en pousses par personne. Déjà très sobre ? Tes bonnes habitudes rapportent autant que les changements des autres.</span>
        </li>
        <li className="flex gap-2.5">
          <span className="font-display font-bold">3</span>
          <span><strong>Les kg de CO₂, pour la planète.</strong> C&apos;est l&apos;impact réel, calculé avec l&apos;ADEME. Il ne sert pas à gagner : il fait avancer l&apos;objectif de toute l&apos;entreprise.</span>
        </li>
      </ol>
      <div className="flex gap-2">
        <form action={dismissIntro} className="flex-1">
          <button type="submit" className="btn-dark w-full text-sm">C&apos;est compris</button>
        </form>
        <Link href="/regles" className="btn-ghost flex-1 text-sm">Le barème</Link>
      </div>
    </section>
  );
}
