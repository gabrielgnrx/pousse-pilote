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
          jamais d&apos;office.
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
      <Section title="Automatisation">
        <p>
          Pousse n&apos;utilise pas d&apos;intelligence artificielle. Ce que tu écris dans le + est compris par des règles
          simples (mots-clés et quantité), et rien n&apos;est enregistré sans ta confirmation. Ton CO₂ est calculé par
          Pousse avec les facteurs de l&apos;ADEME. Les messages de l&apos;animateur du chat sont des messages préparés à
          l&apos;avance, signalés comme venant d&apos;un bot ; ils ne citent que des totaux d&apos;équipe, et ne nomment
          que les personnes qui ont publié dans le fil.
        </p>
      </Section>
      <Section title="Conservation et droits">
        <p>
          Aucun justificatif n&apos;est demandé ; ceux déposés avant le 26/10/2026 sont effacés au bout de 30 jours.
          Photos publiées dans le fil supprimées après 90 jours. Tu peux
          télécharger toutes tes données ou supprimer ton
          compte à tout moment depuis ton profil. La participation est volontaire et sans lien avec ton
          évaluation professionnelle.
        </p>
        <p>Contact : [E-MAIL DU RESPONSABLE DE TRAITEMENT]</p>
      </Section>
    </PublicPage>
  );
}
