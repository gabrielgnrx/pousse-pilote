import { PublicPage, Section } from "@/components/PublicPage";
import { AdminSignup } from "./AdminSignup";

export const metadata = { title: "Pousse pour les entreprises" };

/** La porte d'entrée des responsables RSE : lancer le programme en moins de 30 minutes, sans accompagnement. */
export default function EntreprisePage() {
  return (
    <PublicPage
      title="Lancez Pousse dans votre entreprise"
      lead="Un programme climat permanent, animé toute l'année, avec vos chiffres d'impact chaque mois. Lancement en moins de 30 minutes."
    >
      <AdminSignup />
      <Section title="Comment ça se passe">
        <ol className="list-decimal pl-5">
          <li>Vous créez votre organisation et vos équipes.</li>
          <li>Vous partagez le lien d&apos;invitation (ou le domaine e-mail de l&apos;entreprise suffit).</li>
          <li>Les salariés font leur bilan et enregistrent leurs actions ; l&apos;animateur de Pousse fait vivre les équipes.</li>
          <li>Vous suivez la participation et le CO₂ évité, et recevez un rapport chaque mois.</li>
        </ol>
      </Section>
      <Section title="Ce que vous voyez, et ce que vous ne voyez jamais">
        <p>
          Des totaux uniquement : participation, CO₂ évité par poste, tendances, classement des équipes. Jamais les actions,
          le bilan ou les messages d&apos;une personne, et aucun chiffre portant sur moins de 5 personnes.
        </p>
      </Section>
    </PublicPage>
  );
}
