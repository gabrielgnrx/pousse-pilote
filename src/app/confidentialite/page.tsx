import { PublicPage, Section } from "@/components/PublicPage";

export const metadata = { title: "Confidentialité · Pousse" };

export default function ConfidentialitePage() {
  return (
    <PublicPage
      title="Tes données, en clair"
      lead="Ton employeur ne voit jamais de donnée individuelle : ni ton bilan, ni tes défis, ni tes photos."
    >
      <Section title="Ce que voit ton employeur">
        <p>
          Des totaux par équipe et pour l&apos;entreprise : nombre de participants et CO₂ évité. Les équipes
          de moins de 5 membres ne sont pas classées, pour que personne ne soit identifiable.
        </p>
      </Section>
      <Section title="Ce que voient tes collègues">
        <p>
          Ton prénom et ton équipe, tes messages dans le chat de ton équipe, et seulement les actions et les défis
          que tu choisis de publier dans le fil interne : après chaque action, Pousse te propose de la publier,
          jamais d&apos;office. Tes justificatifs ne sont jamais visibles par tes collègues.
        </p>
      </Section>
      <Section title="Ce que fait Pousse de tes données">
        <p>
          Calculer ton empreinte et tes défis, et mesurer l&apos;usage de l&apos;outil pour l&apos;améliorer.
          Aucune donnée n&apos;est vendue ni utilisée à des fins publicitaires. Données hébergées en Union
          européenne.
        </p>
        <p>
          Rappels sur le téléphone : seulement si tu les actives, au plus un par jour. La notification part vide
          vers le service de push de ton téléphone (Google, Apple ou Mozilla) ; son texte n&apos;est lu
          qu&apos;à l&apos;arrivée, sur ton téléphone. Tu peux les couper à tout moment depuis ton profil.
        </p>
      </Section>
      <Section title="Intelligence artificielle">
        <p>
          Pousse utilise l&apos;IA (l&apos;API Claude d&apos;Anthropic) pour comprendre une action écrite ou dictée,
          formuler ton plan de la semaine, vérifier qu&apos;un justificatif ressemble bien à un billet ou à une facture,
          animer le chat de ton équipe, proposer des quiz et rédiger le rapport mensuel de l&apos;entreprise.
        </p>
        <p>
          L&apos;IA ne calcule jamais ton CO₂ : elle classe seulement ce que tu as fait, et le calcul est fait par
          Pousse avec les facteurs de l&apos;ADEME. Rien n&apos;est enregistré sans ta confirmation. Elle ne reçoit que
          le strict nécessaire : ta phrase sans e-mail ni numéro, des totaux anonymes pour ton plan et pour ton
          équipe, la photo du justificatif (dont aucune information n&apos;est gardée : seulement le verdict, et la
          photo est effacée). Le rapport de l&apos;entreprise n&apos;est rédigé qu&apos;à partir de totaux.
        </p>
        <p>
          Les messages de l&apos;animateur du chat sont signalés comme venant d&apos;un bot. Sans l&apos;IA, Pousse
          fonctionne quand même : raccourcis, formulaire et messages préparés prennent le relais.
        </p>
        <p>
          Tu peux refuser l&apos;IA pour tes propres données à l&apos;inscription ou à tout moment dans ton profil :
          tes phrases et tes justificatifs ne lui sont plus envoyés, et ton plan est calculé par les règles. Les
          actions qui demandent un justificatif comptent alors pour ton CO₂, sans leurs pousses (elles ne peuvent
          pas être vérifiées). L&apos;animateur du chat et le rapport de l&apos;entreprise ne reçoivent que des
          totaux, sans ton nom.
        </p>
        <p>Sous-traitant et conditions d&apos;utilisation des données : [À COMPLÉTER PAR LE RESPONSABLE DE TRAITEMENT]</p>
      </Section>
      <Section title="Conservation et droits">
        <p>
          Justificatifs vérifiés puis effacés (30 jours au plus) ; photos publiées dans le fil supprimées après
          90 jours. Le journal technique des appels à l&apos;IA ne contient ni tes phrases ni les réponses. Tu peux télécharger toutes tes données ou supprimer ton
          compte à tout moment depuis ton profil. La participation est volontaire et sans lien avec ton
          évaluation professionnelle.
        </p>
        <p>Contact : [E-MAIL DU RESPONSABLE DE TRAITEMENT]</p>
      </Section>
    </PublicPage>
  );
}
