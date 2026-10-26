# Pousse v2 · Plan d'implémentation

Rédigé le 25/10/2026 après exploration du dépôt `pousse-pilote` (commit `3f67de5`).
Statut : **validé le 25/10/2026**, avec mes recommandations sur chaque question (voir § 6).

---

## 0. Ce que j'ai trouvé dans le dépôt

Le pilote est déjà bien avancé : la v2 est une évolution, pas une réécriture.

| Domaine | État actuel | Fichiers |
| --- | --- | --- |
| Stack | Next.js 15.5 (App Router), React 19, Tailwind 4, Supabase (auth par lien e-mail, Postgres, Storage), PWA | `package.json`, `src/app/manifest.ts`, `public/sw.js` |
| Multi-tenant | Table `companies` (pas `organizations`), colonne `company_id` partout, `my_company_id()` + RLS | `0001_schema.sql`, `0003_policies.sql` |
| Calcul CO₂ | Facteurs en dur (Impact CO₂ ADEME, relevés le 15/10/2026). Calcul **en double** : TypeScript pour l'affichage (`unitImpact`), SQL pour le calcul officiel (`unit_kg`, dernière version dans `0021`). Le navigateur n'envoie jamais de chiffre. | `src/lib/co2/factors.ts`, `challenges.ts`, `0021_defis_a_plusieurs.sql` |
| Référence du gain | Le gain = habitude déclarée dans le bilan − action. Sans habitude remplacée : 0 kg (mais les pousses restent, règle d'équité `is_habit_action`). | `challenges.ts`, `0024_equite_points.sql` |
| Bouton + | `log_action(template, variant, receipt)` : une unité par appel, quantité **fixée par le bilan** (ex. km du trajet déclaré). Raccourcis favoris, pop-up `ActionDone` (CO₂, pousses, série, défi, duel). | `src/app/(app)/agir/*`, `0025_anti_triche.sql` |
| Anti-triche | Plafonds jour (`cap_group`) et semaine calés sur le bilan (`weekly_cap`), bilan verrouillé 30 jours, défis non modifiables, « Garder le cap » retiré, reçu obligatoire (`requires_receipt`) pour train, vacances en train, réparation, achats via appli | `0025_anti_triche.sql`, `0021` |
| Justificatifs | Photo dans le bucket `proofs`, colonne `receipt_path`, **aucune vérification** (seule la présence est contrôlée). Purge à 90 jours. | `api/cron/purge-photos` |
| QG d'équipe | Chat (`team_messages`, `user_id null` = message de Pousse), signalements, vote du lundi 9 h–14 h (`team_weeks`, `team_week_votes`), propositions, classement anonymisé (équipes < 5 masquées) | `0013_qg_equipe.sql`, `equipes/*` |
| S'informer | Fiches gestes et recettes en TypeScript (chiffres tirés de `factors.ts`), bonnes nouvelles RSS, scanner Open Food Facts (Green-Score, CO₂ Agribalyse, alternatives) | `src/lib/informer.ts`, `src/lib/news`, `src/lib/off` |
| Quiz | Banque statique générée depuis `factors.ts` (`0015_quiz_banque.sql`), quiz du jour | `scripts/generate-quiz.ts` |
| Design system | Tokens « Jardin clair » dans `@theme` (sapin, sauge, argile, pêche…), utilitaires `btn-primary`, `card`, `chip`, `input`, animations `pousse-*`, `Mascot`, `Confetti` | `src/app/globals.css`, `src/components/` |
| Tests | 34 tests `node --test` (calcul, OFF, news, push, jeu), 16 scénarios SQL sur PostgreSQL 16 local | `src/lib/**/*.test.ts`, `supabase/tests/` |
| Outillage absent | Pas d'ESLint, pas de zod, pas de SDK Anthropic, pas de Playwright, pas de types Supabase générés, pas de rôle admin | |

**Écarts avec les décisions produit déjà prises :**

1. **Publication automatique dans le fil.** `0022_fil_auto.sql` passe chaque action en `visibility = 'company'` si `share_feed` est actif (activé par défaut). C'est contraire à « la publication est toujours proposée, jamais automatique ». Je propose de supprimer ce déclencheur (Phase 2).
2. **Purge des justificatifs à 90 jours** au lieu de « après vérification ou 30 jours ».
3. **`npm run typecheck` échoue** aujourd'hui (5 erreurs dans `src/middleware.ts`), et il n'existe pas de script `lint`. Je ne peux pas encore confirmer que `npm run build` passe : l'installation des dépendances est en cours dans mon environnement (le registre npm y est lent). Je le vérifierai en tout début de Phase 1.

---

## 1. Principes d'architecture

### 1.1 Le calcul carbone (règle d'or)

```
Phrase libre ──► LLM (Haiku) ──► { action_slug, quantity, unit, confidence }[]   ← validé par zod
                                         │
                                carte de confirmation (l'utilisateur corrige)
                                         │
                       server action ──► rpc log_action(slug, quantity, receipt)
                                         │
                 Postgres : facteur (emission_factors) × quantité, règle de référence,
                 plafonds, pousses ──► validations
```

- **Le LLM ne choisit pas un facteur brut, il choisit une action du catalogue.** Un gain évité met en jeu deux facteurs (ce qu'on a fait et ce qu'on aurait fait). Si le LLM choisissait directement un `factor_id`, il choisirait aussi implicitement la référence. Je propose donc que chaque action du catalogue (`action_types`) déclare en dur son facteur « réalisé », son facteur de référence et sa règle de plafond, et que le LLM ne renvoie qu'un `action_slug` pris dans une liste fermée (enum du schéma). C'est ce que la règle d'or demande sur le fond ; c'est un écart de forme avec `{ factor_id, … }`, d'où la question Q2.
- **Une seule source de vérité pour les facteurs** : la table `emission_factors` versionnée. Le SQL officiel (`unit_kg`) la lit. Côté TypeScript, `lib/co2/engine.ts` est une fonction pure qui prend les facteurs en paramètre (tests unitaires, aperçus à l'écran). Un test de parité joue les mêmes cas des deux côtés (comme aujourd'hui, mais sur des valeurs lues depuis le seed et non recopiées à la main).
- **Le calcul officiel reste dans la base.** Le navigateur et la server action n'envoient qu'un slug et une quantité ; la base recalcule et plafonne. C'est le point fort du pilote, je le garde.
- **Arrondis** : kg arrondis à 3 décimales en base, affichage à 1 décimale sous 10 kg (fonction `formatKg` existante).
- **Confiance** : sous un seuil (`confidence < 0.7`, à valider), ou si zod rejette la sortie, ou si l'action n'est pas dans le catalogue, l'UI affiche un choix entre 2 ou 3 actions candidates et un formulaire manuel. Jamais d'enregistrement sans clic de confirmation.

### 1.2 Le module `lib/ai/`

```
src/lib/ai/
  client.ts        SDK @anthropic-ai/sdk, import "server-only", timeout, 1 retry
  models.ts        MODELS = { fast: "claude-haiku-5-5", writer: "claude-sonnet-5-5" } + prix par MTok
  structured.ts    callStructured({ task, model, prompt, schema }) : sortie JSON + validation zod
  stream.ts        streaming pour les textes longs (rapport mensuel, coach)
  log.ts           insertion dans ai_calls (tokens, latence, coût estimé, statut, version du prompt)
  rate-limit.ts    quotas par utilisateur et par organisation (table ai_quota, fonction SQL atomique)
  cache.ts         cache des appels répétables (hash entrée + version du prompt, table ai_cache)
  redact.ts        nettoyage des entrées (e-mails, téléphones, noms) avant envoi
  prompts/         un fichier par tâche, exporte { id, version, system, build(input) }
  schemas/         schémas zod par tâche (+ conversion en JSON Schema pour l'API)
```

Vérifications faites dans la doc officielle Anthropic :

- Identifiants confirmés : `claude-haiku-5-5` (classification, extraction ; 0,10 $ / 0,50 $ par MTok sous 100 k tokens d'entrée) et `claude-sonnet-5-5` (2 $ / 10 $ par MTok). Les deux acceptent texte et images.
- **Sorties structurées** : `output_config.format = { type: "json_schema", schema }`, sans en-tête bêta, compatibles Haiku 5.5 et Sonnet 5.5. Je les préfère au « tool use forcé », qui **renvoie une erreur sur Sonnet 5.5**. Pour Haiku, j'utiliserai la même mécanique (une sortie structurée est l'équivalent d'un appel d'outil forcé, en plus simple). Le JSON Schema côté API n'accepte pas `minimum`/`maximum`/`minLength` : ces bornes sont contrôlées par zod après coup.
- `temperature`, `top_p` et `top_k` provoquent une erreur 400 sur Sonnet 5.5 : on ne les passe pas. La réflexion adaptative se règle avec `effort` (bas pour le parsing).
- Je vérifierai la signature exacte du SDK TypeScript (version installée) au moment du code : la page consultée ne montrait pas l'exemple TypeScript.

Sources : [Claude Haiku 5.5](https://platform.claude.com/docs/en/models/haiku-5-5/overview), [Claude Sonnet 5.5](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).

**Garde-fous** : clé `ANTHROPIC_API_KEY` lue uniquement dans `client.ts` (`server-only`), timeout 8 s (parsing) / 30 s (rédaction), repli non-IA systématique (formulaire manuel, raccourcis, messages fixes de l'animateur), quotas (proposition : 30 parsings par jour et par salarié, 2 000 appels par jour et par organisation, à ajuster), aucune donnée nominative dans les prompts (les prénoms sont réinjectés par le code après génération, via des marqueurs `{{membre_1}}`).

### 1.3 Multi-tenant et confidentialité

- Toutes les nouvelles tables portent la clé d'organisation et ont RLS activée dès leur création.
- Rôle admin : table `organization_admins (company_id, user_id)` plutôt qu'une colonne dans `profiles`, pour qu'un admin RSE puisse ne pas être salarié participant.
- L'admin ne lit **aucune table brute** : uniquement des RPC `security definer` (`admin_dashboard`, `admin_report_data`, `admin_mobility_csv`) qui agrègent et renvoient `null` pour tout groupe de moins de 5 personnes. Tests SQL dédiés : un admin qui tente un `select` sur `validations` reçoit 0 ligne.

---

## 2. Phases de livraison

Chaque phase se termine avec `typecheck`, `lint`, `npm test` et les scénarios SQL au vert. Un commit par fonctionnalité, branche `v2`.

### Phase 0 · Outillage (préalable, ½ jour)

- Corriger les 5 erreurs de type de `middleware.ts`, vérifier `npm run build`.
- Ajouter ESLint 9 (config Next, `eslint.config.mjs`, script `lint` ; `next lint` est déprécié), zod, `@anthropic-ai/sdk`, `server-only`, Playwright.
- Script `test:sql` qui rejoue migrations + scénarios sur un PostgreSQL 16 local (aujourd'hui décrit à la main dans le README).
- Types Supabase générés dans `src/lib/supabase/database.types.ts` (voir Q8).

Commits : `chore: eslint + script lint`, `fix(types): middleware Supabase`, `chore: script test:sql`, `chore: types Supabase générés`.

### Phase 1 · Socle carbone et IA

**Migration `0026_emission_factors.sql`**
- `emission_factors (id, slug unique, label, category, unit, kgco2e_per_unit, source check in ('base_empreinte','agribalyse','nos_gestes_climat'), source_ref, version, valid_from, todo text)`. Lecture publique, aucune écriture hors migration.
- Seed des facteurs aujourd'hui dans `factors.ts`, chacun re-vérifié contre la source au moment du seed. Les facteurs repris d'Impact CO₂ seront rattachés à leur source d'origine (Base Empreinte ou Agribalyse) avec l'identifiant exact quand je le trouve ; sinon `todo` explicite (voir § 4).
- `action_types (slug, label, theme, unit, factor_done, factor_reference, reference_rule, quantity_min, quantity_max, cap_group, requires_receipt, points_per_unit, active)` : reprend `challenge_templates` et ses variantes, avec un lien explicite vers les facteurs.
- `unit_kg` réécrite pour lire `emission_factors` ; résultats identiques à l'actuelle (test de non-régression sur les cas existants).

**Migration `0027_ai_calls.sql`**
- `ai_calls (id, company_id, user_id null, task, prompt_id, prompt_version, model, input_tokens, output_tokens, cache_read_tokens, latency_ms, cost_usd_estimate, status, error_code, created_at)`. Aucune entrée ni sortie brute stockée. Lecture : personne côté app (service role seulement), agrégat par organisation pour l'admin plus tard.
- `ai_quota` (compteurs par jour, utilisateur et organisation) et `ai_cache` (clé de hash, sortie JSON, expiration).

**Code**
- `src/lib/co2/engine.ts` : `computeAvoided({ action, quantity, habits, factors })` → `{ kg, formula, capped, reason }`. Règles de référence codées en dur (`reference-rules.ts`).
- Tests : cas nominaux par action, quantité nulle ou négative, plafonds jour et semaine, conversions d'unités (km/m, repas, L), arrondis, facteur manquant (erreur explicite), parité TS/SQL.
- `src/lib/ai/*` complet avec tests sur réponses mockées (JSON valide, invalide, tronqué, refus, timeout, quota dépassé).

Commits : `feat(co2): table emission_factors et seed sourcé`, `feat(co2): catalogue action_types relié aux facteurs`, `refactor(co2): unit_kg lit emission_factors`, `feat(co2): moteur de calcul TS et tests`, `feat(ai): module lib/ai et journal ai_calls`, `feat(ai): quotas et cache`.

### Phase 2 · Enregistrement en langage naturel (le +)

- Migration `0028_log_action_quantite.sql` : `log_action(p_action text, p_quantity numeric, p_receipt text)`, quantité bornée par `action_types` et par le bilan (ex. trajet vélo ≤ km domicile-travail déclarés, voir Q3), ancienne signature conservée pour les raccourcis. Suppression du déclencheur `validations_share_to_feed`.
- `src/app/(app)/agir/` : champ texte + micro (Web Speech API `fr-FR` si disponible, sinon champ seul), raccourcis existants à côté, cartes de confirmation éditables (action, quantité), écran de choix si confiance faible, formulaire manuel en repli. Interface optimiste : la pop-up s'ouvre avec les chiffres de l'aperçu, puis se met à jour avec ceux de la base.
- Server action `parseActionText` : Haiku, prompt `parse-action@v1`, cache, quota, journal.
- Pop-up `ActionDone` réutilisée ; proposition de publication explicite (avec photo optionnelle) ; encouragement « continue comme ça » sur les séries.
- Actions à justificatif : la carte bascule sur l'envoi de photo (Phase 4 branche la vérification).
- Test e2e Playwright : saisir « vélo jusqu'au bureau, 8 km » (réponse IA mockée côté serveur via une variable `AI_MOCK=1`), confirmer, voir la célébration, publier, retrouver la publication dans le fil.

Commits : `feat(agir): log_action avec quantité`, `fix(fil): plus de publication automatique`, `feat(ai): parsing des actions en langage naturel`, `feat(agir): saisie libre et dictée`, `feat(agir): carte de confirmation et choix`, `test(e2e): parcours action → fil`.

### Phase 3 · Mon plan adaptatif

- Migration `0029_plan.sql` : `user_plans (user_id, company_id, week_start, items jsonb, generated_by, prompt_version)` ; `challenges` = catalogue existant (`challenge_templates` + variantes), chaque défi doit avoir une action reliée à un facteur (contrainte `not null`).
- Plan initial **déterministe** : tri par potentiel CO₂ pour la personne (fonction existante `weekly_potential_kg`) puis faisabilité déclarée. Le LLM (Sonnet, `plan-coach@v1`) ne fait que choisir 3 à 5 défis dans la liste candidate (ids en enum) et écrire la phrase « pourquoi toi ». Si l'IA échoue : plan déterministe avec des phrases modèles.
- Job hebdomadaire `/api/cron/plan` (lundi tôt) : actions de la semaine passée (agrégées : compteurs par action, défis abandonnés), recalcul, nouvelle formulation. Batch API envisageable (−50 %) car rien d'urgent.
- Page `/defis` (« Mon plan ») réorganisée autour du plan de la semaine.

Commits : `feat(plan): plan initial déterministe`, `feat(ai): coach de plan`, `feat(cron): recalcul hebdomadaire du plan`, `feat(plan): page Mon plan`.

### Phase 4 · Vérification des justificatifs

- Migration `0030_justificatifs.sql` : `proof_checks (validation_id, company_id, verdict check in ('accepted','needs_review','rejected'), reason_code, checked_at, model, prompt_version)`. Aucune donnée extraite stockée (pas de nom, pas de numéro de billet, pas de date exacte).
- Vision Haiku, `proof-check@v1` par type (billet de train daté de moins de 7 jours, réservation de vacances en train, facture de réparation). Le prompt interdit de recopier toute donnée personnelle ; la sortie zod ne contient que `{ verdict, reason_code, confidence }`.
- `rejected` : action annulée (CO₂ et pousses retirés, message bienveillant). `needs_review` : pousses en attente ; relecture par qui ? (Q6).
- Photo supprimée du bucket dès le verdict `accepted`/`rejected`, et au bout de 30 jours dans tous les cas (cron `purge-photos` modifié). Images compressées côté client avant envoi (canvas, 1600 px, WebP).

Commits : `feat(preuves): table proof_checks`, `feat(ai): vérification des justificatifs par vision`, `feat(preuves): purge après verdict ou 30 jours`.

### Phase 5 · Animateur IA du QG

- Migration `0031_animateur.sql` : `team_messages.author_kind ('member','pousse','animateur')`, `animator_events (team_id, kind, day, message_id)` avec contrainte d'unicité qui garantit **au plus 1 message spontané par jour et par équipe**, en plus des messages fixes du lundi et du vendredi.
- Routes cron (`/api/cron/animateur/*`) : lundi 9 h (vote, 3 propositions tirées du catalogue d'équipe existant `team_kind`), lundi 14 h (clôture, annonce : la logique de `settle_team_week` existe déjà), mercredi (relance si l'activité baisse, seuil calculé en SQL), vendredi (résumé de semaine : chiffres calculés par le code, texte par Sonnet, prénoms réinjectés uniquement pour les personnes ayant publié dans le fil), réactions (séries et paliers d'équipe, déclenchées par `tick`), météo (Open-Meteo, gratuit, sans clé, pour Paris ou la ville de l'organisation).
- Le LLM reçoit des agrégats d'équipe anonymes, jamais le contenu du chat. Repli : gabarits de messages écrits à la main.
- UI : bulle de l'animateur avec la mascotte et la mention « bot ».

Commits : `feat(qg): auteur animateur et limite de fréquence`, `feat(ai): messages de l'animateur`, `feat(cron): planning de l'animateur`, `feat(qg): météo du lendemain`, `feat(qg): bulle animateur`.

### Phase 6 · Scanner amélioré et quiz générés

- Scanner : le code-barres Open Food Facts reste le chemin principal. Sinon, photo → Haiku vision → catégorie choisie dans une **liste fermée de catégories Agribalyse** présentes en base (pas de valeur inventée) → score par catégorie, impact estimé (mention « estimation par catégorie »), 2 ou 3 alternatives de la même famille. Migration `0032_scanner_categories.sql` (`food_categories` reliées à `emission_factors`).
- Quiz : job hebdo, Sonnet génère des questions à partir des fiches et des bonnes nouvelles de la semaine, chaque question porte la phrase source ; une seconde passe (Haiku) vérifie que la réponse est justifiée par la source, sinon rejet. Pousses plafonnées (réutilise `answer_quiz` et son plafond). Migration `0033_quiz_generes.sql`.

Commits : `feat(scanner): identification par photo`, `feat(quiz): génération hebdomadaire`, `feat(quiz): relecture automatique`.

### Phase 7 · Admin RSE

- Onboarding self-serve `/admin/lancer` : création de l'organisation, code ou lien d'invitation, domaine e-mail, équipes, consentement et mentions IA. Migration `0034_admin.sql` (`organization_admins`, `invitations`, RPC `create_organization`).
- Tableau de bord `/admin` : participation, CO₂ évité cumulé et par poste (mobilité, alimentation, consommation, énergie), tendances hebdo, classement des équipes ; RPC agrégées, seuil de 5.
- Rapport mensuel : Sonnet en streaming à partir de `admin_report_data` (agrégats + verbatims de messages publics anonymisés et filtrés), export PDF (rendu serveur) et CSV mobilité domicile-travail agrégée.

Commits : `feat(admin): création d'organisation et invitations`, `feat(admin): tableau de bord agrégé`, `feat(admin): rapport mensuel`, `feat(admin): exports PDF et CSV`.

### Transverse

- Seed de démo `supabase/seed_demo.sql` (hors migrations) : une organisation fictive, 3 équipes, 30 utilisateurs, 4 semaines d'actions, généré par un script déterministe (`scripts/seed-demo.ts`).
- RGPD : consentement explicite IA à l'onboarding (nouvelle case), page `/confidentialite` mise à jour, suppression de compte qui purge aussi `ai_calls.user_id`, `proof_checks` et les fichiers.
- Accessibilité : `aria-label` sur tous les boutons icône (déjà largement fait), focus visibles, contraste AA vérifié sur les nouveaux composants.

---

## 3. Risques

| Risque | Impact | Parade |
| --- | --- | --- |
| Refonte du calcul (`unit_kg` sur table) qui change des chiffres déjà affichés | Perte de confiance | Test de non-régression qui rejoue tous les cas actuels ; versionner les facteurs plutôt que les écraser |
| Facteurs introuvables dans les sources officielles avec un identifiant précis | Valeurs non traçables | `todo` explicite dans le seed, action désactivée tant que le facteur manque |
| Planification Vercel imprécise | Vote du lundi ouvert en retard | Voir Q7 (pg_cron ou Vercel Pro) ; idempotence des jobs |
| Coût et sobriété | Facture, cohérence du discours climat | Haiku par défaut, cache, Batch API pour les jobs hebdo, pas d'appel quand un raccourci suffit, journal des coûts |
| Fuite de données personnelles vers le LLM | RGPD, confiance | `redact.ts`, agrégats seulement, prénoms réinjectés après coup, tests sur les prompts construits |
| Tests e2e dépendants de Supabase | CI fragile | Supabase local via Docker (CLI) ou base de test dédiée, IA mockée |
| Taille du chantier | Délais | Phases indépendantes, chaque phase livrable seule |

---

## 4. Facteurs d'émission : ce qui est sourcé et ce qui ne l'est pas encore

Repris du pilote (Impact CO₂, ADEME, relevé le 15/10/2026), à rattacher à leur base d'origine au moment du seed :
voiture thermique, voiture électrique, covoiturage, métro, RER, tram, bus thermique, vélo électrique, TGV, avion court et moyen/long-courrier (transport) ; repas bœuf, veau, porc, poulet, saumon, végétarien, végétalien (Agribalyse 3.2) ; eau en bouteille ; vêtements (6 articles) ; smartphone, ordinateur portable, télévision ; chauffage par m² et par an (9 modes).

Déjà identifiés comme **non sourcés ou approximatifs** (je ne les inventerai pas) :
- `SHARED_SERVICES_KG_YEAR = 1000` : « environ 1 tonne », ordre de grandeur Nos Gestes Climat, pas une valeur exacte.
- `HEATING_SAVING_PER_DEGREE = 7 %` : cité « ADEME » sans référence précise.
- `HEATING_WEEKS_PER_YEAR = 30` et `WORK_WEEKS_PER_YEAR = 45` : hypothèses de calcul, pas des facteurs.
- `LONG_FLIGHT_KM_ROUND_TRIP` et `HOLIDAY_TRAIN_KM = 2000` : hypothèses de distance.
- Moyenne « porc, poulet, poisson » et moyenne « métro/RER » : moyennes simples non pondérées.
- Catégories Agribalyse pour le scanner par photo : à constituer.

Je validerai chaque ligne contre la source en Phase 1 et je te donnerai la liste finale des `TODO`.

---

## 5. Questions ouvertes (à trancher avant de coder)

**Calcul carbone**

- **Q1. Quelle référence pour le gain évité ?** Aujourd'hui : l'habitude déclarée dans le bilan (vélo pour quelqu'un qui vient déjà en métro = 0 kg). Ta consigne cite « la voiture thermique moyenne pour un trajet fait à vélo ». Les deux sont défendables : la référence personnelle est plus stricte et plus crédible pour un rapport RSE ; la référence moyenne gonfle les chiffres pour les personnes déjà sobres. **Ma recommandation : garder la référence personnelle** (règles codées en dur et testées), la référence moyenne servant seulement quand le bilan n'est pas fait. Tu valides ?
- **Q2. Sortie du LLM : `action_slug` (catalogue) plutôt que `factor_id` brut ?** (voir § 1.1). Ma recommandation : oui.
- **Q3. Quantités libres et plafonds.** Si quelqu'un écrit « vélo, 25 km » alors que son trajet déclaré fait 8 km : on plafonne à 8 km (trajet domicile-travail) ? Et un trajet vélo hors domicile-travail (courses, loisirs) compte-t-il, avec quelle référence ? Ma recommandation : au lancement, seuls les trajets domicile-travail comptent du CO₂, plafonnés aux km déclarés ; les autres trajets rapportent des pousses (règle d'équité) mais 0 kg.
- **Q4. Seuil de confiance** pour demander une confirmation : 0,7 te convient ?

**Données et confidentialité**

- **Q5. `companies` ou `organizations` ?** Renommer la table et la colonne `company_id` touche 25 migrations, une centaine de fonctions SQL et le code. Ma recommandation : garder `companies.id` / `company_id` en base (l'exigence « chaque table porte la clé d'organisation » est remplie) et parler d'organisation dans l'UI admin. Tu valides, ou tu veux le renommage ?
- **Q6. Justificatifs `needs_review` :** qui relit ? L'admin RSE verrait alors une donnée individuelle (une photo de billet), ce qui va contre « jamais d'action individuelle ». Options : (a) pas de relecture humaine, l'action reste comptée sans les pousses bonus ; (b) l'utilisateur renvoie une autre photo ; (c) relecture par l'équipe Pousse. Ma recommandation : (b) puis (a).
- **Q7. Hébergement des tâches planifiées.** Sur le plan Hobby, Vercel limite les crons à un déclenchement par jour avec une heure imprécise, ce qui ne tient pas le lundi 9 h / 14 h. Tu es sur quel plan Vercel ? Sinon je propose `pg_cron` + `pg_net` dans Supabase pour appeler les routes à l'heure exacte (heure de Paris, changements d'heure gérés).
- **Q8. Types Supabase générés :** j'ai besoin soit de l'identifiant du projet Supabase et d'un jeton d'accès (`supabase gen types --project-id`), soit de générer depuis une base locale rejouée à partir des migrations. Ma recommandation : la base locale (aucun secret à partager).
- **Q9. Clé API :** as-tu déjà une clé `ANTHROPIC_API_KEY` pour Pousse ? Je n'en ai pas besoin pour coder (tout est testé avec des réponses mockées), seulement pour l'essai réel.
- **Q10. Photos du fil** (publiques, distinctes des justificatifs) : on garde la purge à 90 jours ?

**Périmètre**

- **Q11.** Le bilan reste le questionnaire maison en 14 questions, ou tu veux brancher Nos Gestes Climat dès la v2 ? (Le README signale une vérification de licence ecoinvent à faire pour un usage commercial.) Ma recommandation : garder le questionnaire maison pour la v2.
- **Q12.** Branche et livraison : je travaille sur une branche `v2` et je te propose une PR par phase. Je peux pousser cette branche sur GitHub (le dépôt est public) ?

---

## 6. Décisions retenues (25/10/2026)

Gabriel a validé le plan en retenant mes recommandations :

| Question | Décision |
| --- | --- |
| Q1 Référence du gain | Référence personnelle : l'habitude déclarée dans le bilan. Règles codées en dur (`reference_rules` dans `supabase/data/action_types.json`, `unit_kg`/`avoided_kg` en base), testées. |
| Q2 Sortie du LLM | `{ action, quantity, unit, confidence }` où `action` est un slug du catalogue `action_types` (liste fermée). |
| Q3 Quantités | Trajets domicile-travail plafonnés aux km déclarés ; les autres trajets ne sont pas dans le catalogue (pousses via les petits gestes, 0 kg). |
| Q4 Confiance | Confirmation par une UI de choix sous 0,7. |
| Q5 Nom de l'organisation | `companies` / `company_id` gardés en base ; « organisation » dans l'UI admin. |
| Q6 Justificatif douteux | La personne renvoie une autre photo ; sinon l'action reste comptée sans les pousses. |
| Q7 Tâches planifiées | Déjà en place : `pg_cron` + `pg_net` dans Supabase (migration 0019, toutes les 5 minutes). Les tâches IA s'y ajoutent. |
| Q8 Types Supabase | Générés en CI depuis une base rejouée à partir des migrations (`npm run db:types`), recommités automatiquement. |
| Q9 Clé API | Pas nécessaire pour développer : tout est testé avec des réponses simulées (`AI_MOCK=1`). |
| Q10 Photos du fil | Purge à 90 jours conservée. Justificatifs : après verdict ou 30 jours. |
| Q11 Bilan | Questionnaire maison conservé pour la v2. |
| Q12 Branche | Branche `v2` poussée sur GitHub, une PR par phase. |

**Contrainte d'environnement découverte** : le poste de développement n'accède pas au registre npm.
La CI GitHub (`.github/workflows/ci.yml`) installe les dépendances, régénère `package-lock.json` et
les types Supabase, puis lance types, lint, tests unitaires, tests SQL et build. Les tests SQL tournent
sur un PostgreSQL à date fixe (libfaketime), car les scénarios historiques sont datés.

**Numérotation réelle des migrations** : 0026 facteurs (généré), 0027 catalogue des actions (généré),
0028 calcul sur facteurs + quantités + fil non automatique, 0029 socle IA. Les suivantes décalent d'autant.

---

## 7. Avancement (25/10/2026)

Les 7 étapes de l'ordre de livraison sont codées sur la branche `v2`, une fonctionnalité par commit,
avec la CI verte (types, lint, tests unitaires, tests SQL, build, e2e Playwright).

| Étape | Livré |
| --- | --- |
| 1. Socle | `emission_factors` (39 facteurs) et `action_types` générés depuis `supabase/data/`, moteur `src/lib/co2/engine.ts`, parité TS/SQL (452 cas), `lib/ai/` (client serveur, prompts versionnés, zod, journal `ai_calls`, quotas, cache, mode simulé) |
| 2. Le + | Saisie libre et dictée, cartes de confirmation éditables, choix sous 0,7 de confiance, célébration, publication proposée |
| 3. Mon plan | Plan des règles trié par potentiel puis faisabilité, coach IA limité au catalogue, recalcul du lundi (`pg_cron`) |
| 4. Justificatifs | Vision, verdict seul gardé, photo effacée, 2 renvois possibles |
| 5. Animateur | Vote du lundi 9 h – 14 h, relance, bilan du vendredi, paliers, météo (Open-Meteo), 1 message spontané par jour et par équipe au plus |
| 6. Scanner et quiz | Code-barres puis photo → rayon Agribalyse, estimation par catégorie, 3 alternatives ; quiz de la semaine relus contre leur source, 10 pousses par semaine au plus |
| 7. Admin RSE | `/entreprise` → `/admin` : lancement (organisation, domaine, équipes, lien d'invitation), tableau de bord agrégé (k = 5), rapport mensuel en flux avec contrôle des chiffres, PDF par impression, CSV mobilité |
| Transverse | Refus de l'IA par salarié (0040, appliqué par la base), mentions IA dans la confidentialité, données de démo (`supabase/seed_demo.sql`) |

### Décisions prises en cours de route

- **Admin sans profil participant** : l'IA de l'espace RSE est journalisée au nom de l'organisation
  (`admin_ai_log`, `admin_ai_consume`, 5 rapports IA par jour et par organisation).
- **Rapport** : les chiffres clés sont mis en forme par le code ; l'IA écrit les faits marquants et les
  recommandations. Si elle cite un nombre absent des agrégats, le texte des règles est enregistré à sa place.
- **PDF** : vue d'impression du navigateur, pas de bibliothèque PDF (sobriété).
- **CSV** : `;` et virgule décimale (Excel en français), cellule vide sous 5 personnes, formules neutralisées.
- **Refus de l'IA** : saisie libre → actions proches à choisir ; plan → règles ; justificatifs non lus →
  l'action compte pour le CO₂ sans les pousses du justificatif (cohérent avec Q6). L'animateur et le
  rapport ne reçoivent que des totaux et des marqueurs de prénom, ils restent actifs.
- **Classement du rapport** : borné au mois du rapport (0041), il mêlait les mois suivants.

### Valeurs non sourcées (inchangé, à faire valider)

- Les 39 facteurs viennent d'Impact CO₂ (ADEME) ; l'identifiant exact dans la Base Empreinte ou
  Agribalyse reste à relever pour chacun (champ `todo` du JSON).
- 7 % de chauffage économisé par degré, ~1 t de services communs, 30 semaines de chauffe, 45 semaines
  travaillées, 12 000 km pour un long-courrier aller-retour, 2 000 km pour des vacances en train,
  moyennes non pondérées « porc/poulet/poisson » et « métro/RER ».

### Décisions du 25/10/2026 (soir)

1. Défis d'équipe quiz, bravos et scanner : **gardés** dans le vote du lundi, avec des pousses seulement
   (exception assumée à « chaque défi est quantifiable en CO₂ »).
2. Mention du sous-traitant IA dans la Confidentialité : **à rédiger par Gabriel** (responsable de traitement),
   à partir des engagements publiés par Anthropic.
3. Météo de l'animateur : **Paris pour toutes les organisations**, pas de ville par organisation.
4. `pousse-pilote.vercel.app` : **confirmé** comme domaine de production.

---

## 8. Pousse sans IA (26/10/2026)

Décision de Gabriel : l'application n'utilise pas d'IA (coût de l'API). Tout ce qui en dépendait est
retiré du code et de la base (migration `0042_sans_ia.sql`) ; chaque fonctionnalité garde une version
par règles :

| Fonctionnalité | Sans IA |
| --- | --- |
| Le + en saisie libre | Règles (mots-clés et quantité), y compris plusieurs gestes dans une phrase ; sinon, actions proches à choisir |
| Mon plan | Classement par règles (potentiel CO₂, faisabilité, semaine écoulée), calculé à la première visite de la semaine |
| Justificatifs | Toujours demandés (train, vacances en train, réparation, applis) ; privés, effacés à 30 jours, sans vérification |
| Scanner | Code-barres, ou choix du rayon (au lieu de la photo) |
| Animateur du QG | Messages préparés, mêmes rendez-vous et mêmes limites |
| Quiz | Quiz du jour seulement (banque générée depuis les facteurs ADEME) ; quiz de la semaine retiré |
| Rapport mensuel | Faits marquants et recommandations écrits par des règles à partir des agrégats |

Retirés : `src/lib/ai`, le SDK Anthropic, `ANTHROPIC_API_KEY` / `AI_MOCK`, les tables `ai_calls`, `ai_quota`,
`ai_cache`, `proof_checks`, `quiz_week_*`, `monthly_reports`, la colonne `consent_ai`, les tâches `pousse-plan`
et `pousse-quiz`. Les migrations 0029 – 0040 restent dans l'historique (déjà appliquées en production).

Point à trancher plus tard : sans vérification, le justificatif dissuade mais ne prouve rien ; le garder
(collecte d'une photo privée) ou le retirer est un choix produit et RGPD.
