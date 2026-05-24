# Teyen — Audio des missions (P2) — Design

**Date** : 2026-05-24
**Auteur** : brainstorming Jean-Marc + Claude
**Statut** : à relire par l'auteur avant passage au plan d'implémentation
**Contexte produit** : `[[project-teyen-pivot]]`. P2 = pipeline audio (parler/écouter), branché sur les **Missions** (P1, déjà livré). Objectif explicite de l'utilisateur : **voix réaliste, qualité « pro », pas du robot Siri**.

---

## 1. Objectif et périmètre

Permettre à l'utilisateur de **parler** sa réplique dans une mission et d'**entendre** la réponse du coach avec une voix réaliste, en plus du texte. Pipeline **asynchrone** (pas de streaming temps réel), conforme au brief : `audio → STT → LLM → TTS → audio`.

**Décisions cadres (validées en brainstorming) :**
- **Où** : dans les **Missions** uniquement (le tuteur libre viendra plus tard).
- **TTS** : **OpenAI `gpt-4o-mini-tts`**, derrière une **interface échangeable** (passage à ElevenLabs plus tard = un seul fichier).
- **STT** : **OpenAI** (`gpt-4o-mini-transcribe`).
- **Modalité** : **voix + texte au choix** (bouton micro + champ texte existant).
- **Découpage** (Approche 1) : deux endpoints **génériques réutilisables** `/api/transcribe` et `/api/tts` ; le tour de mission `/api/missions/turn` reste **inchangé** (il prend toujours du texte). Le client orchestre les 3 étapes.
- **Pas de persistance audio** : le TTS est généré à la volée et joué (éphémère) ; seul le **texte transcrit** est persisté (comme un tour de mission normal). **Aucune nouvelle table, aucune migration.**

## 2. Contexte technique réutilisé

- `src/lib/openai.ts` → `openai()`, modèles existants. On ajoute `STT_MODEL`, `TTS_MODEL`, `TTS_VOICE`.
- `src/lib/missions/runtime.ts` → `submitTurn` (inchangé) ; `/api/missions/turn` (inchangé).
- `src/app/(app)/missions/[runId]/run-client.tsx` → composant de run à étendre (micro + lecture audio).
- `src/lib/auth.ts` → `requireUser`, `UnauthorizedError`.
- Pattern de « fournisseur échangeable + faux pour les tests » déjà utilisé (`generator`, `chat/responder`, `missions/responder`) → on le reproduit pour STT/TTS avec `AUDIO_FAKE=1`.
- `src/components/ui/button.tsx` → `Button`.

## 3. Architecture et composants (frontières)

| Fichier | Rôle | Dépend de |
|---|---|---|
| `src/lib/audio/stt.ts` | `SttProvider` + `openAiStt` + `fakeStt` + `getStt()` | `openai` |
| `src/lib/audio/tts.ts` | `TtsProvider` + `openAiTts` + `fakeTts` + `getTts()` | `openai` |
| `src/lib/openai.ts` | (modifié) `STT_MODEL`, `TTS_MODEL`, `TTS_VOICE` | — |
| `src/app/api/transcribe/route.ts` | POST multipart audio → `{ text }` | `auth`, `stt` |
| `src/app/api/tts/route.ts` | POST `{ text }` → octets `audio/mpeg` | `auth`, `tts` |
| `src/app/(app)/missions/[runId]/run-client.tsx` | (modifié) bouton micro (MediaRecorder), lecture auto du `reply`, toggle son | endpoints ci-dessus |

**Principe** : STT et TTS sont des **services génériques** isolés derrière une interface ; les endpoints sont minces ; le runtime de mission n'est pas touché. Réutilisables par le tuteur plus tard.

## 4. Interfaces des fournisseurs (échangeables)

```ts
// stt.ts
export type SttProvider = (audio: ArrayBuffer, mimeType: string) => Promise<{ text: string }>;
// tts.ts
export type TtsProvider = (text: string) => Promise<{ audio: Buffer; contentType: string }>;
```
- `getStt()` / `getTts()` renvoient le faux si `process.env.AUDIO_FAKE === '1'`, sinon l'implémentation OpenAI.
- `openAiStt` : envoie l'audio à l'API de transcription OpenAI (`STT_MODEL`), renvoie le texte. OpenAI a besoin d'un **nom de fichier avec extension** cohérente avec le mime (ex : `audio/webm` → `speech.webm`) pour inférer le format ; on mappe mime → extension.
- `openAiTts` : `gpt-4o-mini-tts` avec `TTS_VOICE`, format `mp3`, renvoie les octets + `contentType='audio/mpeg'`.
- `fakeStt` : renvoie un texte fixe (`'spoken test answer'`). `fakeTts` : renvoie un petit buffer mp3 statique (quelques octets d'en-tête valides) + `audio/mpeg`.

## 5. Endpoints

**`POST /api/transcribe`** (multipart/form-data, champ `audio`)
- `requireUser` (401 sinon).
- Lit le fichier audio (Blob) → `ArrayBuffer` + mimeType → `getStt()(buffer, mime)` → `{ text }`.
- Renvoie `{ text }`. Si transcription vide → `{ text: '' }` (le client gère « je n'ai pas entendu »).
- Limite de taille (ex : refuse > ~10 Mo) → 413.

**`POST /api/tts`** (JSON `{ text }`)
- `requireUser` (401 sinon). Zod : `text` 1..1000 chars.
- `getTts()(text)` → renvoie les octets avec `Content-Type: audio/mpeg` (réponse binaire, pas du JSON/base64).

## 6. Flux d'un tour vocal (client)
1. L'utilisateur tape sur le **micro** → `navigator.mediaDevices.getUserMedia({ audio: true })` → `MediaRecorder` enregistre. Re-tap → stop → `Blob`.
2. Client → `/api/transcribe` (multipart) → `{ text }`.
3. Si `text` non vide : on l'utilise comme réplique → `/api/missions/turn` (`{ runId, message: text }`, **inchangé**) → `{ reply, correction, status, turnsLeft }`.
4. Affichage de `reply` + (si son activé) → `/api/tts` `{ text: reply }` → lecture du mp3 (`<audio autoplay>`), avec un bouton **réécouter**.
- **Chemin texte** : taper + Envoyer fonctionne comme avant ; la réponse est aussi lue (sauf son coupé).
- **Toggle son** : un bouton 🔊/🔇 coupe la lecture auto (économie data + coût).

## 7. Gestion des erreurs / cas limites
- **Micro refusé / indisponible** : message clair (« autorise le micro ou tape ta réponse »), on reste sur le champ texte. Pas de blocage.
- **STT vide / échec** : « Je n'ai pas bien entendu — réessaie ou tape. » **Aucun tour de mission consommé** (on n'appelle `/api/missions/turn` que si on a un texte).
- **TTS échec** : on affiche le texte normalement + bouton « réécouter » (pas de blocage de la conversation).
- **Réseau** : motif existant (message + réessayer).
- **Coût/sécurité** : un appel STT par enregistrement, un appel TTS par réponse lue ; le toggle son évite les TTS inutiles. (Le plafonnement par utilisateur reste P4.)

## 8. Tests
- `stt.ts` / `tts.ts` (unitaire, faux) : `fakeStt` renvoie un texte non vide ; `fakeTts` renvoie un buffer non vide + `audio/mpeg`.
- `/api/transcribe` et `/api/tts` (intégration via l'API Playwright, `AUDIO_FAKE=1`) : transcribe (multipart) → `{text}` non vide ; tts → statut 200 + `content-type: audio/mpeg` + corps non vide ; **garde d'auth (401)** sur les deux.
- `AUDIO_FAKE=1` passé au serveur dev Playwright et au CI (comme `PLACEMENT_FAKE`/`CHAT_FAKE`/`MISSION_FAKE`).
- Flux **micro-navigateur** : **validation manuelle** (étapes fournies au plan) — enregistrer un vrai micro de façon déterministe en E2E n'est pas fiable. Les E2E texte des missions restent verts.
- **Vérif réelle une fois** : un appel `openAiStt` (sur un petit échantillon audio) et un `openAiTts` validés manuellement pendant le build.

## 9. Hors scope P2
- Audio dans le **tuteur libre** (plus tard).
- **ElevenLabs** (échange ultérieur via l'interface).
- **Streaming** temps réel (on reste async).
- Audio **offline**, mise en cache des TTS.
- **Cap de tokens / Mobile Money** (P4).

## 10. À trancher au plan d'implémentation
- La **voix** exacte (`TTS_VOICE`) — choisir une voix agréable parmi celles d'OpenAI ; configurable.
- Modèle STT exact (`gpt-4o-mini-transcribe` vs `whisper-1`) — vérifier la dispo dans le SDK installé et prendre le plus adapté.
- UX du bouton micro (tap-pour-démarrer/tap-pour-stopper recommandé ; éventuellement durée max d'enregistrement).
