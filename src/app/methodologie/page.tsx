import { PublicPage, Section } from "@/components/PublicPage";
import { SOURCES } from "@/lib/co2/factors.ts";

export const metadata = { title: "Méthodologie · Pousse" };

const ROWS: [string, string][] = [
  ["Voiture thermique, seul", "0,111 kg / km"],
  ["Voiture électrique, seul", "0,012 kg / km"],
  ["Covoiturage à deux", "0,055 kg / km par personne"],
  ["Métro / RER (moyenne)", "0,005 kg / km"],
  ["Vélo, marche", "0 kg / km"],
  ["TGV", "0,002 kg / km"],
  ["Avion, trajet court / long", "0,224 / 0,167 kg / km"],
  ["Repas au bœuf", "4,97 kg"],
  ["Repas au porc, poulet ou poisson (moyenne)", "1,52 kg"],
  ["Repas végétarien / végétalien", "0,85 / 0,54 kg"],
  ["T-shirt / jean / pull en laine / manteau neufs", "6,4 / 25,1 / 56,7 / 101 kg"],
  ["Smartphone / ordinateur portable neufs", "80,2 / 193 kg"],
  ["Chauffage gaz / électrique / pompe à chaleur", "17,8 / 2,1 / 1,2 kg par m² et par an"],
];

export default function MethodologiePage() {
  return (
    <PublicPage
      title="Comment on calcule"
      lead="Chaque kilo affiché est la différence entre deux situations mesurées par l'ADEME : ce que tu aurais fait, et ce que tu as fait. Pas de chiffre au doigt mouillé."
    >
      <Section title="Ton bilan">
        <p>
          14 questions sur tes trajets, tes repas, ton chauffage, tes vêtements, ton smartphone et tes appareils électroniques, calculées
          avec les facteurs de l&apos;ADEME ci-dessous, plus une part commune d&apos;environ 1 tonne pour
          les services publics (ordre de grandeur donné par Nos Gestes Climat).
        </p>
        <p>
          C&apos;est une estimation basse : l&apos;électricité de la maison, les loisirs et les achats
          autres que les vêtements et l&apos;électronique ne sont pas encore comptés. Le modèle complet Nos Gestes Climat sera branché dans une
          prochaine version.
        </p>
      </Section>
      <Section title="Le CO₂ d'un défi">
        <p>
          Un défi n&apos;existe dans Pousse que s&apos;il a un facteur d&apos;émission ADEME. Il ne te
          rapporte du CO₂ que s&apos;il remplace une habitude déclarée dans ton bilan : sans voiture,
          aller au travail à vélo ne compte pas. Tu choisis l&apos;action et l&apos;objectif, jamais le
          chiffre.
        </p>
        <p>
          Le calcul est refait par la base de données à chaque validation : l&apos;application
          n&apos;envoie jamais de chiffre de CO₂.
        </p>
      </Section>
      <Section title="Preuves et plafonds">
        <p>
          Chaque validation a un niveau de preuve : photo prise dans l&apos;application, confirmation
          d&apos;un collègue, ou les deux. Sans preuve, la validation compte pour toi mais n&apos;est pas
          publiée. Si le collègue ne confirme pas, la validation est annulée.
        </p>
        <p>
          Plafonds : 2 trajets domicile-travail et 2 repas par jour, 3 vêtements par jour, une semaine de
          chauffage à la fois. Un même trajet ne compte que pour un défi.
        </p>
      </Section>
      <Section title="Défis expert">
        <p>
          Pour celles et ceux qui ont déjà adopté les gestes du quotidien, des défis plus exigeants visent
          les postes qui restent : repas végétalien au lieu de végétarien (0,31 kg par repas), vacances en
          train au lieu d&apos;un aller-retour long-courrier (12 000 km d&apos;avion remplacés par 2 000 km
          de TGV, soit environ 1,99 t), réparer son smartphone (80,2 kg) ou son ordinateur (193 kg) au lieu
          d&apos;en racheter un neuf. La même règle s&apos;applique : ils ne sont proposés que s&apos;ils
          remplacent une habitude déclarée.
        </p>
      </Section>
      <Section title="Deux chiffres, deux rôles">
        <p>
          <strong>Les pousses servent à jouer.</strong> C&apos;est le seul chiffre du classement, individuel
          comme par équipe. Défi du quotidien 10 pousses par unité, train 30, défis expert de 15 à 150, +5 avec
          une preuve ; garder le cap sur une habitude bas carbone déjà acquise, 10 pousses par semaine ; les trois quêtes du jour, 15 ; une série de 3, 7, 14 ou 30 jours actifs, 10, 25, 50 ou 100 ; un
          collègue qui relève un défi depuis ta publication, 15 ; confirmer le défi d&apos;un collègue, 3.
        </p>
        <p>
          <strong>Les kg de CO₂ évités mesurent l&apos;impact.</strong> Ils restent stricts (seulement ce que
          tes défis changent par rapport à ton bilan) et ne servent pas à gagner : ils alimentent
          l&apos;objectif commun de l&apos;entreprise, par défaut 30 kg par participant sur la durée du pilote.
        </p>
        <p>
          Les équipes sont classées sur leurs pousses par participant ; une personne inactive compte 0. Les
          équipes de moins de 5 personnes sont regroupées. « Ce que tes habitudes évitent déjà », dans le bilan,
          compare tes habitudes à la voiture thermique seule et à des repas avec viande : c&apos;est une
          information, qui ne compte ni dans les pousses ni dans le CO₂ évité.
        </p>
      </Section>
      <Section title="Les facteurs utilisés">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-terre">
                <th className="py-1.5 pr-3 font-bold">Poste</th>
                <th className="py-1.5 font-bold">kg CO₂e</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([k, v]) => (
                <tr key={k} className="border-t border-encre/10">
                  <td className="py-1.5 pr-3">{k}</td>
                  <td className="py-1.5 font-semibold whitespace-nowrap">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-terre">
          Sources :{" "}
          <a className="underline" href={SOURCES.transport}>transport</a>,{" "}
          <a className="underline" href={SOURCES.alimentation}>alimentation (Agribalyse 3.2)</a>,{" "}
          <a className="underline" href={SOURCES.habillement}>habillement</a>,{" "}
          <a className="underline" href={SOURCES.numerique}>numérique</a>,{" "}
          <a className="underline" href={SOURCES.chauffage}>chauffage</a> (Impact CO₂, ADEME), relevés en octobre 2026.
        </p>
      </Section>
    </PublicPage>
  );
}
