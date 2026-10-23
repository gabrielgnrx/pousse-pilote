import Link from "next/link";
import { dismissIntro } from "@/lib/intro-actions";

/** Affiché tant que la personne n'a pas cliqué « C'est compris ». */
export function IntroCard() {
  return (
    <section className="flex flex-col gap-3 rounded-[24px] bg-peche p-4 text-[#3a1606] shadow-[inset_0_-4px_0_var(--color-peche-fonce)]" aria-labelledby="intro">
      <h2 id="intro" className="font-display text-lg">Comment ça marche</h2>
      <ol className="flex flex-col gap-2.5 text-sm leading-snug">
        <li className="flex gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-argile font-display text-sm text-white">1</span>
          <span><strong>Les pousses, pour jouer.</strong> Enregistre tes actions, relève des défis, réussis tes quêtes du jour : tu montes de niveau et ton jardin pousse.</span>
        </li>
        <li className="flex gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-argile font-display text-sm text-white">2</span>
          <span><strong>Ton équipe, pour gagner.</strong> Les équipes sont classées en pousses par personne. Déjà très sobre ? Tes bonnes habitudes rapportent autant que les changements des autres.</span>
        </li>
        <li className="flex gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-argile font-display text-sm text-white">3</span>
          <span><strong>Les kg de CO₂, pour la planète.</strong> C&apos;est l&apos;impact réel, calculé avec l&apos;ADEME. Il ne sert pas à gagner : il fait avancer l&apos;objectif de toute l&apos;entreprise.</span>
        </li>
      </ol>
      <div className="flex gap-2">
        <form action={dismissIntro} className="flex-1">
          <button type="submit" className="btn-dark w-full text-sm">C&apos;est compris</button>
        </form>
        <Link href="/regles" className="btn-ghost flex-1 border-argile-fonce text-sm text-argile-fonce hover:bg-peche-fonce">Le barème</Link>
      </div>
    </section>
  );
}
