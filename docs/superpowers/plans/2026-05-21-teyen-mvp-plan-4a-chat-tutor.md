# Teyen MVP — Plan 4a : Tuteur conversationnel (cœur)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un tuteur d'anglais conversationnel : l'utilisateur discute avec une IA (gpt-4o-mini) qui connaît ses niveaux et son profil, corrige son anglais, et peut interroger le moteur pédagogique (outil `get_next_recommendation`) pour lui dire quoi travailler. Conversation persistée. Réponses non-streaming.

**Architecture:** Une route `/api/chat` exécute une **boucle d'agent à outils** : message utilisateur → on persiste → on construit les messages (system prompt injectant l'état de l'utilisateur + N derniers tours) → appel OpenAI avec outils → si l'IA appelle un outil, on le résout côté serveur et on reboucle ; sinon on persiste et renvoie le texte. Le **répondeur** est une interface injectable (`openAiResponder` en prod, `fakeResponder` en test via `CHAT_FAKE=1`) pour des E2E déterministes sans appel OpenAI. Seuls les tours `user`/`assistant` (texte) sont persistés ; les échanges d'outils sont éphémères dans la requête. Les cartes d'exercices interactives dans le chat sont **hors scope** (Plan 4a-bis).

**Tech Stack:** OpenAI SDK (`openai`, function calling), Drizzle (table existante `conversation_turns`), réutilise `src/lib/engine/*` (sélection), `src/lib/cefr.ts`, Next.js 16 (Route Handler + Server Component + client), React 19, Vitest, Playwright.

---

## Contexte : état du projet (fin Plan 3)

Plans 1-3 terminés en local. Pertinent pour ce plan :
- `src/lib/openai.ts` → `openai()` (client), `GENERATION_MODEL` (`'gpt-4o-mini'`).
- `src/lib/cefr.ts` → `levelToLabel`, `clampLevel`.
- `src/lib/exercises/types.ts` → `Skill`, `SKILLS`.
- `src/lib/engine/selection.ts` → `isColdStart`, `selectSkill`, `selectLevel`, `pickTopic`, type `SkillLevel`.
- `src/lib/engine/session.ts` → `selectNextPractice`, `submitPractice` + helpers privés (`loadSkillLevels`, `practiceCount`, `lastPracticeTopic`, `profilePool`, `daySeed`) — **ces helpers sont privés** ; ce plan en ajoute un export `recommendFocus`.
- `src/db/schema.ts` → `conversationTurns` (colonnes : id, userId, sessionId (uuid notNull), role (enum `user`|`assistant`|`tool`|`system_summary`), content (text), toolName (text nullable), toolPayload (jsonb nullable), createdAt). `profiles`, `skillLevels`.
- `src/lib/auth.ts` → `requireUser`, `UnauthorizedError`.
- `src/lib/onboarding/gate.ts` → `requireOnboardingStep`.
- `src/lib/supabase/server.ts` → `createSupabaseServerClient`.
- `src/components/ui/button.tsx` → `Button` ; `src/components/ui/input.tsx` → `Input`.
- Tests E2E lancés avec `PLACEMENT_FAKE=1` (faux générateur). Ce plan ajoute `CHAT_FAKE=1` (faux répondeur de chat).

## Conventions et décisions de ce plan

- **Modèle chat** : `gpt-4o-mini` (constante dédiée `CHAT_MODEL`, distincte de `GENERATION_MODEL` même si même valeur pour l'instant).
- **Non-streaming** : la route attend la réponse complète et la renvoie d'un bloc.
- **Persistance** : une seule conversation continue par utilisateur. `session_id = userId` (les deux sont des uuid). On persiste **uniquement** les tours `role='user'` et `role='assistant'` (texte). Les appels d'outils sont éphémères (non persistés en 4a). Multi-session/résumé : plus tard.
- **Fenêtre de contexte** : on envoie à l'IA le system prompt + les `CHAT_HISTORY_LIMIT = 20` derniers tours.
- **Outils** : un seul outil en 4a — `get_next_recommendation` (sans paramètre ; résolu côté serveur via `recommendFocus`). `launch_exercise`/`report_outcome` (exercices interactifs) → Plan 4a-bis.
- **Garde-fou de boucle** : maximum `MAX_TOOL_ROUNDS = 4` allers-retours d'outils par message, pour éviter une boucle infinie.
- **Langue du tuteur** : répond en anglais, calibré au niveau de l'utilisateur ; peut clarifier brièvement en français si l'utilisateur est débutant (A1-A2) ou explicitement perdu. (Dans le system prompt.)
- **Faux répondeur** (`CHAT_FAKE=1`) : ne contacte pas OpenAI. Au 1ᵉʳ appel d'un message utilisateur, demande l'outil `get_next_recommendation` ; au 2ᵉ appel (après résultat d'outil), renvoie un texte déterministe incluant la compétence recommandée. Valide la boucle + l'outil + la persistance sans OpenAI.

## File Structure

| Fichier | Responsabilité |
|---|---|
| `src/lib/chat/system-prompt.ts` | Pur : construit le system prompt depuis l'état utilisateur |
| `src/lib/engine/session.ts` | (modifié) ajoute l'export `recommendFocus(userId)` |
| `src/lib/chat/tools.ts` | Définition de l'outil `get_next_recommendation` + résolveur |
| `src/lib/chat/persistence.ts` | Charger/enregistrer les `conversation_turns` |
| `src/lib/chat/responder.ts` | Type `ChatResponder`, `openAiResponder`, `fakeResponder`, `getResponder()` |
| `src/lib/chat/agent.ts` | Boucle d'agent : `runChatTurn(userId, message)` |
| `src/app/api/chat/route.ts` | POST message → réponse du tuteur |
| `src/app/(app)/chat/chat-client.tsx` | UI conversation interactive |
| `src/app/(app)/chat/page.tsx` | Page chat (gated 'home'), pré-charge l'historique |
| `src/app/(app)/home/page.tsx` | (modifié) lien vers `/chat` |

## Vue d'ensemble

| # | Tasks |
|---|---|
| Logique / lib | 1–6 |
| API | 7 |
| UI | 8–9 |
| E2E | 10 |

Total : **10 tâches**.

---

## Task 1: System prompt (pur)

**Files:**
- Create: `src/lib/chat/system-prompt.ts`, `src/lib/chat/system-prompt.test.ts`

- [ ] **Step 1: Écrire les tests (TDD)**

Créer `src/lib/chat/system-prompt.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from './system-prompt';

describe('buildSystemPrompt', () => {
  const state = {
    levels: [
      { skill: 'reading' as const, label: 'B1' },
      { skill: 'writing' as const, label: 'A2' },
      { skill: 'vocab' as const, label: 'B1' },
      { skill: 'grammar' as const, label: 'B2' },
    ],
    domains: ['business', 'tech'],
    interests: ['films'],
    goalText: 'pass the TOEFL',
  };

  it('includes the per-skill CEFR levels', () => {
    const p = buildSystemPrompt(state);
    expect(p).toContain('reading: B1');
    expect(p).toContain('writing: A2');
  });

  it('includes the profile domains, interests and goal', () => {
    const p = buildSystemPrompt(state);
    expect(p).toContain('business');
    expect(p).toContain('films');
    expect(p).toContain('pass the TOEFL');
  });

  it('instructs the tutor to reply in English calibrated to the level', () => {
    const p = buildSystemPrompt(state);
    expect(p.toLowerCase()).toContain('english');
  });

  it('handles an empty goal gracefully', () => {
    const p = buildSystemPrompt({ ...state, goalText: '' });
    expect(typeof p).toBe('string');
    expect(p.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
pnpm test src/lib/chat/system-prompt.test.ts
```

Expected : FAIL ("Cannot find module './system-prompt'").

- [ ] **Step 3: Implémenter**

Créer `src/lib/chat/system-prompt.ts` :

```typescript
import type { Skill } from '@/lib/exercises/types';

export type TutorState = {
  levels: { skill: Skill; label: string }[];
  domains: string[];
  interests: string[];
  goalText: string;
};

export function buildSystemPrompt(state: TutorState): string {
  const levelLines = state.levels.map((l) => `- ${l.skill}: ${l.label}`).join('\n');
  const domains = state.domains.length > 0 ? state.domains.join(', ') : '(none chosen)';
  const interests = state.interests.length > 0 ? state.interests.join(', ') : '(none chosen)';
  const goal = state.goalText.trim().length > 0 ? state.goalText.trim() : '(no explicit goal)';

  return [
    'You are Teyen, a friendly, encouraging English tutor for a French-speaking learner.',
    '',
    "The learner's current estimated CEFR levels (A1 lowest, C2 highest):",
    levelLines,
    '',
    `Domains they want to master: ${domains}.`,
    `Interests: ${interests}.`,
    `Their stated goal: ${goal}.`,
    '',
    'Guidelines:',
    '- Reply in English, calibrated to their level (simpler for A1-A2, richer for B2+).',
    '- If they seem lost or are clearly a beginner (A1-A2), you may add a short French clarification in parentheses.',
    '- Gently correct mistakes in their English: show the corrected version and a one-line reason.',
    '- Be concise and conversational. Ask a follow-up question to keep the dialogue going.',
    '- When it is useful to suggest what to practice next, call the get_next_recommendation tool and weave its result into your reply naturally.',
    '- Never invent the learner\'s level; rely on the levels above and the tool.',
  ].join('\n');
}
```

- [ ] **Step 4: Relancer**

```bash
pnpm test src/lib/chat/system-prompt.test.ts
```

Expected : tous les tests passent.

- [ ] **Step 5: Lint + commit**

```bash
pnpm lint:fix && pnpm lint
git add src/lib/chat/system-prompt.ts src/lib/chat/system-prompt.test.ts
git commit -m "feat(chat): pure system-prompt builder from tutor state"
```

---

## Task 2: `recommendFocus` dans le moteur

**Files:**
- Modify: `src/lib/engine/session.ts`

Renvoie la prochaine cible **sans générer ni persister** d'exercice (plus léger que `selectNextPractice`). Réutilise les helpers privés du fichier.

- [ ] **Step 1: Ajouter la fonction**

Dans `src/lib/engine/session.ts`, ajouter l'import de `levelToLabel` et `isColdStart` en complétant les imports existants. En tête, les imports depuis `@/lib/cefr` et `./selection` doivent inclure :

```typescript
import { levelToLabel } from '@/lib/cefr';
import { type SkillLevel, isColdStart, pickTopic, selectLevel, selectSkill } from './selection';
```

(Fusionner avec l'import `./selection` existant ; ajouter `isColdStart` et `levelToLabel`.)

Puis ajouter, à la fin du fichier :

```typescript
export type FocusRecommendation = {
  skill: Skill;
  levelLabel: string;
  topic: string;
  reason: string;
};

// Lightweight: decides what to focus on next WITHOUT generating/persisting an exercise.
export async function recommendFocus(userId: string): Promise<FocusRecommendation> {
  const levels = await loadSkillLevels(userId);
  const count = await practiceCount(userId);
  const seed = daySeed(userId) + count;

  const skill = selectSkill(levels, count, seed);
  const skillLevel = levels.find((l) => l.skill === skill);
  const level = skillLevel ? selectLevel(skillLevel) : 3;
  const topic = pickTopic(await profilePool(userId), await lastPracticeTopic(userId), seed);
  const reason = isColdStart(levels)
    ? 'exploring all four skills to refine the level estimate'
    : 'this is currently the weakest skill';

  return { skill, levelLabel: levelToLabel(level), topic, reason };
}
```

- [ ] **Step 2: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint:fix && pnpm lint
```

Expected : 0 erreur. (`loadSkillLevels`, `practiceCount`, `daySeed`, `profilePool`, `lastPracticeTopic` sont déjà définis en privé dans ce fichier ; `Skill` y est déjà importé.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/engine/session.ts
git commit -m "feat(engine): recommendFocus returns next focus without generating"
```

---

## Task 3: Persistance de la conversation

**Files:**
- Create: `src/lib/chat/persistence.ts`

- [ ] **Step 1: Implémenter**

Créer `src/lib/chat/persistence.ts` :

```typescript
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { conversationTurns } from '@/db/schema';

export const CHAT_HISTORY_LIMIT = 20;

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

// Load the last CHAT_HISTORY_LIMIT user/assistant turns, oldest-first.
export async function loadRecentTurns(userId: string): Promise<ChatTurn[]> {
  const rows = await db
    .select({ role: conversationTurns.role, content: conversationTurns.content })
    .from(conversationTurns)
    .where(
      and(
        eq(conversationTurns.userId, userId),
        inArray(conversationTurns.role, ['user', 'assistant']),
      ),
    )
    .orderBy(desc(conversationTurns.createdAt))
    .limit(CHAT_HISTORY_LIMIT);

  return rows
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }))
    .reverse();
}

export async function saveTurn(
  userId: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<void> {
  await db.insert(conversationTurns).values({
    userId,
    sessionId: userId, // one ongoing conversation per user in the MVP
    role,
    content,
  });
}

// Full history (oldest-first) for rendering the page on load.
export async function loadFullHistory(userId: string): Promise<ChatTurn[]> {
  const rows = await db
    .select({ role: conversationTurns.role, content: conversationTurns.content })
    .from(conversationTurns)
    .where(
      and(
        eq(conversationTurns.userId, userId),
        inArray(conversationTurns.role, ['user', 'assistant']),
      ),
    )
    .orderBy(asc(conversationTurns.createdAt));

  return rows.map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }));
}
```

- [ ] **Step 2: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint:fix && pnpm lint
```

Expected : 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/lib/chat/persistence.ts
git commit -m "feat(chat): conversation turn persistence helpers"
```

---

## Task 4: Définition et résolution de l'outil

**Files:**
- Create: `src/lib/chat/tools.ts`

- [ ] **Step 1: Implémenter**

Créer `src/lib/chat/tools.ts` :

```typescript
import type { OpenAI } from 'openai';
import { recommendFocus } from '@/lib/engine/session';

// OpenAI function-tool definitions exposed to the chat model.
export const CHAT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_next_recommendation',
      description:
        'Returns what the learner should practice next (skill, CEFR level, topic, reason), computed from their current levels and history. Call this when you want to suggest a focus.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
];

// Resolve a tool call by name. Returns a JSON-serialisable result.
export async function resolveTool(userId: string, name: string): Promise<unknown> {
  if (name === 'get_next_recommendation') {
    const reco = await recommendFocus(userId);
    return reco;
  }
  return { error: `unknown tool: ${name}` };
}
```

- [ ] **Step 2: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint:fix && pnpm lint
```

Expected : 0 erreur. (Le type `OpenAI.Chat.Completions.ChatCompletionTool` provient du SDK `openai` 6.x. Si le chemin de type diffère, vérifier `node_modules/openai` et adapter — p.ex. `import type OpenAI from 'openai'` puis `OpenAI.Chat.Completions.ChatCompletionTool`. Garder le type exporté par le SDK.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/chat/tools.ts
git commit -m "feat(chat): get_next_recommendation tool definition and resolver"
```

---

## Task 5: Répondeur (interface + faux + OpenAI)

**Files:**
- Create: `src/lib/chat/responder.ts`, `src/lib/chat/fake-responder.test.ts`

Le répondeur encapsule un tour de dialogue avec le modèle : il reçoit la liste de messages et renvoie soit des appels d'outils, soit un texte final.

- [ ] **Step 1: Écrire le test du faux répondeur (TDD)**

Créer `src/lib/chat/fake-responder.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { fakeResponder } from './responder';

describe('fakeResponder', () => {
  it('requests the recommendation tool when no tool result is present yet', async () => {
    const res = await fakeResponder([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hello' },
    ]);
    expect(res.toolCalls).toHaveLength(1);
    expect(res.toolCalls[0]?.name).toBe('get_next_recommendation');
    expect(res.content).toBeNull();
  });

  it('returns a final text once a tool result is in the messages', async () => {
    const res = await fakeResponder([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: '', toolCalls: [{ id: 't1', name: 'get_next_recommendation', arguments: '{}' }] },
      { role: 'tool', toolCallId: 't1', content: '{"skill":"writing","levelLabel":"A2"}' },
    ]);
    expect(res.toolCalls).toHaveLength(0);
    expect(res.content).toContain('writing');
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
pnpm test src/lib/chat/fake-responder.test.ts
```

Expected : FAIL ("Cannot find module './responder'").

- [ ] **Step 3: Implémenter**

Créer `src/lib/chat/responder.ts` :

```typescript
import OpenAI from 'openai';
import { CHAT_MODEL, openai } from '@/lib/openai';
import { CHAT_TOOLS } from './tools';

// Internal, SDK-agnostic message shape used by the agent loop.
export type AgentMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: { id: string; name: string; arguments: string }[] }
  | { role: 'tool'; toolCallId: string; content: string };

export type ResponderResult = {
  content: string | null;
  toolCalls: { id: string; name: string; arguments: string }[];
};

export type ChatResponder = (messages: AgentMessage[]) => Promise<ResponderResult>;

// --- Fake responder (CHAT_FAKE=1): deterministic, no OpenAI call ---
export const fakeResponder: ChatResponder = async (messages) => {
  const hasToolResult = messages.some((m) => m.role === 'tool');
  if (!hasToolResult) {
    return {
      content: null,
      toolCalls: [{ id: 'fake-1', name: 'get_next_recommendation', arguments: '{}' }],
    };
  }
  const toolMsg = messages.find((m) => m.role === 'tool');
  const reco = toolMsg && toolMsg.role === 'tool' ? toolMsg.content : '{}';
  let skill = 'your weakest skill';
  try {
    const parsed = JSON.parse(reco) as { skill?: string };
    if (parsed.skill) skill = parsed.skill;
  } catch {
    // keep default
  }
  return { content: `Let's work on ${skill} next. What would you like to talk about?`, toolCalls: [] };
};

// --- Real OpenAI responder ---
function toOpenAiMessages(messages: AgentMessage[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (m.role === 'assistant') {
      return {
        role: 'assistant',
        content: m.content,
        ...(m.toolCalls && m.toolCalls.length > 0
          ? {
              tool_calls: m.toolCalls.map((tc) => ({
                id: tc.id,
                type: 'function' as const,
                function: { name: tc.name, arguments: tc.arguments },
              })),
            }
          : {}),
      };
    }
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
    }
    return { role: m.role, content: m.content };
  });
}

export const openAiResponder: ChatResponder = async (messages) => {
  const completion = await openai().chat.completions.create({
    model: CHAT_MODEL,
    messages: toOpenAiMessages(messages),
    tools: CHAT_TOOLS,
  });
  const choice = completion.choices[0]?.message;
  const toolCalls = (choice?.tool_calls ?? [])
    .filter((tc): tc is OpenAI.Chat.Completions.ChatCompletionMessageToolCall => tc.type === 'function')
    .map((tc) => ({ id: tc.id, name: tc.function.name, arguments: tc.function.arguments }));
  return { content: choice?.content ?? null, toolCalls };
};

export function getResponder(): ChatResponder {
  return process.env.CHAT_FAKE === '1' ? fakeResponder : openAiResponder;
}
```

- [ ] **Step 4: Ajouter `CHAT_MODEL` à `src/lib/openai.ts`**

Dans `src/lib/openai.ts`, ajouter après `GENERATION_MODEL` :

```typescript
export const CHAT_MODEL = 'gpt-4o-mini';
```

- [ ] **Step 5: Relancer + vérifier compilation**

```bash
pnpm test src/lib/chat/fake-responder.test.ts
pnpm typecheck
```

Expected : tests passent, typecheck propre. (Si le type `ChatCompletionMessageToolCall` ou le filtre `tc.type === 'function'` diffère dans openai 6.38, adapter en lisant `node_modules/openai/resources/chat/completions/`. Le but : extraire `{id, function.name, function.arguments}` des tool_calls de type function.)

- [ ] **Step 6: Lint + commit**

```bash
pnpm lint:fix && pnpm lint
git add src/lib/chat/responder.ts src/lib/chat/fake-responder.test.ts src/lib/openai.ts
git commit -m "feat(chat): responder interface with fake and openai implementations"
```

---

## Task 6: Boucle d'agent

**Files:**
- Create: `src/lib/chat/agent.ts`

- [ ] **Step 1: Implémenter**

Créer `src/lib/chat/agent.ts` :

```typescript
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles, skillLevels } from '@/db/schema';
import { levelToLabel } from '@/lib/cefr';
import type { Skill } from '@/lib/exercises/types';
import { type AgentMessage, getResponder } from './responder';
import { loadRecentTurns, saveTurn } from './persistence';
import { buildSystemPrompt, type TutorState } from './system-prompt';
import { resolveTool } from './tools';

const MAX_TOOL_ROUNDS = 4;

async function loadTutorState(userId: string): Promise<TutorState> {
  const levelRows = await db.select().from(skillLevels).where(eq(skillLevels.userId, userId));
  const profileRows = await db
    .select({ domains: profiles.domains, interests: profiles.interests, goalText: profiles.goalText })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  const profile = profileRows[0];
  return {
    levels: levelRows.map((r) => ({ skill: r.skill as Skill, label: levelToLabel(Number(r.cefrEstimate)) })),
    domains: profile?.domains ?? [],
    interests: profile?.interests ?? [],
    goalText: profile?.goalText ?? '',
  };
}

// Run one user message through the tutor; persists the user turn and the final
// assistant turn; resolves tool calls server-side in between. Returns the reply.
export async function runChatTurn(userId: string, userMessage: string): Promise<string> {
  await saveTurn(userId, 'user', userMessage);

  const state = await loadTutorState(userId);
  const history = await loadRecentTurns(userId);
  const messages: AgentMessage[] = [
    { role: 'system', content: buildSystemPrompt(state) },
    ...history.map((t) => ({ role: t.role, content: t.content }) as AgentMessage),
  ];

  const respond = getResponder();

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const result = await respond(messages);

    if (result.toolCalls.length === 0) {
      const reply = result.content ?? "Sorry, I didn't catch that. Could you rephrase?";
      await saveTurn(userId, 'assistant', reply);
      return reply;
    }

    // Append the assistant tool-call request, then each tool result.
    messages.push({ role: 'assistant', content: '', toolCalls: result.toolCalls });
    for (const call of result.toolCalls) {
      const toolResult = await resolveTool(userId, call.name);
      messages.push({ role: 'tool', toolCallId: call.id, content: JSON.stringify(toolResult) });
    }
  }

  // Tool-round budget exhausted: return a safe fallback.
  const fallback = "Let's keep it simple — what would you like to practice today?";
  await saveTurn(userId, 'assistant', fallback);
  return fallback;
}
```

- [ ] **Step 2: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint:fix && pnpm lint
```

Expected : 0 erreur.

- [ ] **Step 3: Test d'intégration réel (gated, manuel)**

Vérifier UN vrai tour avec OpenAI (sans `CHAT_FAKE`). Créer un fichier temporaire `src/_chatcheck.ts` :

```typescript
import { runChatTurn } from '@/lib/chat/agent';

async function main() {
  // Use an existing onboarded user id from teyen-dev. Replace <USER_ID> with a real uuid
  // (find one: a user who completed onboarding). If unknown, this check can be skipped.
  const userId = process.env.CHECK_USER_ID;
  if (!userId) {
    console.log('Set CHECK_USER_ID to a real onboarded user uuid to run this check. Skipping.');
    return;
  }
  const reply = await runChatTurn(userId, 'Hi! Can you help me improve my English?');
  console.log('TUTOR:', reply);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Lancer (optionnel mais recommandé une fois) :

```bash
pnpm exec dotenv -e .env.local -- tsx src/_chatcheck.ts
```

Expected : si `CHECK_USER_ID` est fourni, une vraie réponse de tuteur s'affiche (1-2 appels OpenAI). Sinon, message « Skipping ». **Supprimer `src/_chatcheck.ts` après** (`rm src/_chatcheck.ts`).

Note : pour trouver un userId onboardé, regarder dans Supabase Studio (teyen-dev) la table `skill_levels` → copier un `user_id`. Cet appel persiste 2 tours pour cet utilisateur (acceptable).

- [ ] **Step 4: Commit**

```bash
git add src/lib/chat/agent.ts
git commit -m "feat(chat): agent loop running a tutor turn with tool resolution"
```

---

## Task 7: Route API du chat

**Files:**
- Create: `src/app/api/chat/route.ts`

- [ ] **Step 1: Implémenter**

Créer `src/app/api/chat/route.ts` :

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, UnauthorizedError } from '@/lib/auth';
import { runChatTurn } from '@/lib/chat/agent';

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const reply = await runChatTurn(user.id, parsed.data.message);
    return NextResponse.json({ reply });
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
git add src/app/api/chat/route.ts
git commit -m "feat(chat): api route to send a message to the tutor"
```

---

## Task 8: Composant client du chat

**Files:**
- Create: `src/app/(app)/chat/chat-client.tsx`

- [ ] **Step 1: Implémenter**

Créer `src/app/(app)/chat/chat-client.tsx` :

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type HistoryMsg = { role: 'user' | 'assistant'; content: string };
type Msg = HistoryMsg & { id: string };

export function ChatClient({ initialHistory }: { initialHistory: HistoryMsg[] }) {
  const [messages, setMessages] = useState<Msg[]>(() =>
    initialHistory.map((m) => ({ ...m, id: crypto.randomUUID() })),
  );
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const text = draft.trim();
    if (!text || pending) return;
    setDraft('');
    setError(null);
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', content: text }]);
    setPending(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error('network');
      const data = (await res.json()) as { reply: string };
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content: data.reply }]);
    } catch {
      setError('Petit souci. Réessaie.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-[70vh] flex-col gap-4">
      <div className="flex-1 space-y-3 overflow-y-auto rounded-md border border-gray-200 bg-white p-4">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500">Dis bonjour à ton tuteur pour commencer.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <span
              className={`inline-block max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                m.role === 'user' ? 'bg-black text-white' : 'bg-gray-100 text-gray-900'
              }`}
            >
              {m.content}
            </span>
          </div>
        ))}
        {pending && <p className="text-sm text-gray-400">Le tuteur réfléchit…</p>}
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Écris ton message en anglais…"
          aria-label="Message"
          disabled={pending}
        />
        <Button type="submit" disabled={pending || draft.trim().length === 0}>
          Envoyer
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint:fix && pnpm lint
```

Expected : 0 erreur. (Garder le commentaire `biome-ignore` sur la clé d'index : le log de chat est append-only, l'index est une clé stable.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/chat/chat-client.tsx"
git commit -m "feat(chat): interactive chat client"
```

---

## Task 9: Page chat (gated) + lien depuis /home

**Files:**
- Create: `src/app/(app)/chat/page.tsx`
- Modify: `src/app/(app)/home/page.tsx`

- [ ] **Step 1: Page chat**

Créer `src/app/(app)/chat/page.tsx` :

```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireOnboardingStep } from '@/lib/onboarding/gate';
import { loadFullHistory } from '@/lib/chat/persistence';
import { ChatClient } from './chat-client';

export default async function ChatPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await requireOnboardingStep(user.id, 'home');

  const history = user ? await loadFullHistory(user.id) : [];

  return (
    <section className="space-y-6 pt-6">
      <h1 className="text-2xl font-semibold">Ton tuteur</h1>
      <ChatClient initialHistory={history} />
    </section>
  );
}
```

- [ ] **Step 2: Lien depuis /home**

Dans `src/app/(app)/home/page.tsx`, ajouter un lien vers `/chat`. Juste **après** le bloc `<Link href="/practice">...</Link>` existant (ajouté au Plan 3), insérer :

```tsx
      <Link href="/chat">
        <Button variant="ghost">Discuter avec le tuteur</Button>
      </Link>
```

(`Link` et `Button` sont déjà importés depuis le Plan 3 ; ne pas ré-importer.)

- [ ] **Step 3: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint:fix && pnpm lint
```

Expected : 0 erreur.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/chat/page.tsx" "src/app/(app)/home/page.tsx"
git commit -m "feat(chat): chat page gated to onboarded users and home link"
```

---

## Task 10: Test E2E du chat (faux répondeur)

**Files:**
- Create: `tests/e2e/chat.spec.ts`
- Modify: `playwright.config.ts`, `.github/workflows/ci.yml`

- [ ] **Step 1: Passer `CHAT_FAKE=1` au serveur dev de Playwright et au CI**

Dans `playwright.config.ts`, la commande `webServer.command` du cas non-CI passe déjà `PLACEMENT_FAKE=1` via cross-env. Ajouter `CHAT_FAKE=1` à la même commande cross-env. La commande non-CI doit devenir :

```typescript
        command: process.env.CI
          ? 'pnpm next dev'
          : 'pnpm exec dotenv -e .env.test -- cross-env PLACEMENT_FAKE=1 CHAT_FAKE=1 pnpm next dev',
```

(cross-env accepte plusieurs `KEY=val` avant la commande.)

Et dans `.github/workflows/ci.yml`, sous le bloc `env:` du job (où `PLACEMENT_FAKE: '1'` est déjà défini), ajouter :

```yaml
      CHAT_FAKE: '1'
```

- [ ] **Step 2: Écrire le test E2E**

Créer `tests/e2e/chat.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';

const randomEmail = () => `chat+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@teyen.test`;

async function completeOnboarding(page: import('@playwright/test').Page) {
  const email = randomEmail();
  const password = 'TestPassword123!';
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: /Créer mon compte/i }).click();
  await expect(page).toHaveURL(/\/onboarding\/placement$/);
  for (let i = 0; i < 12; i++) {
    await expect(page.getByText(/Question \d+ \/ 12/)).toBeVisible();
    await page.getByRole('button', { name: 'option A' }).click();
  }
  await expect(page).toHaveURL(/\/onboarding\/profile$/);
  await page.getByLabel(/Business/i).check();
  await page.getByRole('button', { name: /Terminer/i }).click();
  await expect(page).toHaveURL(/\/home$/);
}

test('an onboarded user can chat with the tutor and gets a reply', async ({ page }) => {
  await completeOnboarding(page);

  await page.getByRole('link', { name: /Discuter avec le tuteur/i }).click();
  await expect(page).toHaveURL(/\/chat$/);

  await page.getByLabel('Message').fill('Hello, can you help me?');
  await page.getByRole('button', { name: /Envoyer/i }).click();

  // The user message appears, then the fake tutor reply mentioning the recommended skill.
  await expect(page.getByText('Hello, can you help me?')).toBeVisible();
  await expect(page.getByText(/Let's work on/i)).toBeVisible();
});

test('/api/chat requires auth', async ({ request }) => {
  const res = await request.post('/api/chat', { data: { message: 'hi' } });
  expect(res.status()).toBe(401);
});

test('chat history persists across reloads', async ({ page }) => {
  await completeOnboarding(page);
  await page.goto('/chat');
  await page.getByLabel('Message').fill('Remember this message');
  await page.getByRole('button', { name: /Envoyer/i }).click();
  await expect(page.getByText(/Let's work on/i)).toBeVisible();

  await page.reload();
  await expect(page.getByText('Remember this message')).toBeVisible();
});
```

- [ ] **Step 3: Lancer le test chat**

```bash
pnpm e2e tests/e2e/chat.spec.ts
```

Expected : 3 passed. (Le faux répondeur renvoie un texte contenant « Let's work on <skill> ». Confirme la boucle outil + persistance.)

- [ ] **Step 4: Suite complète + commit**

```bash
pnpm e2e
pnpm test
pnpm lint
git add tests/e2e/chat.spec.ts playwright.config.ts .github/workflows/ci.yml
git commit -m "test(e2e): tutor chat reply, auth guard and history persistence"
```

Expected : toute la suite passe (auth + onboarding + practice + chat ; tous les unitaires).

---

## Critère de fin de Plan 4a

- ✅ `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e` passent.
- ✅ Un utilisateur onboardé ouvre `/chat`, envoie un message, reçoit une réponse du tuteur.
- ✅ Le tuteur peut appeler `get_next_recommendation` (boucle d'outil fonctionnelle) et l'historique est persisté/rechargé.
- ✅ Les E2E utilisent le faux répondeur (`CHAT_FAKE=1`) — aucun appel OpenAI ; un vrai tour OpenAI validé manuellement une fois.

## Ce qui reste (sous-plans suivants)

- **Plan 4a-bis** : exercices interactifs DANS le chat (outils `launch_exercise` + `report_outcome`, cartes QCM rendues dans le fil, boucle réponse→feedback du tuteur).
- **Plan 4b** : type `short_writing` + LLM-juge (rubrique grammar/lexicon/task).
- **Plan 4c** : types non-QCM (`fill_blank`, `translate_*`, `vocab_recall` en saisie libre).
- **Plan 4d** : Leitner / `knowledge_items` (extraction du vocab des conversations + révision espacée).
- **Plan 5** : progress tracker, série de jours, **résumé de conversation** (compression au-delà de N tours), cost cap, suppression de compte.
- **Déploiement** : Tasks 26-27 de Plan 1 (GitHub + Vercel).
