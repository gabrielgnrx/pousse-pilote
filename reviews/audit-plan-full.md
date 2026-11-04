# Audit complet : la version jeu de Pousse (l'île)

**Date** : 1er novembre 2026
**Mode** : Branche comparée à sa base (`jeu/ile-3d` → `design/la-tige`, PR #6)
**Source** : 22 fichiers, +1 808 / −26 lignes (`supabase/migrations/0047_ile.sql`, `src/components/island/*`, `src/lib/game/island.ts`, `src/app/(app)/ile/*`, accueil `fil/page.tsx`, en-tête, navigation, liens de connexion)
**Angles d'analyse menés** : 10/10 (le lens « Backend » est appliqué à Supabase et aux actions serveur : le projet n'a pas de Rust/Tauri)
**Angles ignorés** : aucun

---

## Verdict global : APPROUVÉ AVEC CHANGEMENTS

Le socle est sain : la base contrôle chaque plantation (aucune graine sans action réelle, verrou contre les doubles clics, lecture limitée à l'entreprise). La logique est testée côté SQL et TypeScript, et l'île 2D tourne sans bibliothèque. Avant de fusionner, quatre points méritent d'être corrigés :
- une même action peut donner **deux graines** (les « bonnes habitudes ») ;
- le **retour après une action** ramène sur la page du + ;
- les **animations tournent en continu** sur l'accueil, même quand l'île n'est plus à l'écran ;
- on **ne peut pas aller voir l'île d'un collègue** depuis l'appli.

Rien n'est bloquant pour un test interne.

## Verdict par angle

| # | Angle | Verdict | Critiques | Recommandations |
|---|-------|---------|-----------|-----------------|
| 1 | Design | Approuvé avec changements | 0 | 4 |
| 2 | Expérience (UX) | Approuvé avec changements | 1 | 6 |
| 3 | Frontend | Approuvé avec changements | 0 | 5 |
| 4 | Backend (Supabase, actions serveur) | Approuvé avec changements | 1 | 4 |
| 5 | Structure | Approuvé avec changements | 0 | 3 |
| 6 | Tenue du dépôt | Approuvé avec changements | 0 | 4 |
| 7 | Prêt pour la production | Approuvé avec changements | 0 | 4 |
| 8 | Confort de développement | Approuvé | 0 | 2 |
| 9 | Performance | Approuvé avec changements | 1 | 3 |
| 10 | Accessibilité | Approuvé avec changements | 0 | 4 |

## Points critiques (à corriger avant de fusionner)

| # | Problème | Angle(s) | Fichier(s) | Impact | Correction |
|---|----------|----------|------------|--------|------------|
| C1 | **Une action d'habitude donne deux graines.** Un trajet à vélo fait par quelqu'un qui roule déjà (0 kg, `is_habit_action`) compte à la fois dans `transport` (bouleau) et dans `cap` (cactus) de `garden()`. Même chose pour repas végé, occasion, chauffage… | Backend, UX | `0047_ile.sql` (`island_plant` lit `garden().counts`), `0025_anti_triche.sql` (`garden`) | L'économie du jeu est faussée : ceux qui ont déjà de bonnes habitudes reçoivent deux fois plus de graines, à l'inverse de la règle « une action = une graine ». | Pour les graines, exclure de `cap` les validations déjà comptées par catégorie (garder seulement `habit_checkins`). Ou calculer les graines dans une fonction dédiée `island_seed_counts()` sans toucher à `garden()`. |
| C2 | **Après une action, le bouton retour ramène sur la page du +.** `ActionDone.finish()` fait `router.push("/ile")`, et le retour de l'en-tête appelle `router.back()`. | UX | `agir/ActionDone.tsx:37`, `ProgressHud.tsx:93` | Le parcours « agir → planter → revenir » renvoie sur l'écran d'enregistrement, un cul-de-sac. | `router.replace("/ile")`, ou aller sur l'accueil (`/fil`), où l'île est jouable avec la graine présélectionnée (`/fil?graine=transport`). |
| C3 | **L'île de l'accueil anime en continu**, même quand on fait défiler le fil sous elle. Environ 70 animations CSS sont actives : balancement de chaque plante, reflets, lucioles, nuages, Tigou. | Performance | `scene.ts` (CSS `pi-*`), `IslandProvider.tsx` | Sur un Android d'entrée de gamme, ces animations SVG ne sont pas accélérées par la carte graphique : le fil peut saccader et la batterie s'user. `setPaused()` existe mais n'est jamais appelé. | Un `IntersectionObserver` sur l'île appelle `setPaused(true)` quand elle sort de l'écran, puis la relance. Ajouter aussi `visibilitychange`. |

## Problèmes qui reviennent dans plusieurs angles

| Problème | Relevé par | Cause | Correction commune |
|----------|-----------|-------|--------------------|
| Règles du jeu écrites deux fois, en SQL et en TypeScript (cases de l'île, plante rare ↔ exploit, calcul des graines) | Structure, Backend, Tenue du dépôt | `island_tile_ok` / `island_rare_exploit` recopient `ISLAND_TILES` / `RARES.exploit` ; `seedsOf()` recopie le calcul de `island_plant` | Un scénario SQL qui compare les deux (comme le test de parité CO₂ existant), ou renvoyer les graines calculées par la base dans `island()` (`seeds`) et supprimer `seedsOf` côté client. |
| Le côté social de l'île n'existe pas encore | UX, Design | `/ile/[id]` n'est lié nulle part ; le fil n'affiche pas les plantations | Lien « Voir son île » sur les publications et sur `jardin/[id]` ; événement « a planté un … » dans le fil, avec publication proposée et jamais automatique, comme les actions. |
| Choisir une case n'est possible qu'au doigt | Accessibilité, UX | Les cases et les plantes n'existent que dans le SVG | Garder « Planter pour moi » comme alternative au clavier, et rendre les plantes consultables dans une liste (fiche au clavier). |
| La branche et la PR parlent encore de 3D | Tenue du dépôt, Confort de développement | Nom `jeu/ile-3d`, titre et description de la PR #6 (three.js) | Mettre à jour le titre et la description de la PR ; renommer la branche au moment de la fusion. |

## Toutes les recommandations

| # | Recommandation | Angle | Fichier(s) | Correction |
|---|----------------|-------|------------|------------|
| R1 | La fête de plantation se joue avant la réponse du serveur ; en cas d'erreur, la plante disparaît d'un coup | UX, Frontend | `IslandProvider.tsx:89-113` | En cas d'échec, animer le retrait (rétrécir) et garder le message d'erreur. |
| R2 | Île pleine : si toutes les cases sont prises par d'autres espèces, rien ne s'affiche en mode plantation | UX | `IslandControls.tsx`, `scene.ts refreshTiles` | Message « Plus de case libre : fais grandir une plante de cette espèce » dès qu'aucune case n'est proposée. |
| R3 | Impossible de déplacer ou d'arracher une plante (37 cases au total) | UX, Backend | `0047_ile.sql` | `island_move(x1,z1,x2,z2)` plus tard ; ou agrandir l'île avec le niveau. |
| R4 | Les cases rejouent leur apparition en vague après chaque plantation | Design, Performance | `scene.ts refreshTiles` (reconstruit tout) | Mettre à jour les cases existantes au lieu de tout recréer. |
| R5 | Contraste des cases libres (blanc à 38 % sur l'herbe claire) faible en plein soleil | Design, Accessibilité | `scene.ts` | Contour plus marqué (`stroke` sapin à 40 %) ou opacité à 50 %. |
| R6 | Les graines d'un nouvel utilisateur incluent tout son historique d'actions : la première visite peut afficher beaucoup de graines | UX | `seedsOf`, `island_plant` | C'est voulu (bonus de départ) ; à dire dans le premier message (« Tes N actions passées t'ont donné N graines »). |
| R7 | `live.current = …` écrit pendant le rendu | Frontend | `IslandProvider.tsx:75-76` | Synchroniser dans un `useLayoutEffect`, ou passer à `useEffectEvent` quand il sera stable. |
| R8 | La valeur du contexte n'est pas mémorisée, donc tous les consommateurs se re-rendent | Frontend | `IslandProvider.tsx:193` | `useMemo` sur `value`. |
| R9 | L'effet de montage lit `framing` sans le déclarer dans ses dépendances | Frontend | `IslandProvider.tsx:146-168` | L'ajouter aux dépendances, ou le figer dans une référence. |
| R10 | `setPaused` est mort, sauf si C3 l'utilise | Frontend, Tenue du dépôt | `scene.ts` | Le brancher (C3). |
| R11 | Un composant importe une action serveur du dossier des routes (`@/app/(app)/ile/actions`) | Structure | `IslandProvider.tsx:5` | Passer `plantSeed` en prop, ou déplacer l'action dans `lib/game/island-actions.ts`. |
| R12 | `scene.ts` fait 550 lignes : décor, île, plantes, particules, Tigou, toucher | Structure | `scene.ts` | Découper en `background.ts`, `particles.ts`, `tigou.ts`, sans changer l'interface `IslandScene`. |
| R13 | Historique Supabase différent du dépôt : la production a deux migrations (`0047_ile` et `0047_ile_droits`), le dépôt un seul fichier | Production, Tenue du dépôt | `supabase/migrations/0047_ile.sql` | Le noter dans le README des migrations, ou ajouter un `0048` vide qui documente l'écart. Ne rien rejouer. |
| R14 | La production porte déjà la table de l'île alors que la PR dépend de #5 (« La Tige »), qui n'est pas fusionnée | Production | — | Fusionner #5 puis #6 ; sans fusion, la table reste inutilisée et sans risque. |
| R15 | Aucun test de bout en bout pour l'île | Production, Confort de développement | `e2e/` | Scénario Playwright : choisir une graine, « Planter pour moi », vérifier le message « Nouvelle plante ». |
| R16 | Les liens de connexion sur les prévisualisations dépendent du réglage Supabase « Redirect URLs » (fait à la main) | Production | `lib/site-url.ts` | Vérifier que `https://pousse-pilote-git-*-pousse1.vercel.app/**` est bien ajouté ; sinon, garder le code à 6 chiffres. |
| R17 | « Planter pour moi » mesure 36 px de haut (cible tactile sous 44 px) | Accessibilité | `IslandControls.tsx:123` | `min-h-11`. |
| R18 | La barre de confirmation qui apparaît ne prend pas le focus | Accessibilité | `IslandControls.tsx:65` | Donner le focus au bouton « Planter » à l'apparition. |
| R19 | Mettre à jour `PLAN.md` (rubrique jeu) et la description de la PR | Tenue du dépôt, Confort de développement | `PLAN.md`, PR #6 | Décrire les règles des graines et le partage SQL / TypeScript. |
| R20 | Valeur de couleur écrite en dur dans les classes (`bg-[#8ecbe0]`) | Design | `IslandProvider.tsx:214` | Jeton `--color-ciel` dans `globals.css`. |

---

# Analyse par angle

---

## 1. Design

**Verdict** : Approuvé avec changements

**Fichiers relus** : `scene.ts`, `sprites.ts`, `IslandControls.tsx`, `IslandProvider.tsx`, `ProgressHud.tsx`, `fil/page.tsx`

**Conformité au système « La Tige »**
- Polices : Bricolage Grotesque pour les titres et la fiche, Figtree pour le reste. Conforme.
- Accents : chlorophylle (`chloro`) pour agir (graine choisie, barre de progression), pollen (`pollen`) pour récompenser (bouton « Planter », cases à faire grandir, étoiles des plantes rares). Conforme à la règle des deux accents.
- Formes : arrondis 22 à 28 px, pastilles rondes. Conforme.
- Écart : le ciel est en couleur codée en dur (`bg-[#8ecbe0]`, R20). Les couleurs des dessins sont dans `sprites.ts` et `scene.ts` ; c'est acceptable pour des illustrations, mais à documenter comme palette d'illustration.

**États visuels**

| Élément | Repos | Chargement | Vide | Erreur | Actif |
|---------|-------|------------|------|--------|-------|
| Île | ✓ | ✓ « L'île se prépare… » | ✓ île nue, message dans le bac | ✓ carte « Voir ma collection » | ✓ |
| Bac à graines | ✓ | — | ✓ texte d'aide | — | ✓ graine en vert |
| Case choisie | — | — | — | — | ✓ losange vert pulsé et flèche |
| Plantation | — | ✓ bouton grisé | — | ✓ message rouge, retour arrière | ✓ confettis et Tigou |
| Île pleine | — | — | ✗ aucun message (R2) | — | — |

**Mode sombre** : l'appli n'en a pas. L'île a son propre cycle jour, aube et nuit, lisible dans les trois cas (captures vérifiées en local).

**Animation** : une animation par intention (rebond à la sortie, frémissement quand la plante grandit, éclosion à un nouveau stade), avec un rendu cohérent. Les cases qui rejouent leur vague après chaque plantation font un peu de bruit (R4).

**Cohérence** : le carré de case blanc à 38 % manque de contraste en plein jour (R5).

---

## 2. Expérience (UX)

**Verdict** : Approuvé avec changements

**Parcours utilisateur**

1. Ouvrir l'appli : l'accueil montre l'île, le bac de graines, puis le fil. ✓
2. Choisir une graine : les cases libres et jaunes apparaissent, avec une aide en haut. ✓
3. Toucher une case : losange et flèche, barre « Planter / Annuler ». ✓
4. Toucher de nouveau ou « Planter » : la plante sort, Tigou accourt, un message s'affiche. ✓
5. Toucher une plante sans graine choisie : sa fiche, avec « Ajouter une graine ». ✓
6. Enregistrer une action avec le + puis « Super ! » : `/ile` en grand, puis le bouton retour ramène sur `/agir`. ✗ (C2)
7. Voir l'île d'un collègue : aucune entrée dans l'appli. ✗

**Problème critique** : C2.

**Recommandations** : R1, R2, R3, R6 ; lien vers les îles des collègues et plantations dans le fil (voir les problèmes communs). C1 touche aussi l'expérience : deux graines pour une seule action, c'est déroutant.

**Cohérence des interactions** : le schéma « choisir puis confirmer » rejoint celui du + (carte de confirmation). La graine reste choisie après une plantation, ce qui permet d'enchaîner. C'est bien.

---

## 3. Frontend

**Verdict** : Approuvé avec changements

**Chemin de rendu** : `fil/page.tsx` (serveur) charge `getIsland` → `IslandHero` (client) → `IslandProvider` (état, contexte) → `scene.ts`, chargé en différé, qui pilote le SVG impérativement hors de React. Les rappels de la scène passent par des références pour lire l'état courant.

**Typage** : strict ; aucun `any` ni conversion forcée hors des retours `rpc` (`data as IslandData`, comme dans le reste du dépôt). Les fichiers de la scène ont été vérifiés en local avec `tsc --strict`, et l'ensemble a été typé par la CI.

**Constats** : R7, R8, R9, R10, R1. Le nettoyage au démontage est correct (`dispose` retire le SVG, l'intervalle et l'observateur). Le chargement différé de la scène évite tout souci de rendu côté serveur.

---

## 4. Backend (Supabase, actions serveur)

**Verdict** : Approuvé avec changements

**Analyse des erreurs**

| Erreur | Où | Message à l'écran |
|--------|----|-------------------|
| `no_seed` | `island_plant` | « Plus de graine de cette espèce… » |
| `tile_taken` | `island_plant` | « Cet emplacement est pris… » |
| `off_island` | `island_plant`, zod | « Cet emplacement est hors de l'île. » |
| `already_planted` | `island_plant` (rare) | « Cette plante rare est déjà sur ton île. » |
| `not_member`, autre | `island_plant` | « La graine n'a pas pu être plantée. Réessaie. » |

**Ressources** : un verrou consultatif par utilisateur (`pg_advisory_xact_lock`) sérialise les plantations ; `for update` sur la case ; transaction courte. ✓

**Sécurité** :
- `security definer` avec un `search_path` fixé, et `anon` révoqué (corrigé après l'avis Supabase).
- Lecture limitée par RLS à l'entreprise ; aucune écriture directe (testé dans le scénario SQL).
- `garden()` vérifie l'entreprise, `island()` en hérite.

**Problème critique** : C1 (double comptage des habitudes).

**Recommandations** :
- R3, R13.
- Chaque plantation rappelle `garden()` : une dizaine de sous-requêtes, c'est suffisant pour le pilote, à surveiller à grande échelle.
- Retirer un bravo après avoir planté sa graine laisse un solde négatif, affiché comme 0. C'est sans danger, mais ça vaut la peine de le documenter.

---

## 5. Structure

**Verdict** : Approuvé avec changements

**Dépendances** : `lib/game/island.ts` (pur) ← `components/island/{scene, sprites}` (DOM) ← `IslandProvider` / `IslandControls` / `IslandHero` (React) ← pages `fil`, `ile`, `ile/[id]`. Une flèche va dans le mauvais sens : `IslandProvider` importe `@/app/(app)/ile/actions` (R11).

**Frontières** : les règles sont recopiées entre SQL et TypeScript sans test de parité (voir les problèmes communs) ; `scene.ts` est volumineux (R12).

---

## 6. Tenue du dépôt

**Verdict** : Approuvé avec changements

**Conventions**

| Règle du dépôt | Respectée |
|----------------|-----------|
| Code et commentaires en français, ton direct | ✓ |
| Migrations numérotées et scénario `v2_00NN_*.sql` | ✓ |
| Tests `node --test` à côté de la logique | ✓ (`island.test.ts`, 5 tests) |
| Pas d'emoji, de vrais `<button>` et `<a>` | ✓ |
| Branche et PR qui décrivent le contenu | ✗ (« 3D ») |
| Pas de code mort | ✗ `setPaused` (R10) |

**À réutiliser** : `PlantArt` (jardin) et `sprites.ts` dessinent les mêmes espèces de deux façons. À terme, le jardin pourrait reprendre les dessins de l'île pour qu'on retrouve ses plantes d'un écran à l'autre.

**Recommandations** : R13, R19, renommage, R10.

---

## 7. Prêt pour la production

**Verdict** : Approuvé avec changements

**Pannes possibles**

| Panne | Effet | Prévu ? |
|-------|-------|---------|
| La scène ne se charge pas (JS, navigateur ancien) | Carte « Voir ma collection » | ✓ |
| `island()` en erreur ou migration absente | L'accueil s'affiche sans l'île ; `/ile` en 404 | ✓ à moitié (pas de message sur `/ile`) |
| Erreur à la plantation | Retour arrière et message | ✓ |
| Deux plantations en même temps | Verrou côté base | ✓ |
| Lien de connexion sur une prévisualisation | Dépend du réglage Supabase | ⚠ (R16) |

**Environnements** : migration appliquée sur la base de production, partagée avec les prévisualisations (R14) ; aucune nouvelle variable d'environnement ; three.js retiré, donc aucune nouvelle dépendance.

**Recommandations** : R13, R14, R15, R16.

---

## 8. Confort de développement

**Verdict** : Approuvé

**Messages d'erreur** : tous traduits en phrases d'action (voir l'angle Backend).

**Parcours d'un développeur** :
- `sprites.ts` isole chaque dessin, avec le pied en (0, 0) : on peut remplacer une espèce sans toucher à la scène.
- La scène se teste hors de Next avec un simple bundle esbuild ; c'est ainsi qu'elle a été vérifiée.

**Recommandations** : R19, et une page de démonstration de la scène (données d'exemple) pour régler les dessins sans compte.

---

## 9. Performance

**Verdict** : Approuvé avec changements

**Budget**

| Ressource | Estimation | Commentaire |
|-----------|------------|-------------|
| Nœuds SVG | 600 à 1 500 selon le nombre de plantes | Correct |
| Animations CSS infinies | Environ 70 en continu | Trop si l'île est hors de l'écran (C3) |
| JS de la scène | Environ 40 ko non compressés, chargés en différé | Correct |
| Requêtes | 1 lecture `island()` par accueil, 1 RPC par plantation | Correct |

**Points chauds** :
- Les transformations CSS sur des éléments SVG sont repeintes par le processeur à chaque image.
- Le grand rectangle de nuit (3 000 × 3 000) agrandit la zone repeinte.
- `refreshTiles` recrée jusqu'à 37 éléments à chaque changement (R4).

**Problème critique** : C3. **Recommandations** : R4, mesure sur un Android d'entrée de gamme, et un rectangle de nuit limité au cadre visible.

---

## 10. Accessibilité

**Verdict** : Approuvé avec changements

**Parcours au clavier**

1. Tab jusqu'au bac : les graines sont de vrais boutons avec `aria-pressed`. ✓
2. Entrée sur une graine, puis Tab jusqu'à « Planter pour moi » et Entrée : plantation possible. ✓
3. Choisir une case précise ou ouvrir la fiche d'une plante : impossible au clavier. ✗

**Attributs ARIA**

| Élément | État |
|---------|------|
| Île `role="img"` avec la liste des plantes et leur stade | ✓ |
| Messages dans une zone `aria-live="polite"` toujours présente | ✓ |
| Bouton de fermeture de la fiche avec `aria-label` | ✓ |
| Titre de section « Tes graines » (`sr-only` en version compacte) | ✓ |
| Mouvements réduits : animations CSS coupées, WAAPI sautées | ✓ |

**Recommandations** : R17, R18, R5 ; une liste « Tes plantes » accessible (bouton « Voir mes plantes ») qui ouvre les fiches au clavier.
