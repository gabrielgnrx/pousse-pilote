# Pousse · web app salariés (version pilote)

Application web pour le pilote entreprise de Pousse : un salarié rejoint son entreprise avec un
code, fait son bilan carbone, relève des défis reliés à ses habitudes, les valide avec une
preuve et les partage dans le fil interne de l'entreprise.

Stack : Next.js 15 (App Router) · React 19 · Tailwind CSS 4 · Supabase (auth par lien e-mail,
Postgres, stockage des photos). Pensée mobile d'abord, utilisable sur ordinateur.

## Pousse v2 : programme climat permanent, animé par l'IA

La v2 (branche `v2`, plan et décisions dans `PLAN.md`) ajoute :
- **le + en langage naturel** : une phrase tapée ou dictée, comprise par l'IA, confirmée par la personne, puis
  calculée par la base (`log_action_slug`) ;
- **Mon plan** recalculé chaque lundi, **justificatifs** vérifiés par la vision, **animateur IA** dans le QG,
  **scanner par photo**, **quiz de la semaine** générés et relus ;
- **l'espace RSE** (`/entreprise` puis `/admin`) : lancement en self-serve, tableau de bord agrégé (rien sous
  5 personnes), rapport mensuel rédigé en flux, export PDF (impression) et CSV de la mobilité domicile-travail.

**Règle d'or** : l'IA ne calcule jamais le CO₂. Elle choisit une action d'un catalogue fermé
(`supabase/data/action_types.json`) ; la base calcule `quantité × facteur` avec la table versionnée
`emission_factors` (`supabase/data/emission_factors.json`, généré par `node scripts/generate-factors.ts`).

### Variables d'environnement (en plus de la v1)

| Variable | Rôle |
| --- | --- |
| `ANTHROPIC_API_KEY` | API Claude, côté serveur seulement (`src/lib/ai/client.ts`, protégé par `server-only`). Sans clé : replis sans IA. |
| `AI_MOCK=1` | Réponses simulées et déterministes (e2e, démo sans clé). |
| `SUPABASE_SERVICE_ROLE_KEY` | Vérification des justificatifs (lecture du bucket privé) et purges. |

### Migrations et tâches planifiées

Appliquer toutes les migrations (`supabase db push`). Celles dont la première ligne dit « Supabase
seulement » (`0032`, `0035`, `0037`) créent la clé des tâches IA dans Vault et programment `pg_cron` :
plans du lundi, animateur (lundi 9 h et 14 h, milieu de semaine, vendredi), quiz du lundi. Elles appellent
`https://pousse-pilote.vercel.app` : changer l'URL si le domaine est différent.

| Migration | Contenu |
| --- | --- |
| 0026 – 0028 | Facteurs d'émission, catalogue des actions, calcul sur facteurs, fil jamais automatique |
| 0029 | Socle IA : journal `ai_calls`, quotas, cache |
| 0030 – 0031 | Publication proposée (photo facultative), Mon plan |
| 0033 | Justificatifs : verdict seulement, photo effacée |
| 0034, 0036 | Animateur du QG, quiz de la semaine |
| 0038 – 0039 | Espace RSE : organisations, agrégats, rapports, export, journal IA de l'admin |
| 0040 | Refus de l'IA par salarié, appliqué par la base |
| 0041 | Classement du rapport limité au mois |

### Données de démo

`npm run db:demo` (avec `DATABASE_URL`) crée « Verdure Conseil (démo) » : 3 équipes, 30 salariés,
4 semaines d'actions passées par le vrai calcul, des messages de QG. Admin : `rse@verdure-demo.fr`.
À ne jamais jouer en production.

### Tests v2

```bash
npm test            # calcul, plafonds, parsing des sorties IA (réponses simulées), rapport, CSV
npm run test:sql    # migrations et scénarios sur PostgreSQL 16 (dont parité TS/SQL du calcul)
npm run test:e2e    # Playwright : action, confirmation, célébration, publication (Supabase local)
```

## Ce que fait l'application

| Écran | Rôle |
| --- | --- |
| `/rejoindre` | Code d'entreprise + e-mail pro → lien de connexion (pas de mot de passe) |
| `/bienvenue` | Prénom, équipe, consentements |
| `/questionnaire` | Bilan en 14 questions |
| `/bilan` | Empreinte par poste, ce que tu fais déjà, plus gros postes restants, plan d'action |
| `/defis` | Garder le cap, défis en cours, plafonds du jour, catalogue (défis expert, défis non proposés et pourquoi) |
| `/defis/nouveau/[défi]` | Choix de la variante et de l'objectif, impact calculé en direct |
| `/defis/[id]/valider` | Validation avec photo et/ou collègue témoin, choix de publier |
| `/scanner` | Scan d'un code-barres (caméra ou saisie), Green-Score, CO₂ Agribalyse, 3 alternatives mieux notées |
| `/regles` | Comment ça marche : points, classement, kg, barème |
| `/fil` | Fil interne de l'entreprise : bravos, signalement, « Relever aussi », et bonnes nouvelles des médias |
| `/equipes` | Classement en points par participant (équipes de 5 minimum), toi, objectif de l'entreprise |
| `/notifications` | Confirmations demandées par des collègues |
| `/avis` | Questionnaire de 3 questions pour le pilote |
| `/profil` | Points Pousse détaillés, série, influence, préférences, export, suppression du compte |
| `/methodologie`, `/confidentialite` | Pages publiques |

## Les règles de calcul (le cœur du produit)

- Tous les facteurs viennent de l'ADEME (Impact CO₂, Agribalyse 3.2) : `src/lib/co2/factors.ts`.
- **Un défi ne rapporte du CO₂ que s'il remplace une habitude déclarée dans le bilan.**
  Sans voiture, le vélo ne compte pas ; sans vol déclaré, « train au lieu de l'avion » n'est pas proposé.
- **Le CO₂ est recalculé par la base** à chaque validation (fonction SQL `validate_challenge_day`) :
  le navigateur n'envoie jamais de chiffre. Les insertions directes dans `validations` sont refusées.
- Plafonds partagés : 2 trajets domicile-travail et 2 repas par jour, 3 vêtements par jour,
  1 semaine de chauffage à la fois.
- Sans preuve (photo ou collègue), la validation compte mais n'est pas publiée. Si le collègue refuse,
  la validation est annulée.

Le calcul existe en deux exemplaires, qui doivent rester identiques :
`src/lib/co2/challenges.ts` (aperçus à l'écran) et `unit_kg` dans
`supabase/migrations/0002_functions.sql` (calcul officiel). Les tests vérifient les mêmes valeurs des deux côtés.

## Le jeu et l'impact

Deux chiffres, deux rôles, expliqués dans l'app (`/regles` et l'écran « Comment ça marche » du fil) :

- **Les pousses = le jeu.** Seul chiffre du classement, individuel et par équipe (pousses par participant,
  inactifs à 0). Seules les validations avec preuve rapportent des pousses (`0009_equilibrage.sql`) : défi
  du quotidien +10 par unité, train +30, défis expert +15 à +150, +5 de bonus de preuve ; sans preuve, le CO₂
  compte mais pas les pousses. Garder le cap +10 pour 2 habitudes par semaine au plus, les 3 quêtes du jour
  +15 (tirées chaque matin parmi : défi avec preuve, défi expert, lancer un défi, scanner un produit,
  meilleur choix au scanner, bravo à un collègue, garder le cap), une seule série : les jours actifs
  (+10 à 3 jours, +25 à 7, +50 à 14, +100 à 30), influence +15, témoin +3. Dans la base, la colonne
  s'appelle toujours `points` ; les pousses hors défis sont dans `points_ledger`, écrites uniquement par la
  base (`claim_daily_rewards` pour les quêtes et les séries, appelée à l'ouverture de l'accueil).
- **Les kg de CO₂ évités = l'impact.** Stricts, ils ne servent pas à gagner : ils alimentent un seul objectif
  collectif, celui de l'entreprise (30 kg par participant sur `companies.pilot_weeks`, 8 par défaut).

L'accueil est construit pour donner envie de revenir : la plante grandit de niveau en niveau (Graine, Germe,
Pousse, Plantule, Arbuste, Arbre, Forêt), le total de pousses monte en direct depuis la dernière visite avec
un « +N », les quêtes du jour se cochent, la série de jours actifs promet son prochain bonus, et les
dernières pousses gagnées défilent. Le compteur est aussi en haut de chaque page.

Pour garder motivées les personnes déjà sobres : « garder le cap » sur les habitudes déjà acquises,
points d'influence quand un collègue relève un défi depuis leur publication (`inspired_by`), défis expert
(repas végétalien, vacances en train au lieu du long-courrier, réparer son smartphone ou son ordinateur),
et dans le bilan les plus gros postes restants et « ce que tes habitudes évitent déjà » (une comparaison,
jamais ajoutée au CO₂ évité).

Migrations `0005_engagement.sql` à `0009_equilibrage.sql` ; scénario `supabase/tests/scenario_engagement.sql`
(à jouer après `scenario.sql`).

## Scanner de produits

`/scanner` lit le code-barres avec la caméra (API BarcodeDetector sur Chrome Android, sinon la bibliothèque
ZXing chargée à la demande depuis unpkg pour Safari) ou par saisie. La fiche vient d'**Open Food Facts**
(licence ODbL, source citée sur chaque page) : Green-Score (ex-Eco-Score) et empreinte carbone Agribalyse en
kg CO₂e par kg. Les alternatives sont cherchées dans la catégorie la plus précise du produit, puis la
catégorie parente, parmi les produits vendus en France : mieux notées, ou même note et au moins 10 % de CO₂
en moins, une par marque (`src/lib/off/`). Réponses mises en cache une journée.

Choisir une alternative rapporte **+5 pousses, 3 fois par jour au plus** (`record_swap`, migration
`0008_scanner.sql`), et compte comme un jour actif pour la série. Aucun CO₂ évité n'est compté : on ne sait
pas ce que la personne aurait acheté sinon. Les deux fiches sont relues par le serveur de l'application avant
l'appel ; un utilisateur qui appellerait directement `record_swap` avec de fausses notes resterait limité à
15 pousses par jour. Seul l'alimentaire est couvert. La caméra demande une page en HTTPS (ou localhost).
Optionnel : `OFF_CONTACT` (e-mail de contact transmis à Open Food Facts dans l'en-tête User-Agent).

## Bonnes nouvelles des médias

Le fil intercale une bonne nouvelle écologique toutes les 2 publications. Elles viennent des flux RSS de
vrais médias (Vert, Novethic, Kaizen, Socialter, La Relève et La Peste), listés dans
`src/lib/news/index.ts`. Chaque flux est relu au plus une fois par jour et la sélection change chaque jour
(heure de Paris). Seuls les articles de moins de 10 jours avec une note positive sont gardés (mots qui
signalent une avancée, titre sans mot négatif : `src/lib/news/rss.ts`), au plus 2 par média. On affiche le
titre, un court extrait et un lien vers l'article d'origine. Un média injoignable est simplement ignoré.
`/api/news` renvoie la sélection du jour en JSON.

## Appli installable et rappels

Pousse s'installe sur l'écran d'accueil (manifeste `src/app/manifest.ts`, icônes dans `public/`,
service worker `public/sw.js` avec une page hors ligne). Sur Android et ordinateur, un bandeau propose
« Installer » ; sur iPhone, il indique le geste Safari (Partager → Sur l'écran d'accueil).

Rappel du soir (Web Push, à activer dans le profil) : vers 18 h, `/api/cron/rappels` relance les personnes
abonnées qui n'ont encore rien fait dans la journée, au plus une fois par jour. La notification part
**vide** (signature VAPID faite avec `node:crypto`, sans dépendance) : à l'arrivée, le téléphone lit le
texte sur `/api/rappel` avec sa propre session (« Ta série de 4 jours s'arrête ce soir »). Pas besoin de
clé secrète Supabase : la base vérifie elle-même `CRON_SECRET`, dont seule l'empreinte SHA-256 est
stockée (table `cron_keys`). Variables : `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (publique, dans
`.env.production`), `VAPID_PRIVATE_KEY` et `CRON_SECRET` (dans Vercel). Nouvelle paire de clés :
`node src/lib/push/vapid.ts`.

## Installation

Prérequis : Node 22.18 ou plus récent, un compte Supabase (région UE).

1. **Créer le projet Supabase** (région Europe, ex. Paris ou Francfort).
2. **Appliquer les migrations** dans l'ordre, depuis l'éditeur SQL de Supabase ou avec la CLI
   (`supabase db push`) :
   `0001_schema.sql`, `0002_functions.sql`, `0003_policies.sql`, `0004_seed.sql`, `0005_engagement.sql`, `0006_points.sql`, `0007_pousses.sql`, `0008_scanner.sql`, `0009_equilibrage.sql`.
   Le dernier crée une entreprise de démonstration, code **DEMO-2026**, avec 6 équipes.
3. **Réglages d'authentification** (Authentication > URL Configuration) :
   - Site URL : `http://localhost:3000` en local, puis l'URL Vercel ;
   - Redirect URLs : ajouter `http://localhost:3000/auth/callback` et `https://<ton-domaine>/auth/callback`.
   - Pour un vrai pilote, configurer un serveur SMTP (Authentication > SMTP) : l'envoi par défaut de
     Supabase est limité à quelques e-mails par heure.
4. **Variables d'environnement** : copier `.env.example` en `.env.local` et remplir l'URL et la clé
   `anon` (Project Settings > API).
5. **Lancer** :
   ```bash
   npm install
   npm run dev
   ```
   Ouvrir http://localhost:3000, cliquer sur « Rejoindre », code `DEMO-2026`.

### Connexion par e-mail

`/rejoindre` (première fois : code entreprise + e-mail) et `/connexion` (compte existant : e-mail seul)
envoient un e-mail de connexion. Pour que cet e-mail contienne aussi un **code à 6 chiffres**, plus fiable sur
téléphone que le lien :
1. configurer un SMTP (Authentication > Emails > SMTP Settings : Brevo, Resend…), ce qui débloque aussi la
   limite de quelques e-mails par heure ;
2. dans le modèle « Magic link or OTP » (et « Confirm sign up »), ajouter `{{ .Token }}` ;
3. mettre `NEXT_PUBLIC_LOGIN_CODE=1` dans `.env.production` (ou dans Vercel) et redéployer.

Le code de l'entreprise de démo du seed (`DEMO-2026`) est public : en production, le remplacer par un code
secret (`update companies set join_code = '…'`) et créer les vraies entreprises avec leur `email_domain`.

### Déployer sur Vercel

Importer le dépôt, ajouter les variables de `.env.example` (dont `SUPABASE_SERVICE_ROLE_KEY` et
`CRON_SECRET` pour la purge des photos), mettre `NEXT_PUBLIC_SITE_URL` à l'URL Vercel, et ajouter
`https://<ton-domaine>/auth/callback` aux Redirect URLs de Supabase.

`vercel.json` programme chaque nuit la suppression des photos de plus de 90 jours
(`/api/cron/purge-photos`), comme promis aux salariés.

### Ajouter une entreprise pilote

Dans l'éditeur SQL de Supabase :

```sql
with c as (
  insert into companies (name, join_code, email_domain)
  values ('Nom de l''entreprise', 'ACME-2026', 'acme.fr')   -- email_domain : null pour tout domaine
  returning id
)
insert into teams (company_id, name)
select c.id, t from c, unnest(array['Data', 'Produit', 'Finance']) as t;
```

## Tests

```bash
npm test                 # calcul du bilan, gains des défis, éligibilité, plan d'action
```

La base se teste sur un PostgreSQL 16 local (sans Supabase), avec une imitation minimale de
l'authentification et du stockage. Le scénario se joue sur une base neuve :

```bash
createdb pousse_test
# migrations jusqu'à 0013, puis les scénarios qui les testent
for f in supabase/tests/supabase_stub.sql $(ls supabase/migrations/*.sql | awk -F/ '$3 < "0014"'); do psql -d pousse_test -v ON_ERROR_STOP=1 -f "$f"; done
psql -d pousse_test -f supabase/tests/scenario.sql
psql -d pousse_test -f supabase/tests/scenario_engagement.sql
psql -d pousse_test -f supabase/tests/scenario_rappels.sql
psql -d pousse_test -f supabase/tests/scenario_jeu.sql
psql -d pousse_test -f supabase/tests/scenario_actions.sql
psql -d pousse_test -f supabase/tests/scenario_qg.sql
# puis le quiz quotidien (0014 et 0015) et son scénario
for f in $(ls supabase/migrations/*.sql | awk -F/ '$3 >= "0014"'); do psql -d pousse_test -v ON_ERROR_STOP=1 -f "$f"; done
psql -d pousse_test -f supabase/tests/scenario_quiz.sql
psql -d pousse_test -f supabase/tests/scenario_duels.sql
psql -d pousse_test -f supabase/tests/scenario_nature.sql
psql -d pousse_test -f supabase/tests/scenario_coherence.sql
psql -d pousse_test -f supabase/tests/scenario_equite_points.sql
psql -d pousse_test -f supabase/tests/scenario_anti_triche.sql
```

La banque du quiz (`0015_quiz_banque.sql`) est générée : `node scripts/generate-quiz.ts > supabase/migrations/0015_quiz_banque.sql`.
Toutes les questions sont calculées depuis `src/lib/co2/factors.ts` (ADEME), avec des choix proches pour rester difficiles.

`scenario_actions.sql` (migration `0012_actions_libres.sql`) vérifie le bouton + : action enregistrée sans
preuve, CO₂ tiré du bilan (0 kg si rien n'est remplacé), plafonds du jour, action comptée dans le défi en
cours, publication avec photo par l'auteur seulement, compteur commun de l'entreprise.

`scenario_qg.sql` (migration `0013_qg_equipe.sql`) vérifie le QG : chat réservé à l'équipe, masquage après
deux signalements, vote du lundi de 9 h à 14 h, choix le plus voté, annonce unique, +30 aux contributeurs.

Le premier scénario vérifie 22 points : code d'entreprise, domaine e-mail, calculs identiques au TypeScript,
plafond partagé, refus d'une insertion directe, photo hors de son dossier, témoin qui refuse,
cloisonnement entre entreprises, classement anonyme (équipes de moins de 5 masquées).

## État de cette version

La CI GitHub (`.github/workflows/ci.yml`) vérifie à chaque commit de `v2` : installation, types Supabase
régénérés, `typecheck`, `lint`, tests unitaires, tests SQL, `build`, puis le parcours Playwright sur un
Supabase local avec l'IA simulée.

Pas encore vérifié : les appels réels à l'API Claude (aucune clé dans l'environnement de développement),
l'envoi des e-mails et le rendu sur de vrais téléphones.

## Limites connues et suites prévues

- **Bilan simplifié** : il couvre trajets, avion, repas, chauffage, vêtements et smartphone, plus une
  part commune d'environ 1 t (services publics, ordre de grandeur Nos Gestes Climat). L'électricité, les
  loisirs et les autres achats ne sont pas comptés : le total est une estimation basse, affichée comme
  telle. Étape suivante : brancher le modèle complet Nos Gestes Climat (paquet
  `@incubateur-ademe/nosgestesclimat` avec `publicodes`), en vérifiant la licence des données ecoinvent
  pour un usage commercial.
- **Habitudes déclarées** : un salarié peut modifier son bilan pour devenir éligible à plus de défis.
  Les valeurs sont bornées en base ; pour la suite, limiter la fréquence des modifications.
- **Preuve GPS / Strava** : pas encore disponible ; seules la photo et la confirmation d'un collègue existent.
- **Signalements** : enregistrés dans la table `reports`, à traiter depuis le tableau de bord Supabase.
- **Côté RH** : lancement, tableau de bord et rapport livrés en v2 ; intégrations Teams/Slack à venir.
