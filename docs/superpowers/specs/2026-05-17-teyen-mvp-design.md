# Teyen — Design du MVP (web, texte)

**Date** : 2026-05-17
**Auteur** : brainstorming Jean-Marc + Claude
**Statut** : à relire par l'auteur avant passage au plan d'implémentation

---

## 1. Contexte et objectif

Teyen est une application web d'apprentissage de l'anglais. Elle est destinée à n'importe quel utilisateur souhaitant progresser jusqu'au niveau CEFR C2. L'application identifie le niveau initial de l'utilisateur, comprend ses objectifs et son domaine d'intérêt, puis lui fournit un entraînement personnalisé via un tuteur IA conversationnel et des exercices générés en contexte.

Ce document décrit le **MVP**. La vision complète comporte 10 sous-systèmes (A–J) ; le MVP en couvre 6 :

| Code | Sous-système | Inclus MVP ? |
|------|--------------|--------------|
| A | Comptes utilisateurs + profil | Oui |
| B | Test de placement | Oui |
| C | Sélection de domaine + objectifs | Oui |
| D | Tuteur IA conversationnel (texte) | Oui |
| E | Générateur d'exercices intelligent (texte) | Oui |
| F | Parcours structuré (curriculum) | Non |
| G | Module listening | Non |
| H | Module speaking | Non |
| I | Suivi de progression + moteur adaptatif | Oui |
| J | App mobile | Non |

## 2. Décisions cadres

- **Cible utilisateur** : francophones apprenant l'anglais, tous niveaux A1→C2.
- **Plateforme** : web responsive uniquement. Pas de mobile natif ni PWA installable.
- **UI** : 100 % en français.
- **Modalité** : texte uniquement (pas d'audio).
- **Modèle d'accès** : 100 % gratuit pendant le MVP.
- **Construction** : développeur solo, débutant en programmation. Les choix doivent rester implémentables incrémentalement.

## 3. Architecture haut niveau

Trois "cerveaux" séparés, derrière une API.

```
┌─────────────────────────────────────────────────────┐
│   Frontend web (UI FR)                              │
│   - Page Chat (vue principale)                      │
│   - Cartes Exercice (rendues dans le chat)          │
│   - Onboarding / Placement / Profil                 │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS (JSON)
┌──────────────────────▼──────────────────────────────┐
│   API Backend                                       │
│   - Auth, sessions                                  │
│   - Endpoints: /chat, /exercise, /placement, ...    │
└──┬────────────────┬────────────────┬────────────────┘
   │                │                │
   ▼                ▼                ▼
┌──────────┐  ┌───────────────┐  ┌─────────────────┐
│ Chat     │  │ Pedagogical   │  │ Exercise        │
│ Agent    │◀─▶ Engine        │◀─▶ Generator       │
│ (LLM)    │  │ (déterministe)│  │ (LLM contraint) │
└──────────┘  └───────┬───────┘  └─────────────────┘
                      │
                      ▼
              ┌────────────────────┐
              │ DB                 │
              │ - users            │
              │ - profiles         │
              │ - skill_levels     │
              │ - exercises        │
              │ - attempts         │
              │ - knowledge_items  │
              │ - conversation_turns│
              └────────────────────┘
```

**Principe de séparation** :
- **Chat Agent (LLM)** : porte la conversation. Ne décide pas *quoi* enseigner.
- **Pedagogical Engine (code déterministe)** : seul détenteur de l'état pédagogique. Choisit la prochaine cible (compétence, thème, difficulté).
- **Exercise Generator (LLM contraint)** : reçoit une spec stricte du moteur, produit l'exercice + son corrigé. Pas de mémoire utilisateur.

Le moteur est le **seul** module qui écrit dans `skill_levels` et `knowledge_items`. Le chat ne fait que demander et rapporter via des outils.

## 4. Composants et frontières

### 4.1 `auth`
Inscription email / mot de passe, connexion, session JWT (7 jours, refresh sur usage). Pas d'OAuth, pas de magic link au MVP.

### 4.2 `profile`
Stocke : domaines prédéfinis sélectionnés (liste cochée), intérêts libres (chips), objectif en texte libre (max 500 caractères). Lu par le chat et le générateur, jamais écrit par eux.

### 4.3 `placement`
Orchestre le test adaptatif initial (5-10 min, ~12 items couvrant les 4 compétences). Demande des items au générateur, ajuste la difficulté selon les réponses, initialise les 4 lignes `skill_levels` avec une `confidence` basse (0.3).

### 4.4 `chat_agent`
LLM avec prompt système définissant son rôle de tuteur. Dispose de 3 outils :

| Outil | Rôle |
|-------|------|
| `get_next_recommendation()` | Demande au moteur quoi pratiquer (skill, cefr, topic, raison) |
| `launch_exercise(spec)` | Fait générer et afficher un exercice dans le chat |
| `report_outcome(exercise_id, response, score)` | Renvoie le résultat au moteur |

Le chat agent ne lit ni n'écrit la DB directement. Tout passe par les outils.

### 4.5 `pedagogical_engine`
Code pur, pas d'appel LLM. Responsabilités :
- **Modèle utilisateur** : niveau CEFR par compétence + confidence.
- **Stratégie de sélection MVP** (deux phases déterministes) :
  - *Phase cold-start* — tant qu'au moins une compétence a `confidence < 0.5` : round-robin sur les 4 compétences (cycle reading → writing → vocab → grammar) pour collecter du signal partout.
  - *Phase stable* — toutes les compétences ont `confidence ≥ 0.5` : cible la compétence avec le `cefr_estimate` le plus bas ; égalité tranchée par tirage pseudo-aléatoire seedé sur `user_id + date`.
- **Choix du topic** : sampling pondéré dans `profile.domains` ∪ `profile.interests`, avec rotation pour éviter le même topic deux fois de suite. Si `goal_text` non vide, il est passé en contexte au générateur mais ne définit pas le topic seul.
- **Choix du type d'exercice** : déterminé par la compétence ciblée (table fixe skill→types possibles), avec **anti-boucle** : refuse 2 fois le même type consécutif.
- **File de révision Leitner 5-boîtes** pour `knowledge_items`. Quand un item arrive à `next_review_at`, l'engine peut le prioriser sur la stratégie ci-dessus (limite : 1 item de révision tous les 3 exercices, pour ne pas étouffer la progression).
- **Cold-start safety** : tant que `confidence < 0.5` pour la compétence ciblée, la difficulté est plafonnée à l'estimation issue du placement.
- **Mise à jour des niveaux après attempt** : delta = `±step × (1 - confidence)`, où `step = 0.1` (sur l'échelle CEFR numérique 0-6), signe selon score (positif si ≥ 0.7, négatif si ≤ 0.3, nul sinon). `confidence` augmente de `+0.02` par attempt jusqu'à plafond 0.95.

### 4.6 `exercise_generator`
LLM appelé avec une spec stricte : `{type, skill, cefr, topic, domain, length_hint}`. Retourne un JSON conforme à un schéma : `payload` (énoncé + options/champ) et `answer_key` (réponse(s) attendue(s) + critères pour le LLM-juge).

Types d'exercices MVP : `mcq`, `fill_blank`, `translate_fr_en`, `translate_en_fr`, `short_writing`, `reading_comprehension`, `vocab_recall`.

### 4.7 `progress_tracker`
Agrège `attempts` pour afficher à l'utilisateur : niveau global estimé (moyenne pondérée), niveau par compétence, série de jours actifs, nombre de `knowledge_items` maîtrisés (boîte 5). Lecture seule.

## 5. Modèle de données

### 5.1 `users`
`id`, `email`, `password_hash`, `created_at`, `target_cefr` (défaut `C2`), `ui_lang` (défaut `fr`).

### 5.2 `profiles` (1-1 avec `users`)
`user_id`, `domains` (array de codes : `business`, `tech`, `medical`, `legal`, `academic`, `travel`, …), `interests` (array libre), `goal_text` (≤ 500 chars).

### 5.3 `skill_levels`
`user_id`, `skill` (`reading` | `writing` | `vocab` | `grammar`), `cefr_estimate` (score numérique 0–6 ↔ A1–C2 ; exposé en CEFR à l'UI), `confidence` (0.0–1.0), `updated_at`. Quatre lignes par utilisateur après placement.

### 5.4 `exercises`
`id`, `user_id`, `type`, `skill`, `cefr`, `topic`, `domain`, `payload` (JSON), `answer_key` (JSON), `created_at`. Tout exercice appartient à un utilisateur (y compris les items de placement). Pas de notion de template partagé au MVP.

### 5.5 `attempts`
`id`, `user_id`, `exercise_id`, `response` (texte), `score` (0.0–1.0), `feedback` (texte court), `created_at`.

### 5.6 `knowledge_items`
`id`, `user_id`, `kind` (`vocab` | `grammar_rule`), `value`, `mastery` (0–5, Leitner), `next_review_at`, `last_seen_at`.

### 5.7 `conversation_turns`
`id`, `user_id`, `session_id` (uuid par session ou par jour), `role` (`user` | `assistant` | `tool` | `system_summary`), `content`, `tool_name`, `tool_payload`, `created_at`.

Le rôle `system_summary` héberge les résumés générés lors de la troncature de contexte (voir §7) : un seul résumé "actif" par session, remplacé par un nouveau quand l'historique grandit à nouveau.

### Choix volontaires
- Pas de table `placement_results` séparée : le placement écrit directement dans `skill_levels` et ses items sont des `exercises` + `attempts` normaux.
- Leitner 5-boîtes uniquement (pas de SM-2 ni FSRS).
- Tous les turns du chat sont persistés ; seul l'envoi LLM est tronqué (voir §7).

## 6. Flows clés

### 6.1 Flow A — Onboarding (1ère visite)

1. Inscription email + mot de passe.
2. Écran de transition : "Avant de commencer, on va situer ton niveau".
3. Placement adaptatif :
   - L'engine demande un 1ᵉʳ item au générateur (B1 reading par défaut).
   - L'utilisateur répond → score → l'engine ajuste l'estimation.
   - L'engine choisit l'item suivant (+1 niveau si bon, -1 si raté), couvre les 4 compétences en ~12 items.
   - L'engine écrit 4 lignes dans `skill_levels` avec `confidence = 0.3`.
4. Écran "Profil" : domaines (cases) + intérêts (chips) + objectif (textarea).
5. Premier message du tuteur dans le chat : rappel des niveaux estimés, rappel de l'objectif, proposition d'une première activité.

### 6.2 Flow B — Session quotidienne (conversation-first)

1. L'utilisateur ouvre l'app → page Chat avec l'historique de la session précédente.
2. Le tuteur ouvre la session :
   - Appel `get_next_recommendation()`.
   - L'engine retourne `{skill, cefr, topic, reason}` selon la stratégie de sélection.
   - Le tuteur introduit en français naturel et propose l'exercice.
3. L'utilisateur accepte → `launch_exercise(spec)` :
   - Le générateur produit JSON exercice + answer_key.
   - Le frontend rend la carte exercice dans le chat.
   - L'utilisateur répond dans la carte.
   - Score local calculé (matching exact ou LLM-juge pour writing).
4. `report_outcome(exercise_id, response, score)` :
   - L'engine met à jour `skill_levels` (delta selon score et confidence).
   - L'engine met à jour `knowledge_items` (Leitner).
   - L'engine retourne au chat un message de feedback à afficher.
5. Le tuteur enchaîne : conversation libre OU nouvelle reco. Boucle jusqu'à ce que l'utilisateur quitte.

### 6.3 Flow C — Conversation libre

1. L'utilisateur tape un message libre (question, sujet libre).
2. Le chat agent répond en anglais à un niveau ajusté, avec corrections subtiles.
3. Si le chat détecte une faute récurrente ou un mot nouveau, il peut proposer un mini-exercice contextuel (même mécanique que Flow B mais déclenchée par le chat).
4. Tous les turns sont persistés. En fin de session, un job léger extrait vocab/grammaire nouveaux et les ajoute à `knowledge_items`.

### 6.4 Notation du writing
Pas de matching exact. Appel d'un LLM-juge avec rubrique (grammar 0-3, lexicon 0-3, task achievement 0-3), réponse JSON, normalisée en score 0.0–1.0.

## 7. Gestion des erreurs et garde-fous

| Cas | Comportement |
|-----|--------------|
| LLM en erreur / timeout | Retry 1× avec backoff 1s. Si échec : message UI "petit souci, on retente ?" + bouton. Le turn en échec n'est pas persisté comme assistant. |
| Generator produit un JSON invalide | Validation schéma strict. Re-génération max 2×, puis erreur visible. Log structuré pour analyse offline. |
| LLM-juge incohérent | Clip score à [0,1]. Rubrique manquante → score neutre 0.5 + flag "review needed". Pas de blocage utilisateur. |
| Placement bruité | `confidence = 0.3` après placement. Engine plafonne à l'estimation pendant les ~20 premiers exercices. À ≥ 20 attempts confirmants, confidence monte à 0.7+ et la progression vers le haut se débloque. |
| Cold start sans reco possible | Reco par défaut : vocab, niveau le plus bas estimé, topic = 1ᵉʳ domaine du profil. |
| Session JWT expirée | Écran login propre ; les drafts dans la carte exercice sont persistés en local pour ne pas perdre la saisie. |
| Suppression de compte | Cascade sur toutes les tables. Pas d'archivage MVP. |
| Conversation très longue | Envoi LLM tronqué aux N derniers turns (défaut N = 30). Tous les ~50 turns, un appel LLM génère un résumé compressé des turns plus anciens et le persiste en tant que `conversation_turns.role = system_summary` (un seul résumé actif par session). La DB garde tout l'historique brut. |
| Coûts qui dérapent | Limite par utilisateur/jour configurable (défaut ~50 appels LLM). Au dépassement : message "reviens demain" — sain pédagogiquement aussi. |

## 8. Stratégie de tests

| Module | Approche | Niveau d'effort |
|--------|----------|-----------------|
| `pedagogical_engine` | Tests unitaires complets (sélection de reco, mise à jour des niveaux, Leitner, anti-boucle, cold-start cap) | **Le plus haut** : code prévisible, valeur critique. |
| `exercise_generator` | Tests de schéma stricts par type ; suite d'éval 10–20 specs représentatives, revue manuelle au début | Moyen |
| `chat_agent` | Smoke tests : appelle bien `get_next_recommendation` à l'ouverture. Scénarios scriptés : "user dit X → l'agent doit appeler tool Y" sur 5–10 cas | Moyen, pas de vérification du contenu exact |
| `placement` | User simulé tout-juste → converge C2 ; tout-faux → A1 ; mixte → 4 niveaux distincts cohérents | Moyen |
| API / endpoints | Tests d'intégration sur flow complet : signup → placement → 1 session → progress | Moyen |
| Frontend | Scénarios end-to-end (Playwright ou Cypress) sur onboarding et une session | Bas (juste flows clés) |

**Hors tests automatiques** : performance, charge, sécurité avancée, qualité pédagogique réelle (observée en prod).

## 9. Hors scope MVP (explicite)

- Compétences orales (listening, speaking) : pas de TTS, STT, audio quelconque.
- Parcours structuré / curriculum formel.
- App mobile native ou PWA installable.
- Paiement, freemium, limites payantes.
- UI multilingue (FR uniquement).
- Social : classements, amis, groupes, partage.
- Gamification lourde : XP, badges. Une série de jours simple, c'est tout.
- SRS sophistiqué (SM-2, FSRS).
- Export RGPD, portabilité, cookie banner avancé.
- Modération custom (on s'appuie sur les garde-fous natifs du LLM).
- Multi-langue cible : Teyen enseigne uniquement l'anglais.
- Interface admin (lecture DB directe au début).
- Analytics produit (Mixpanel, PostHog).

## 10. À décider au moment du plan d'implémentation

Ces points ne bloquent pas le design mais devront être tranchés dans le plan :
- Stack technique exacte (recommandation à venir : Next.js + TypeScript + Postgres managé + OpenAI API, mais à confirmer selon l'apprentissage du dev).
- Hébergeur (Vercel, Render, autre).
- Provider DB (Supabase, Neon, autre).
- Fournisseur LLM (OpenAI par défaut, possibilité d'avoir un fallback).
- Outil d'auth (managed via Supabase Auth ou self-rolled simple).
