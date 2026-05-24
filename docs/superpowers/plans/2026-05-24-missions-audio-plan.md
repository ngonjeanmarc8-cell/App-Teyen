# Teyen — Audio des missions (P2) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de **parler** sa réplique dans une mission (transcrite par OpenAI STT) et d'**entendre** la réponse du coach lue par une voix réaliste (OpenAI `gpt-4o-mini-tts`), en plus du texte.

**Architecture:** Deux services génériques échangeables (`stt`, `tts`) derrière des interfaces, sélectionnables en faux via `AUDIO_FAKE=1`. Deux endpoints minces (`/api/transcribe`, `/api/tts`). Le tour de mission `/api/missions/turn` reste inchangé : le client orchestre enregistrement → transcription → tour → lecture TTS. Aucune persistance audio, aucune migration.

**Tech Stack:** Next.js 16 (Route Handlers + client React 19), OpenAI SDK (transcriptions + speech), `MediaRecorder`/`getUserMedia` (navigateur), Zod 4, Vitest, Playwright. Faux fournisseurs via `AUDIO_FAKE=1`.

---

## Contexte : état du projet

Pertinent pour ce plan :
- `src/lib/openai.ts` → `openai()` (client), `GENERATION_MODEL`, `CHAT_MODEL`, `MISSION_MODEL` (tous `'gpt-4o-mini'`). On ajoute `STT_MODEL`, `TTS_MODEL`, `TTS_VOICE`.
- Pattern fournisseur échangeable + faux (voir `src/lib/exercises/generator.ts`, `src/lib/missions/responder.ts`) : `getX()` renvoie le faux si un flag d'env est posé.
- `src/lib/auth.ts` → `requireUser`, `UnauthorizedError`.
- `src/app/(app)/missions/[runId]/run-client.tsx` → composant client du run de mission (état `Turn[]`, `send()` qui POST `/api/missions/turn`). À étendre (micro + lecture audio). READ-le avant de modifier.
- `src/app/api/missions/turn/route.ts` → **inchangé** (prend `{runId, message}`).
- `src/components/ui/button.tsx` → `Button`.
- Tests E2E lancés avec `PLACEMENT_FAKE=1 CHAT_FAKE=1 MISSION_FAKE=1` (cross-env, dans `playwright.config.ts`) ; CI a ces flags. On ajoute `AUDIO_FAKE=1`.
- Spec : `docs/superpowers/specs/2026-05-24-missions-audio-design.md`.
- OpenAI SDK 6.38.0. La transcription : `openai().audio.transcriptions.create({ file, model })` où `file` se construit via le helper `toFile` du SDK (`import { toFile } from 'openai'` ou `openai/uploads`). La synthèse : `openai().audio.speech.create({ model, voice, input, response_format: 'mp3' })` → réponse dont on lit `arrayBuffer()`. **Vérifier la forme exacte contre `node_modules/openai` et adapter.**

## File Structure

| Fichier | Responsabilité |
|---|---|
| `src/lib/openai.ts` | (modifié) `STT_MODEL`, `TTS_MODEL`, `TTS_VOICE` |
| `src/lib/audio/stt.ts` | `SttProvider`, `fakeStt`, `openAiStt`, `getStt()` |
| `src/lib/audio/tts.ts` | `TtsProvider`, `fakeTts`, `openAiTts`, `getTts()` |
| `src/app/api/transcribe/route.ts` | POST multipart audio → `{ text }` |
| `src/app/api/tts/route.ts` | POST `{ text }` → octets `audio/mpeg` |
| `src/app/(app)/missions/[runId]/run-client.tsx` | (modifié) bouton micro + lecture TTS + toggle son |
| `playwright.config.ts`, `.github/workflows/ci.yml` | (modifié) `AUDIO_FAKE=1` |

## Vue d'ensemble

| # | Phase | Tasks |
|---|---|---|
| A | Fournisseurs STT/TTS | 1–3 |
| B | Endpoints | 4–5 |
| C | UI micro + lecture | 6 |
| D | E2E | 7 |

Total : **7 tâches**.

---

## Task 1: Constantes audio dans openai.ts

**Files:**
- Modify: `src/lib/openai.ts`

- [ ] **Step 1: Ajouter les constantes**

Dans `src/lib/openai.ts`, après la ligne `export const MISSION_MODEL = ...`, ajouter :

```typescript
export const STT_MODEL = 'gpt-4o-mini-transcribe';
export const TTS_MODEL = 'gpt-4o-mini-tts';
export const TTS_VOICE = 'alloy';
```

- [ ] **Step 2: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint:fix && pnpm lint
```

Expected : 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/lib/openai.ts
git commit -m "feat(audio): add STT/TTS model and voice constants"
```

## Operational guidance
- `'gpt-4o-mini-transcribe'` et `'gpt-4o-mini-tts'` sont les modèles audio OpenAI. Si l'un n'est pas disponible avec le compte/SDK, `whisper-1` (STT) et `tts-1` (TTS) sont les fallbacks. On garde gpt-4o-mini-* ; on ajustera à la Task 2/3 si un appel réel échoue. `'alloy'` est une voix OpenAI valide.

## Reporting back
Report: Status, `pnpm typecheck`, `pnpm lint`, `git show --stat HEAD`, `git status`.

---

## Task 2: Service STT (faux + OpenAI)

**Files:**
- Create: `src/lib/audio/stt.ts`, `src/lib/audio/stt.test.ts`

- [ ] **Step 1: Écrire le test du faux (TDD)**

Créer `src/lib/audio/stt.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { fakeStt } from './stt';

describe('fakeStt', () => {
  it('returns a non-empty fixed transcript', async () => {
    const res = await fakeStt(new ArrayBuffer(8), 'audio/webm');
    expect(res.text.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
pnpm test src/lib/audio/stt.test.ts
```

Expected : FAIL ("Cannot find module './stt'").

- [ ] **Step 3: Implémenter**

Créer `src/lib/audio/stt.ts` :

```typescript
import { toFile } from 'openai';
import { STT_MODEL, openai } from '@/lib/openai';

export type SttProvider = (audio: ArrayBuffer, mimeType: string) => Promise<{ text: string }>;

const MIME_EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/mpga': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
};

export const fakeStt: SttProvider = async () => {
  return { text: 'spoken test answer' };
};

export const openAiStt: SttProvider = async (audio, mimeType) => {
  const ext = MIME_EXT[mimeType.split(';')[0] ?? ''] ?? 'webm';
  const file = await toFile(Buffer.from(audio), `speech.${ext}`, { type: mimeType });
  const result = await openai().audio.transcriptions.create({ file, model: STT_MODEL });
  return { text: result.text ?? '' };
};

export function getStt(): SttProvider {
  return process.env.AUDIO_FAKE === '1' ? fakeStt : openAiStt;
}
```

- [ ] **Step 4: Relancer**

```bash
pnpm test src/lib/audio/stt.test.ts
```

Expected : 1 passed.

- [ ] **Step 5: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint:fix && pnpm lint
```

Expected : 0 erreur. (Si `toFile` n'est pas exporté depuis `'openai'`, l'importer depuis `'openai/uploads'`. Vérifier : `grep -r "export.*toFile" node_modules/openai/*.d.ts node_modules/openai/uploads.d.ts | head`. Si `audio.transcriptions.create` a une signature différente, lire `node_modules/openai/resources/audio/transcriptions.d.ts` et adapter — le but : envoyer un fichier audio + le modèle, récupérer `.text`.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/audio/stt.ts src/lib/audio/stt.test.ts
git commit -m "feat(audio): stt service (fake + openai transcription)"
```

## Reporting back
Report: Status, `pnpm test src/lib/audio/stt.test.ts` (1 passed), `pnpm typecheck`, `pnpm lint`, toute adaptation SDK, `git show --stat HEAD`, `git status`.

---

## Task 3: Service TTS (faux + OpenAI)

**Files:**
- Create: `src/lib/audio/tts.ts`, `src/lib/audio/tts.test.ts`

- [ ] **Step 1: Écrire le test du faux (TDD)**

Créer `src/lib/audio/tts.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { fakeTts } from './tts';

describe('fakeTts', () => {
  it('returns a non-empty audio buffer with an audio content type', async () => {
    const res = await fakeTts('Hello there');
    expect(res.audio.length).toBeGreaterThan(0);
    expect(res.contentType).toBe('audio/mpeg');
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
pnpm test src/lib/audio/tts.test.ts
```

Expected : FAIL ("Cannot find module './tts'").

- [ ] **Step 3: Implémenter**

Créer `src/lib/audio/tts.ts` :

```typescript
import { TTS_MODEL, TTS_VOICE, openai } from '@/lib/openai';

export type TtsProvider = (text: string) => Promise<{ audio: Buffer; contentType: string }>;

// Minimal valid silent MP3 frame header bytes — enough to be a non-empty audio payload in tests.
const FAKE_MP3 = Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00]);

export const fakeTts: TtsProvider = async () => {
  return { audio: FAKE_MP3, contentType: 'audio/mpeg' };
};

export const openAiTts: TtsProvider = async (text) => {
  const response = await openai().audio.speech.create({
    model: TTS_MODEL,
    voice: TTS_VOICE,
    input: text,
    response_format: 'mp3',
  });
  const audio = Buffer.from(await response.arrayBuffer());
  return { audio, contentType: 'audio/mpeg' };
};

export function getTts(): TtsProvider {
  return process.env.AUDIO_FAKE === '1' ? fakeTts : openAiTts;
}
```

- [ ] **Step 4: Relancer**

```bash
pnpm test src/lib/audio/tts.test.ts
```

Expected : 1 passed.

- [ ] **Step 5: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint:fix && pnpm lint
```

Expected : 0 erreur. (Si `audio.speech.create` a une autre forme, lire `node_modules/openai/resources/audio/speech.d.ts` et adapter — le but : `{model, voice, input, response_format}` → réponse `Response`-like dont on lit `arrayBuffer()`. Si `voice` typé en union stricte n'accepte pas `'alloy'`, c'est qu'il faut une autre valeur ; ajuster `TTS_VOICE`.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/audio/tts.ts src/lib/audio/tts.test.ts
git commit -m "feat(audio): tts service (fake + openai speech)"
```

## Reporting back
Report: Status, `pnpm test src/lib/audio/tts.test.ts` (1 passed), `pnpm typecheck`, `pnpm lint`, toute adaptation SDK, `git show --stat HEAD`, `git status`.

---

## Task 4: Endpoint /api/transcribe

**Files:**
- Create: `src/app/api/transcribe/route.ts`

- [ ] **Step 1: Implémenter**

Créer `src/app/api/transcribe/route.ts` :

```typescript
import { NextResponse } from 'next/server';
import { requireUser, UnauthorizedError } from '@/lib/auth';
import { getStt } from '@/lib/audio/stt';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  try {
    await requireUser();
    const form = await request.formData();
    const audio = form.get('audio');
    if (!(audio instanceof Blob)) {
      return NextResponse.json({ error: 'Missing audio file' }, { status: 400 });
    }
    if (audio.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Audio too large' }, { status: 413 });
    }
    const buffer = await audio.arrayBuffer();
    const mime = audio.type || 'audio/webm';
    const { text } = await getStt()(buffer, mime);
    return NextResponse.json({ text });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw err;
  }
}
```

- [ ] **Step 2: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint:fix && pnpm lint
```

Expected : 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/transcribe/route.ts
git commit -m "feat(audio): transcribe api route"
```

## Reporting back
Report: Status, `pnpm typecheck`, `pnpm lint`, `git show --stat HEAD`, `git status`.

---

## Task 5: Endpoint /api/tts

**Files:**
- Create: `src/app/api/tts/route.ts`

- [ ] **Step 1: Implémenter**

Créer `src/app/api/tts/route.ts` :

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, UnauthorizedError } from '@/lib/auth';
import { getTts } from '@/lib/audio/tts';

const bodySchema = z.object({ text: z.string().min(1).max(1000) });

export async function POST(request: Request) {
  try {
    await requireUser();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const { audio, contentType } = await getTts()(parsed.data.text);
    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: { 'content-type': contentType, 'cache-control': 'no-store' },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw err;
  }
}
```

- [ ] **Step 2: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint:fix && pnpm lint
```

Expected : 0 erreur. (Retourner un corps binaire : `new NextResponse(new Uint8Array(buffer), { headers })`. Si TypeScript rechigne sur le type du body, `new Uint8Array(audio)` est un `BodyInit` valide.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tts/route.ts
git commit -m "feat(audio): tts api route returning audio bytes"
```

## Reporting back
Report: Status, `pnpm typecheck`, `pnpm lint`, `git show --stat HEAD`, `git status`.

---

## Task 6: UI — micro + lecture audio dans le run de mission

**Files:**
- Modify: `src/app/(app)/missions/[runId]/run-client.tsx`

READ le fichier d'abord. Il a un état `turns`, `status`, `draft`, `pending`, `error`, une fonction `send()` qui POST `/api/missions/turn` et ajoute les tours. On ajoute : l'enregistrement micro (qui remplit/branche le même flux `send`), la lecture TTS de la dernière réponse du coach, et un toggle son.

- [ ] **Step 1: Ajouter l'état audio et les fonctions**

Dans `RunClient`, ajouter ces états (près des autres `useState`) :

```typescript
  const [recording, setRecording] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
```

(Ajouter `useRef` à l'import React : `import { useRef, useState } from 'react';`.)

Ajouter une fonction qui joue le TTS d'un texte :

```typescript
  async function playReply(text: string) {
    if (!soundOn) return;
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch {
      // audio is best-effort; ignore failures
    }
  }
```

Refactorer `send` pour accepter le texte en paramètre (au lieu de lire `draft`), et jouer la réponse après. Remplacer la fonction `send` existante par :

```typescript
  async function submitMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending || status !== 'in_progress') return;
    setDraft('');
    setError(null);
    setTurns((t) => [...t, { id: crypto.randomUUID(), role: 'user', content: trimmed, correction: null }]);
    setPending(true);
    try {
      const res = await fetch('/api/missions/turn', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ runId, message: trimmed }),
      });
      if (!res.ok) throw new Error('network');
      const data = (await res.json()) as {
        reply: string;
        correction: string | null;
        status: Status;
        turnsLeft: number;
      };
      setTurns((t) => [
        ...t,
        { id: crypto.randomUUID(), role: 'assistant', content: data.reply, correction: data.correction },
      ]);
      setStatus(data.status);
      setTurnsLeft(data.turnsLeft);
      void playReply(data.reply);
    } catch {
      setError('Petit souci. Réessaie.');
    } finally {
      setPending(false);
    }
  }
```

> Note : ceci suppose que le composant utilise déjà des `Turn` avec un `id` (généré via `crypto.randomUUID()`), comme implémenté en P1. Vérifier le type `Turn` et l'usage existant ; conserver la même forme. Mettre à jour l'appel du formulaire texte pour appeler `submitMessage(draft)`.

- [ ] **Step 2: Ajouter l'enregistrement micro**

Ajouter ces fonctions dans `RunClient` :

```typescript
  async function startRecording() {
    if (recording || pending || status !== 'in_progress') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        for (const track of stream.getTracks()) track.stop();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        await transcribeAndSend(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError('Micro indisponible — autorise-le ou tape ta réponse.');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function transcribeAndSend(blob: Blob) {
    setError(null);
    setPending(true);
    try {
      const form = new FormData();
      form.append('audio', blob, 'speech.webm');
      const res = await fetch('/api/transcribe', { method: 'POST', body: form });
      if (!res.ok) throw new Error('network');
      const { text } = (await res.json()) as { text: string };
      if (!text.trim()) {
        setError("Je n'ai pas bien entendu — réessaie ou tape.");
        setPending(false);
        return;
      }
      setPending(false);
      await submitMessage(text);
    } catch {
      setError('Petit souci de transcription. Réessaie ou tape.');
      setPending(false);
    }
  }
```

- [ ] **Step 3: Ajouter les contrôles dans le rendu**

Dans la branche `status === 'in_progress'`, à côté du formulaire texte existant, ajouter un bouton micro et le toggle son. Insérer au-dessus (ou à côté) du `<form>` :

```tsx
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => (recording ? stopRecording() : void startRecording())}
        >
          {recording ? '⏹ Arrêter' : '🎤 Parler'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setSoundOn((s) => !s)}>
          {soundOn ? '🔊 Son activé' : '🔇 Son coupé'}
        </Button>
      </div>
```

(Et brancher le `<form onSubmit>` pour appeler `submitMessage(draft)` au lieu de l'ancien `send()`.)

- [ ] **Step 4: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint:fix && pnpm lint
```

Expected : 0 erreur. (`MediaRecorder`, `navigator.mediaDevices`, `Audio`, `URL.createObjectURL` sont des types DOM disponibles via `lib: ["dom"]` du tsconfig. Si Biome se plaint de `void startRecording()` dans le ternaire du `onClick`, restructurer en fonction fléchée à corps : `onClick={() => { if (recording) stopRecording(); else void startRecording(); }}`.)

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/missions/[runId]/run-client.tsx"
git commit -m "feat(audio): mic recording and tts playback in mission run"
```

## Reporting back
Report: Status, `pnpm typecheck`, `pnpm lint`, `git show --stat HEAD`, `git status`, toute adaptation faite au composant existant.

---

## Task 7: Faux audio en CI + E2E (niveau API)

**Files:**
- Modify: `playwright.config.ts`, `.github/workflows/ci.yml`
- Create: `tests/e2e/audio.spec.ts`

- [ ] **Step 1: Passer `AUDIO_FAKE=1`**

Dans `playwright.config.ts`, ajouter `AUDIO_FAKE=1` à la commande cross-env non-CI (à côté de `PLACEMENT_FAKE=1 CHAT_FAKE=1 MISSION_FAKE=1`) :

```
pnpm exec dotenv -e .env.test -- cross-env PLACEMENT_FAKE=1 CHAT_FAKE=1 MISSION_FAKE=1 AUDIO_FAKE=1 pnpm next dev
```

Dans `.github/workflows/ci.yml`, sous `env:`, ajouter :

```yaml
      AUDIO_FAKE: '1'
```

- [ ] **Step 2: Écrire le test E2E (niveau API)**

On teste les endpoints audio via l'API Playwright (pas le micro navigateur). Il faut une session authentifiée : on s'inscrit via l'UI puis on réutilise le contexte (les cookies de session sont partagés dans la `page`/`context`).

Créer `tests/e2e/audio.spec.ts` :

```typescript
import { expect, test } from '@playwright/test';

const randomEmail = () => `audio+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@teyen.test`;

async function signupOnly(page: import('@playwright/test').Page) {
  const email = randomEmail();
  const password = 'TestPassword123!';
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: /Créer mon compte/i }).click();
  await expect(page).toHaveURL(/\/onboarding\/placement$/);
}

test('/api/tts returns audio bytes for an authenticated user (fake)', async ({ page }) => {
  await signupOnly(page);
  const res = await page.request.post('/api/tts', { data: { text: 'Hello there' } });
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('audio/mpeg');
  const body = await res.body();
  expect(body.length).toBeGreaterThan(0);
});

test('/api/transcribe returns text for an authenticated user (fake)', async ({ page }) => {
  await signupOnly(page);
  // The fake STT ignores the audio content; send a tiny dummy blob as multipart.
  const res = await page.request.post('/api/transcribe', {
    multipart: {
      audio: { name: 'speech.webm', mimeType: 'audio/webm', buffer: Buffer.from([0, 1, 2, 3]) },
    },
  });
  expect(res.status()).toBe(200);
  const json = (await res.json()) as { text: string };
  expect(json.text.length).toBeGreaterThan(0);
});

test('/api/tts requires auth', async ({ request }) => {
  const res = await request.post('/api/tts', { data: { text: 'hi' } });
  expect(res.status()).toBe(401);
});

test('/api/transcribe requires auth', async ({ request }) => {
  const res = await request.post('/api/transcribe', {
    multipart: { audio: { name: 'speech.webm', mimeType: 'audio/webm', buffer: Buffer.from([0]) } },
  });
  expect(res.status()).toBe(401);
});
```

- [ ] **Step 3: Lancer le test audio**

```bash
pnpm e2e tests/e2e/audio.spec.ts
```

Expected : 4 passed.

Note : si un serveur dev tourne déjà sur :3000 SANS `AUDIO_FAKE`, Playwright le réutilise et les tests appellent le vrai OpenAI. Arrêter ce serveur d'abord (`lsof -ti :3000 | xargs kill`).

- [ ] **Step 4: Suite complète + commit**

```bash
pnpm e2e
pnpm test
pnpm lint
git add tests/e2e/audio.spec.ts playwright.config.ts .github/workflows/ci.yml
git commit -m "test(e2e): audio endpoints (tts bytes, transcribe text, auth guards)"
```

Expected : toute la suite passe.

## Reporting back
Report: Status, output of `pnpm e2e` (count), `pnpm test`, `pnpm lint`, `pnpm typecheck`, `git show --stat HEAD`, `git status`, toute flakiness.

---

## Vérification manuelle (après le plan, avant de partager)

Le flux micro-navigateur ne s'automatise pas de façon fiable. À valider à la main, serveur dev lancé **sans** `AUDIO_FAKE` (vrai OpenAI), connecté, dans une mission :
1. Cliquer **🎤 Parler** → autoriser le micro → dire une phrase en anglais → **⏹ Arrêter**.
2. Vérifier : la transcription apparaît comme ta réplique, le coach répond, et sa réponse est **lue à voix** (réaliste).
3. Tester **🔇 Son coupé** → plus de lecture auto.
4. Tester le refus du micro → message + le champ texte marche toujours.

(Pendant le build, faire un appel réel `openAiStt` sur un petit fichier audio et un `openAiTts` pour confirmer que les modèles répondent ; sinon basculer `STT_MODEL`/`TTS_MODEL` sur `whisper-1`/`tts-1`.)

## Critère de fin

- ✅ `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e` passent.
- ✅ Dans une mission, l'utilisateur peut **parler** (transcrit) ou **taper**, et la réponse du coach est **lue à voix** (toggle son pour couper).
- ✅ Endpoints `/api/transcribe` et `/api/tts` génériques, protégés par auth, fournisseurs échangeables (faux via `AUDIO_FAKE=1`).
- ✅ Aucune nouvelle table ; tour de mission inchangé.

## Ce qui reste

- Brancher l'audio sur le **tuteur libre** (réutilise `/api/transcribe` + `/api/tts`).
- Échanger TTS → **ElevenLabs** si on veut le premium (un seul fichier `tts.ts`).
- **P0** (coque PWA + offline), **P4** (cap de tokens + Mobile Money).
