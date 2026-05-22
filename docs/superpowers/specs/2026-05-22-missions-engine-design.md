# Teyen — Moteur de missions/roleplay (P1) — Design

**Date** : 2026-05-22
**Auteur** : brainstorming Jean-Marc + Claude
**Statut** : à relire par l'auteur avant passage au plan d'implémentation
**Contexte produit** : voir `[[project-teyen-pivot]]` — pivot vers un produit d'apprentissage de l'anglais façon Speak+Duolingo, marché de lancement africain francophone, **contenu international**. P1 est le premier morceau du pivot : le moteur de missions/roleplay, **en texte d'abord** (l'audio est P2).

---

## 1. Objectif et périmètre

Remplacer le « chat libre » comme expérience conversationnelle centrale par des **missions/roleplay structurées** (modèle Speak) : l'utilisateur joue une situation concrète (entretien d'embauche, commander au restaurant, réunion pro…) avec un objectif clair, un nombre de tours limité, et un coach qui corrige. Texte uniquement pour P1.

**Décisions cadres (validées en brainstorming) :**
- **Source des missions** : bibliothèque **curée** de scénarios **internationaux**, écrite à la main, stockée **en code** (pas de table DB, pas d'admin).
- **Fin de mission** : **objectif atteint** (jugé par le LLM à chaque tour) → succès anticipé ; sinon **limite de tours** atteinte → « à retravailler ». Fin = bilan + récap des corrections.
- **Lien au modèle CEFR** : missions **taguées par niveau** ; on les propose au niveau de l'utilisateur ; progression des missions suivie **à part** (`mission_runs`). Les 4 estimations CEFR restent pilotées par les QCM de pratique — **les missions ne modifient pas** `skill_levels`.
- **Architecture** : **runtime de mission dédié** (Approche 2), Structured Outputs par tour, machine à états déterministe. Réutilise les briques bas niveau (client OpenAI, helpers CEFR, patterns de persistance) mais **pas** la boucle à outils du chat libre.
- **Persona** : coach neutre, encourageant, professionnel (pas de nom de marque figé pour l'instant). Anglais clair calibré au niveau ; peut glisser une brève clarification en français pour les débutants.
- On **garde** le chat libre (`/chat`) pour l'instant ; les missions sont un **nouveau mode** ajouté à la nav.

## 2. Contexte technique réutilisé

- `src/lib/openai.ts` → `openai()`, modèle (un `MISSION_MODEL = 'gpt-4o-mini'` dédié, même valeur que les autres pour l'instant).
- `src/lib/cefr.ts` → `levelToLabel`, `clampLevel`, `CEFR_LABELS`.
- `src/lib/exercises/types.ts` → `Skill`/`SKILLS` (non central ici).
- `src/lib/exercises/generator.ts` → patron Structured Outputs via `zodResponseFormat` (à reproduire pour le tour de mission).
- `src/db/index.ts` / `src/db/schema.ts` → Drizzle ; on ajoute 2 tables + 1 enum.
- `src/lib/auth.ts` → `requireUser`, `UnauthorizedError`.
- `src/lib/onboarding/gate.ts` → `requireOnboardingStep` (les missions sont réservées aux utilisateurs onboardés).
- `src/components/app-nav.tsx` → ajouter le lien « Missions ».

## 3. Architecture et composants (frontières)

| Fichier | Rôle | Dépend de |
|---|---|---|
| `src/lib/missions/catalog.ts` | Bibliothèque statique de missions internationales | `cefr` (niveaux) |
| `src/lib/missions/types.ts` | Type `Mission` + schéma Zod `missionTurnSchema` (`{reply, objectiveMet, correction}`) | zod |
| `src/lib/missions/prompt.ts` | **Pur** : construit le prompt système d'une mission | `Mission`, `cefr` |
| `src/lib/missions/state.ts` | **Pure** machine à états : `advance`, constantes | — |
| `src/lib/missions/responder.ts` | Répondeur de tour injectable (`openAiMissionResponder` + `fakeMissionResponder`, sélection via `MISSION_FAKE=1`) | `openai`, `prompt`, `types` |
| `src/lib/missions/runtime.ts` | Couche DB : `startRun`, `submitTurn`, lectures | `db`, `state`, `responder`, `catalog` |
| `src/app/api/missions/start/route.ts` | POST `{missionId}` → `{runId, opener, objective, turnLimit}` | `runtime`, `auth` |
| `src/app/api/missions/turn/route.ts` | POST `{runId, message}` → `{reply, correction, status, turnsLeft}` | `runtime`, `auth` |
| `src/app/(app)/missions/page.tsx` | Liste des missions (badges niveau + statut), gated `home` | `catalog`, `runtime` |
| `src/app/(app)/missions/mission-list.tsx` | Composant client : grille de missions, lance un run | — |
| `src/app/(app)/missions/run-client.tsx` | Composant client : déroulé d'une mission (objectif, compteur, fil, fin) | — |
| `src/app/(app)/missions/[runId]/page.tsx` | Page de run (charge le run + son historique), gated `home` | `runtime` |
| `src/components/app-nav.tsx` | (modifié) ajoute « Missions » | — |

**Principe** : `state.ts` et `prompt.ts` sont purs et testés unitairement. `runtime.ts` est la seule couche qui touche la DB et le LLM. Le catalogue est du contenu versionné.

## 4. Modèle de données (2 tables, isolées du chat libre)

Nouvel enum `mission_run_status` = `in_progress | success | incomplete`.

**`mission_runs`**
- `id` uuid PK
- `user_id` uuid FK → users(id) ON DELETE CASCADE
- `mission_id` text (référence l'`id` du catalogue ; pas de FK DB puisque le catalogue est en code)
- `status` `mission_run_status` (défaut `in_progress`)
- `turn_count` integer (défaut 0)
- `started_at` timestamptz défaut now()
- `ended_at` timestamptz nullable
- index sur `(user_id, started_at desc)`

**`mission_turns`**
- `id` uuid PK
- `run_id` uuid FK → mission_runs(id) ON DELETE CASCADE
- `role` (réutilise l'enum existant `turn_role`, valeurs `user`/`assistant`)
- `content` text
- `correction` text nullable (pour les tours `assistant`)
- `created_at` timestamptz défaut now()
- index sur `(run_id, created_at asc)`

> Tables **séparées** de `conversation_turns` exprès : isolation nette du chat libre (dont la persistance charge par `user_id` sans filtrer la session), pas de fuite entre les deux. Les missions sont des runs bornés, pas une conversation continue.

## 5. Structure d'une mission (catalogue)

```ts
type Mission = {
  id: string;            // slug stable, ex: 'restaurant-order'
  title: string;         // FR, ex: "Commander au restaurant"
  scenario: string;      // contexte donné au LLM (EN)
  objective: string;     // objectif observable (EN), ex: "Order a main dish and a drink"
  requiredVocab: string[]; // mots/expressions à favoriser
  cefr: CefrLabel;       // niveau cible
  turnLimit: number;     // 3..5
  opener: string;        // 1re réplique du coach (EN), affichée sans appel LLM
};
```

Lot initial : ~10-12 missions internationales réparties A2→C1 (commander au resto, réserver un hôtel, entretien d'embauche, réunion d'équipe, réclamation service client, demander son chemin, small talk pro, négocier un prix, prise de rendez-vous médical, présentation rapide de soi…).

## 6. Contrat LLM par tour (Structured Outputs)

`missionTurnSchema` (Zod) :
```ts
{
  reply: string;          // réponse du coach en anglais, ≤ ~30 mots, dans le rôle
  objectiveMet: boolean;  // true dès que l'utilisateur a atteint l'objectif
  correction: string | null; // brève correction FR de la dernière réplique de l'utilisateur, null si rien à corriger
}
```

Prompt système (construit par `prompt.ts`) : persona coach neutre encourageant ; rappel du scénario, de l'objectif, du vocab à favoriser, du niveau CEFR (langage calibré) ; consignes : rester dans le rôle, garder la réplique courte (contrainte future TTS), poser `objectiveMet=true` uniquement quand l'objectif est réellement atteint, corriger gentiment.

## 7. Machine à états (`state.ts`, pur)

- Constantes : `DEFAULT_TURN_LIMIT = 5` (le catalogue peut surcharger par mission).
- État : `{ status, turnCount }`.
- `advance(state, { objectiveMet }, turnLimit)` :
  - `turnCount + 1`
  - si `objectiveMet` → `status = 'success'`
  - sinon si `turnCount + 1 >= turnLimit` → `status = 'incomplete'`
  - sinon `status = 'in_progress'`
- `turnsLeft(state, turnLimit) = max(0, turnLimit - state.turnCount)`.

## 8. Flux

1. **Liste** : `/missions` rend le catalogue, chaque mission avec badge de niveau (CEFR) et statut dérivé des `mission_runs` de l'utilisateur (jamais faite / en cours / réussie / à retravailler). Mise en avant douce des missions au niveau de l'utilisateur, où le **niveau global** = moyenne arrondie des 4 `cefr_estimate` de `skill_levels` (via `levelToLabel`). Toutes les missions restent accessibles quel que soit le niveau.
2. **Start** : `POST /api/missions/start {missionId}` → crée un `mission_run` (`in_progress`, `turn_count=0`), persiste un tour `assistant` = `opener`, renvoie `{runId, opener, objective, turnLimit}`. **Aucun appel LLM** à l'ouverture.
3. **Tour** : `POST /api/missions/turn {runId, message}` →
   - vérifie que le run appartient à l'utilisateur et est `in_progress` ;
   - persiste le tour `user` ;
   - appelle le répondeur (LLM Structured Outputs) avec prompt + historique → `{reply, objectiveMet, correction}` ;
   - `advance` l'état ; met à jour `mission_runs` (`status`, `turn_count`, `ended_at` si terminé) ;
   - persiste le tour `assistant` (avec `correction`) ;
   - renvoie `{reply, correction, status, turnsLeft}`.
4. **Fin** : quand `status != in_progress`, la vue de run affiche l'écran de fin (réussi / à retravailler) + le récap des corrections du run, avec « Refaire » (nouveau run) ou retour à la liste.

## 9. Gestion des erreurs et garde-fous

- LLM en erreur/timeout sur un tour : retry 1× (dans le répondeur OpenAI) ; sinon la route renvoie 502 et l'UI affiche « petit souci, réessaie » sans consommer de tour (pas de persistance du tour assistant en échec). Le tour `user` déjà persisté reste (l'utilisateur peut renvoyer).
- Structured Output invalide : le `zodResponseFormat` garantit la forme ; si `parsed` absent → erreur → 502.
- Run déjà terminé : `submitTurn` refuse (409) si `status != in_progress`.
- Auth : `requireUser` sur les deux routes ; `submitTurn`/`start` scoppés à `user.id` ; un run d'un autre utilisateur → 404/erreur.
- Coût : pas de boucle d'auto-génération ; un appel LLM par tour utilisateur ; tours plafonnés par mission (3-5).

## 10. Tests

- `state.ts` (unitaire) : succès anticipé, incomplete à la limite, `in_progress` sinon, `turnsLeft`.
- `prompt.ts` (unitaire) : le prompt contient objectif, scénario, vocab, niveau ; persona neutre.
- `catalog.ts` (unitaire) : chaque mission bien formée (champs présents, `turnLimit` 3-5, `requiredVocab` non vide, `cefr` valide, `id` uniques).
- `responder` : faux répondeur déterministe — `objectiveMet = message.toLowerCase().includes('success')`, `reply`/`correction` déterministes — sélectionné par `MISSION_FAKE=1`.
- E2E (avec `MISSION_FAKE=1`) : (a) lancer une mission, faire un tour normal (objectif non atteint), puis envoyer « success » → écran **réussi** ; (b) chemin **limite de tours** : envoyer des messages sans « success » jusqu'à la limite → écran « à retravailler » ; (c) `/api/missions/turn` exige l'auth (401).
- `MISSION_FAKE=1` passé au serveur dev Playwright et au CI (comme `PLACEMENT_FAKE`/`CHAT_FAKE`).

## 11. Hors scope P1

- Audio (STT/TTS) → P2.
- Mobile Money / rationing de tokens → P4.
- Génération de missions par LLM (catalogue curé seulement).
- Mutation des niveaux CEFR par les missions.
- Suppression du chat libre `/chat`.
- Coque PWA / offline (P0, séparé).

## 12. À trancher au plan d'implémentation

- Nom/persona définitif du coach (cosmétique).
- Disposition exacte de la liste de missions (groupée par niveau ou par thème).
- Réutiliser `MISSION_MODEL` = gpt-4o-mini ou monter en gamme pour le roleplay (réévaluer sur pièces).
