# Teyen — Moteur de missions/roleplay (P1) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un mode « Missions » : l'utilisateur joue un roleplay structuré (objectif, vocab, 3-5 tours), un coach IA répond et corrige, la mission se termine en succès (objectif atteint) ou « à retravailler » (limite de tours).

**Architecture:** Runtime de mission dédié. Catalogue de missions internationales en code. À chaque tour utilisateur, un appel LLM en Structured Outputs renvoie `{reply, objectiveMet, correction}` ; une machine à états pure décide du statut. Deux tables (`mission_runs`, `mission_turns`) isolées du chat libre. Réutilise client OpenAI, helpers CEFR, patterns Drizzle/Structured-Outputs existants.

**Tech Stack:** Next.js 16 (Route Handlers + Server Components + client), React 19, Drizzle, OpenAI (`zodResponseFormat`), Zod 4, Vitest, Playwright. Faux répondeur via `MISSION_FAKE=1`.

---

## Contexte : état du projet

Plans 1-4a faits + features post-MVP (nav header, choix de catégorie en pratique). Pertinent ici :
- `src/lib/openai.ts` → `openai()`, `GENERATION_MODEL`, `CHAT_MODEL` (tous `'gpt-4o-mini'`).
- `src/lib/cefr.ts` → `levelToLabel`, `clampLevel`, `CEFR_LABELS`, type `CefrLabel`.
- `src/lib/exercises/generator.ts` → patron `zodResponseFormat` + `openai().chat.completions.parse` (à reproduire).
- `src/db/index.ts` → `db` ; `src/db/schema.ts` → tables + enums (`turnRole` existe : `user|assistant|tool|system_summary`). `skillLevels` (cefrEstimate numeric→string).
- `src/lib/auth.ts` → `requireUser`, `UnauthorizedError`.
- `src/lib/onboarding/gate.ts` → `requireOnboardingStep`.
- `src/lib/supabase/server.ts` → `createSupabaseServerClient`.
- `src/components/ui/button.tsx` → `Button` ; `src/components/ui/input.tsx` → `Input`.
- `src/components/app-nav.tsx` → nav header (liens Accueil/Pratique/Tuteur ; à étendre).
- Migrations Drizzle : `pnpm db:generate` puis `pnpm db:migrate` (dev) et `pnpm db:migrate:test` (test). Tests E2E lancés avec `PLACEMENT_FAKE=1 CHAT_FAKE=1` (cross-env) ; on ajoute `MISSION_FAKE=1`.
- Spec : `docs/superpowers/specs/2026-05-22-missions-engine-design.md`.

## File Structure

| Fichier | Responsabilité |
|---|---|
| `src/lib/missions/types.ts` | Type `Mission`, `MissionStatus`, schéma Zod `missionTurnSchema`, type `MissionTurn` |
| `src/lib/missions/catalog.ts` | Bibliothèque statique de missions + `getMission(id)`, `ALL_MISSIONS` |
| `src/lib/missions/state.ts` | Pur : `advance`, `turnsLeft`, `DEFAULT_TURN_LIMIT` |
| `src/lib/missions/prompt.ts` | Pur : `buildMissionPrompt(mission)` |
| `src/lib/missions/responder.ts` | `MissionResponder`, `fakeMissionResponder`, `openAiMissionResponder`, `getMissionResponder()` |
| `src/lib/missions/runtime.ts` | DB : `startRun`, `submitTurn`, `loadRun`, `listRunsByUser` |
| `src/app/api/missions/start/route.ts` | POST start |
| `src/app/api/missions/turn/route.ts` | POST turn |
| `src/app/(app)/missions/page.tsx` | Liste (server, gated) |
| `src/app/(app)/missions/mission-list.tsx` | Client : grille + démarrage |
| `src/app/(app)/missions/[runId]/page.tsx` | Page de run (server, gated) |
| `src/app/(app)/missions/[runId]/run-client.tsx` | Client : déroulé du run |
| `src/db/schema.ts` | (modifié) enum `mission_run_status` + tables `mission_runs`, `mission_turns` |
| `src/components/app-nav.tsx` | (modifié) lien « Missions » |
| `playwright.config.ts`, `.github/workflows/ci.yml` | (modifié) `MISSION_FAKE=1` |

## Vue d'ensemble

| # | Phase | Tasks |
|---|---|---|
| A | Schéma DB | 1 |
| B | Logique pure + contenu | 2–5 |
| C | Répondeur + runtime | 6–7 |
| D | Routes API | 8–9 |
| E | UI | 10–12 |
| F | Nav + E2E | 13–14 |

Total : **14 tâches**.

---

## Task 1: Schéma DB (tables missions)

**Files:**
- Modify: `src/db/schema.ts`
- Create (généré) : `src/db/migrations/0003_*.sql`

- [ ] **Step 1: Ajouter l'enum et les tables au schéma**

Dans `src/db/schema.ts`, ajouter (après les enums existants pour l'enum, et après les tables existantes pour les tables) :

```typescript
export const missionRunStatus = pgEnum('mission_run_status', [
  'in_progress',
  'success',
  'incomplete',
]);

export const missionRuns = pgTable(
  'mission_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    missionId: text('mission_id').notNull(),
    status: missionRunStatus('status').notNull().default('in_progress'),
    turnCount: integer('turn_count').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => ({
    userStartedIdx: index('mission_runs_user_started_idx').on(t.userId, t.startedAt),
  }),
);

export const missionTurns = pgTable(
  'mission_turns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => missionRuns.id, { onDelete: 'cascade' }),
    role: turnRole('role').notNull(),
    content: text('content').notNull(),
    correction: text('correction'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    runCreatedIdx: index('mission_turns_run_created_idx').on(t.runId, t.createdAt),
  }),
);
```

(Vérifier que `pgEnum`, `pgTable`, `uuid`, `text`, `integer`, `timestamp`, `index` sont déjà importés en tête du fichier — ils le sont pour les tables existantes ; sinon compléter l'import depuis `drizzle-orm/pg-core`.)

- [ ] **Step 2: Générer la migration**

```bash
pnpm db:generate
```

Expected : crée `src/db/migrations/0003_*.sql` créant l'enum `mission_run_status` + tables `mission_runs`, `mission_turns`. Ouvrir le fichier et vérifier.

- [ ] **Step 3: Appliquer sur dev et test**

```bash
pnpm db:migrate
pnpm db:migrate:test
```

Expected : `Migrations applied.` deux fois.

- [ ] **Step 4: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint:fix && pnpm lint
```

Expected : 0 erreur.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/migrations
git commit -m "feat(db): mission_runs and mission_turns tables"
```

---

## Task 2: Types et schéma de tour

**Files:**
- Create: `src/lib/missions/types.ts`, `src/lib/missions/types.test.ts`

- [ ] **Step 1: Écrire le test (TDD)**

Créer `src/lib/missions/types.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { missionTurnSchema } from './types';

describe('missionTurnSchema', () => {
  it('accepts a well-formed turn with a correction', () => {
    const parsed = missionTurnSchema.parse({
      reply: 'Sure, a table for two?',
      objectiveMet: false,
      correction: "On dit 'I would like', pas 'I want'.",
    });
    expect(parsed.objectiveMet).toBe(false);
    expect(parsed.correction).not.toBeNull();
  });

  it('accepts a null correction', () => {
    const parsed = missionTurnSchema.parse({
      reply: 'Great, see you at 8pm.',
      objectiveMet: true,
      correction: null,
    });
    expect(parsed.correction).toBeNull();
    expect(parsed.objectiveMet).toBe(true);
  });

  it('rejects a missing reply', () => {
    expect(() =>
      missionTurnSchema.parse({ objectiveMet: false, correction: null }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
pnpm test src/lib/missions/types.test.ts
```

Expected : FAIL ("Cannot find module './types'").

- [ ] **Step 3: Implémenter**

Créer `src/lib/missions/types.ts` :

```typescript
import { z } from 'zod';
import type { CefrLabel } from '@/lib/cefr';

export type Mission = {
  id: string;
  title: string;
  scenario: string;
  objective: string;
  requiredVocab: string[];
  cefr: CefrLabel;
  turnLimit: number;
  opener: string;
};

export type MissionStatus = 'in_progress' | 'success' | 'incomplete';

export const missionTurnSchema = z.object({
  reply: z.string().min(1),
  objectiveMet: z.boolean(),
  correction: z.string().nullable(),
});

export type MissionTurn = z.infer<typeof missionTurnSchema>;
```

- [ ] **Step 4: Relancer**

```bash
pnpm test src/lib/missions/types.test.ts
```

Expected : 3 passed.

- [ ] **Step 5: Lint + commit**

```bash
pnpm lint:fix && pnpm lint
git add src/lib/missions/types.ts src/lib/missions/types.test.ts
git commit -m "feat(missions): mission types and per-turn schema"
```

---

## Task 3: Catalogue de missions

**Files:**
- Create: `src/lib/missions/catalog.ts`, `src/lib/missions/catalog.test.ts`

- [ ] **Step 1: Écrire le test (TDD)**

Créer `src/lib/missions/catalog.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { CEFR_LABELS } from '@/lib/cefr';
import { ALL_MISSIONS, getMission } from './catalog';

describe('mission catalog', () => {
  it('has at least 10 missions', () => {
    expect(ALL_MISSIONS.length).toBeGreaterThanOrEqual(10);
  });

  it('has unique ids', () => {
    const ids = ALL_MISSIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every mission is well-formed', () => {
    for (const m of ALL_MISSIONS) {
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.scenario.length).toBeGreaterThan(0);
      expect(m.objective.length).toBeGreaterThan(0);
      expect(m.opener.length).toBeGreaterThan(0);
      expect(m.requiredVocab.length).toBeGreaterThan(0);
      expect(m.turnLimit).toBeGreaterThanOrEqual(3);
      expect(m.turnLimit).toBeLessThanOrEqual(5);
      expect(CEFR_LABELS).toContain(m.cefr);
    }
  });

  it('getMission returns a mission by id and undefined otherwise', () => {
    const first = ALL_MISSIONS[0];
    expect(first).toBeDefined();
    if (first) {
      expect(getMission(first.id)?.id).toBe(first.id);
    }
    expect(getMission('does-not-exist')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
pnpm test src/lib/missions/catalog.test.ts
```

Expected : FAIL ("Cannot find module './catalog'").

- [ ] **Step 3: Implémenter**

Créer `src/lib/missions/catalog.ts` :

```typescript
import type { Mission } from './types';

export const ALL_MISSIONS: Mission[] = [
  {
    id: 'restaurant-order',
    title: 'Commander au restaurant',
    scenario: 'You are a waiter at a casual restaurant. The learner is a customer who just sat down.',
    objective: 'The customer orders at least a main dish and a drink.',
    requiredVocab: ['I would like', 'a table', 'the menu', 'please'],
    cefr: 'A2',
    turnLimit: 5,
    opener: "Good evening! Welcome. Here's the menu — can I get you something to drink first?",
  },
  {
    id: 'ask-directions',
    title: 'Demander son chemin',
    scenario: 'You are a friendly passer-by in a city. The learner is a lost tourist.',
    objective: 'The tourist asks how to reach the train station and confirms understanding.',
    requiredVocab: ['excuse me', 'how do I get to', 'turn left', 'is it far'],
    cefr: 'A2',
    turnLimit: 4,
    opener: 'Hi there! You look a little lost — do you need some help?',
  },
  {
    id: 'hotel-booking',
    title: 'Réserver une chambre d’hôtel',
    scenario: 'You are a hotel receptionist. The learner wants to book a room.',
    objective: 'The guest books a room for specific dates and asks about breakfast.',
    requiredVocab: ['I would like to book', 'a single/double room', 'check-in', 'is breakfast included'],
    cefr: 'B1',
    turnLimit: 5,
    opener: 'Good afternoon, welcome to The Grand Hotel. How can I help you today?',
  },
  {
    id: 'self-introduction',
    title: 'Se présenter brièvement',
    scenario: 'You are a new colleague meeting the learner on their first day.',
    objective: 'The learner introduces themselves: name, role, and one interest.',
    requiredVocab: ['my name is', 'I work as', 'nice to meet you', 'I enjoy'],
    cefr: 'A2',
    turnLimit: 4,
    opener: "Hi! I don't think we've met — I'm Alex, I work in marketing. And you?",
  },
  {
    id: 'customer-complaint',
    title: 'Faire une réclamation',
    scenario: 'You are customer support for an online shop. The learner received a damaged product.',
    objective: 'The customer explains the problem and requests a refund or replacement.',
    requiredVocab: ['I would like to complain', 'damaged', 'a refund', 'as soon as possible'],
    cefr: 'B1',
    turnLimit: 5,
    opener: 'Hello, thank you for contacting support. How can I help you today?',
  },
  {
    id: 'job-interview',
    title: 'Entretien d’embauche',
    scenario: 'You are a hiring manager interviewing the learner for a junior role.',
    objective: 'The candidate states a strength and asks one question about the role.',
    requiredVocab: ['my strength is', 'I have experience in', 'could you tell me', 'I am interested in'],
    cefr: 'B2',
    turnLimit: 5,
    opener: 'Thanks for coming in today. To start, could you tell me a bit about yourself?',
  },
  {
    id: 'team-meeting',
    title: 'Donner son avis en réunion',
    scenario: 'You are leading a short team meeting. The learner is a team member.',
    objective: 'The learner gives an opinion on the plan and suggests one improvement.',
    requiredVocab: ['I think that', 'in my opinion', 'we could', 'I suggest'],
    cefr: 'B2',
    turnLimit: 5,
    opener: "Okay everyone — here's the plan for next week. What do you think?",
  },
  {
    id: 'doctor-appointment',
    title: 'Prendre rendez-vous médical',
    scenario: 'You are a receptionist at a medical clinic. The learner wants an appointment.',
    objective: 'The learner books an appointment and describes a symptom.',
    requiredVocab: ['I would like an appointment', 'I have a', 'available', 'thank you'],
    cefr: 'B1',
    turnLimit: 4,
    opener: 'Good morning, City Clinic, how can I help you?',
  },
  {
    id: 'small-talk-work',
    title: 'Small talk au travail',
    scenario: 'You are a colleague chatting with the learner near the coffee machine.',
    objective: 'The learner keeps the conversation going for a few exchanges about the weekend.',
    requiredVocab: ['how was your weekend', 'I went to', 'sounds great', 'what about you'],
    cefr: 'B1',
    turnLimit: 4,
    opener: 'Morning! Did you have a good weekend?',
  },
  {
    id: 'negotiate-price',
    title: 'Négocier un prix',
    scenario: 'You are a seller at a market stall. The learner wants to buy and negotiate.',
    objective: 'The buyer makes a counter-offer and reaches an agreement.',
    requiredVocab: ['how much is', 'that is too expensive', 'can you lower', 'it is a deal'],
    cefr: 'B1',
    turnLimit: 5,
    opener: 'Hello, my friend! Beautiful bag, isn’t it? Only fifty dollars for you.',
  },
  {
    id: 'phone-reschedule',
    title: 'Reporter un rendez-vous par téléphone',
    scenario: 'You answer the phone at an office. The learner needs to reschedule a meeting.',
    objective: 'The learner explains they cannot attend and proposes a new time.',
    requiredVocab: ['I am calling about', 'I am afraid', 'could we reschedule', 'does that work'],
    cefr: 'B2',
    turnLimit: 4,
    opener: 'Good morning, Brightline Office, how can I help you?',
  },
  {
    id: 'opinion-debate',
    title: 'Défendre une opinion',
    scenario: 'You are a friend having a friendly debate with the learner about remote work.',
    objective: 'The learner states and supports an opinion with at least one reason.',
    requiredVocab: ['I believe', 'on the other hand', 'for example', 'that is why'],
    cefr: 'C1',
    turnLimit: 5,
    opener: 'Honestly, I think remote work makes people less productive. What’s your take?',
  },
];

export function getMission(id: string): Mission | undefined {
  return ALL_MISSIONS.find((m) => m.id === id);
}
```

- [ ] **Step 4: Relancer**

```bash
pnpm test src/lib/missions/catalog.test.ts
```

Expected : 4 passed.

- [ ] **Step 5: Lint + commit**

```bash
pnpm lint:fix && pnpm lint
git add src/lib/missions/catalog.ts src/lib/missions/catalog.test.ts
git commit -m "feat(missions): curated international scenario catalog"
```

---

## Task 4: Machine à états (pure)

**Files:**
- Create: `src/lib/missions/state.ts`, `src/lib/missions/state.test.ts`

- [ ] **Step 1: Écrire le test (TDD)**

Créer `src/lib/missions/state.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { DEFAULT_TURN_LIMIT, advance, turnsLeft } from './state';

describe('mission state machine', () => {
  it('exposes a default turn limit between 3 and 5', () => {
    expect(DEFAULT_TURN_LIMIT).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_TURN_LIMIT).toBeLessThanOrEqual(5);
  });

  it('marks success when the objective is met', () => {
    const next = advance({ status: 'in_progress', turnCount: 0 }, true, 5);
    expect(next.status).toBe('success');
    expect(next.turnCount).toBe(1);
  });

  it('stays in progress when objective not met and turns remain', () => {
    const next = advance({ status: 'in_progress', turnCount: 0 }, false, 5);
    expect(next.status).toBe('in_progress');
    expect(next.turnCount).toBe(1);
  });

  it('marks incomplete when the turn limit is reached without success', () => {
    const next = advance({ status: 'in_progress', turnCount: 4 }, false, 5);
    expect(next.status).toBe('incomplete');
    expect(next.turnCount).toBe(5);
  });

  it('computes remaining turns, floored at 0', () => {
    expect(turnsLeft({ status: 'in_progress', turnCount: 2 }, 5)).toBe(3);
    expect(turnsLeft({ status: 'incomplete', turnCount: 5 }, 5)).toBe(0);
    expect(turnsLeft({ status: 'in_progress', turnCount: 7 }, 5)).toBe(0);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
pnpm test src/lib/missions/state.test.ts
```

Expected : FAIL ("Cannot find module './state'").

- [ ] **Step 3: Implémenter**

Créer `src/lib/missions/state.ts` :

```typescript
import type { MissionStatus } from './types';

export const DEFAULT_TURN_LIMIT = 5;

export type RunState = { status: MissionStatus; turnCount: number };

export function advance(state: RunState, objectiveMet: boolean, turnLimit: number): RunState {
  const turnCount = state.turnCount + 1;
  if (objectiveMet) return { status: 'success', turnCount };
  if (turnCount >= turnLimit) return { status: 'incomplete', turnCount };
  return { status: 'in_progress', turnCount };
}

export function turnsLeft(state: RunState, turnLimit: number): number {
  return Math.max(0, turnLimit - state.turnCount);
}
```

- [ ] **Step 4: Relancer**

```bash
pnpm test src/lib/missions/state.test.ts
```

Expected : 5 passed.

- [ ] **Step 5: Lint + commit**

```bash
pnpm lint:fix && pnpm lint
git add src/lib/missions/state.ts src/lib/missions/state.test.ts
git commit -m "feat(missions): pure run state machine"
```

---

## Task 5: Prompt système (pur)

**Files:**
- Create: `src/lib/missions/prompt.ts`, `src/lib/missions/prompt.test.ts`

- [ ] **Step 1: Écrire le test (TDD)**

Créer `src/lib/missions/prompt.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { buildMissionPrompt } from './prompt';
import type { Mission } from './types';

const mission: Mission = {
  id: 'restaurant-order',
  title: 'Commander au restaurant',
  scenario: 'You are a waiter at a casual restaurant.',
  objective: 'The customer orders a main dish and a drink.',
  requiredVocab: ['I would like', 'the menu'],
  cefr: 'A2',
  turnLimit: 5,
  opener: 'Welcome!',
};

describe('buildMissionPrompt', () => {
  it('includes the scenario, objective, vocab and CEFR level', () => {
    const p = buildMissionPrompt(mission);
    expect(p).toContain(mission.scenario);
    expect(p).toContain(mission.objective);
    expect(p).toContain('I would like');
    expect(p).toContain('A2');
  });

  it('instructs to reply in English and keep it short', () => {
    const p = buildMissionPrompt(mission).toLowerCase();
    expect(p).toContain('english');
    expect(p).toContain('objectivemet');
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
pnpm test src/lib/missions/prompt.test.ts
```

Expected : FAIL ("Cannot find module './prompt'").

- [ ] **Step 3: Implémenter**

Créer `src/lib/missions/prompt.ts` :

```typescript
import type { Mission } from './types';

export function buildMissionPrompt(mission: Mission): string {
  return [
    'You are a warm, encouraging English coach running a roleplay with a French-speaking learner.',
    `Scenario: ${mission.scenario}`,
    `The learner's goal (objective): ${mission.objective}`,
    `Target CEFR level: ${mission.cefr} — calibrate your English to it.`,
    `Try to naturally elicit this vocabulary: ${mission.requiredVocab.join(', ')}.`,
    '',
    'Rules for every reply:',
    '- Stay fully in character for the scenario.',
    '- Reply in English, max ~30 words (keep it short).',
    '- Gently correct the learner: put a brief correction in French in the "correction" field (or null if nothing to fix).',
    '- Set "objectiveMet" to true ONLY when the learner has actually achieved the objective above.',
    '- Keep the roleplay moving with a natural follow-up.',
    'Respond as structured data with fields: reply, objectiveMet, correction.',
  ].join('\n');
}
```

- [ ] **Step 4: Relancer**

```bash
pnpm test src/lib/missions/prompt.test.ts
```

Expected : 2 passed.

- [ ] **Step 5: Lint + commit**

```bash
pnpm lint:fix && pnpm lint
git add src/lib/missions/prompt.ts src/lib/missions/prompt.test.ts
git commit -m "feat(missions): pure mission system-prompt builder"
```

---

## Task 6: Répondeur (faux + OpenAI)

**Files:**
- Create: `src/lib/missions/responder.ts`, `src/lib/missions/fake-responder.test.ts`
- Modify: `src/lib/openai.ts`

- [ ] **Step 1: Écrire le test du faux répondeur (TDD)**

Créer `src/lib/missions/fake-responder.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { fakeMissionResponder } from './responder';

describe('fakeMissionResponder', () => {
  it('does not mark the objective met for a normal message', async () => {
    const res = await fakeMissionResponder('system', [{ role: 'user', content: 'Hello there' }]);
    expect(res.objectiveMet).toBe(false);
    expect(res.reply.length).toBeGreaterThan(0);
  });

  it('marks the objective met when the user message contains "success"', async () => {
    const res = await fakeMissionResponder('system', [
      { role: 'user', content: 'I think this is a success' },
    ]);
    expect(res.objectiveMet).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
pnpm test src/lib/missions/fake-responder.test.ts
```

Expected : FAIL ("Cannot find module './responder'").

- [ ] **Step 3: Ajouter `MISSION_MODEL` à `src/lib/openai.ts`**

Dans `src/lib/openai.ts`, après `CHAT_MODEL` :

```typescript
export const MISSION_MODEL = 'gpt-4o-mini';
```

- [ ] **Step 4: Implémenter le répondeur**

Créer `src/lib/missions/responder.ts` :

```typescript
import { zodResponseFormat } from 'openai/helpers/zod';
import { MISSION_MODEL, openai } from '@/lib/openai';
import { type MissionTurn, missionTurnSchema } from './types';

export type MissionMessage = { role: 'user' | 'assistant'; content: string };

export type MissionResponder = (
  systemPrompt: string,
  history: MissionMessage[],
) => Promise<MissionTurn>;

// Deterministic fake (MISSION_FAKE=1): objective met when the last user message says "success".
export const fakeMissionResponder: MissionResponder = async (_systemPrompt, history) => {
  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  const objectiveMet = (lastUser?.content ?? '').toLowerCase().includes('success');
  return {
    reply: objectiveMet ? 'Perfect, all done!' : 'Okay, go on — tell me more.',
    objectiveMet,
    correction: null,
  };
};

export const openAiMissionResponder: MissionResponder = async (systemPrompt, history) => {
  const completion = await openai().chat.completions.parse({
    model: MISSION_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content }) as const),
    ],
    response_format: zodResponseFormat(missionTurnSchema, 'mission_turn'),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error('OpenAI returned no parsed mission turn');
  }
  return parsed;
};

export function getMissionResponder(): MissionResponder {
  return process.env.MISSION_FAKE === '1' ? fakeMissionResponder : openAiMissionResponder;
}
```

- [ ] **Step 5: Relancer + typecheck**

```bash
pnpm test src/lib/missions/fake-responder.test.ts
pnpm typecheck
```

Expected : 2 passed, typecheck propre. (Si la signature `chat.completions.parse` ou `zodResponseFormat` diffère, s'aligner sur `src/lib/exercises/generator.ts` qui utilise exactement le même patron avec le SDK installé.)

- [ ] **Step 6: Lint + commit**

```bash
pnpm lint:fix && pnpm lint
git add src/lib/missions/responder.ts src/lib/missions/fake-responder.test.ts src/lib/openai.ts
git commit -m "feat(missions): mission turn responder (fake + openai structured output)"
```

---

## Task 7: Runtime (couche DB)

**Files:**
- Create: `src/lib/missions/runtime.ts`

Pas de test unitaire (code DB) ; couvert par l'E2E (Task 14) + typecheck.

- [ ] **Step 1: Implémenter**

Créer `src/lib/missions/runtime.ts` :

```typescript
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { missionRuns, missionTurns } from '@/db/schema';
import { getMission } from './catalog';
import { buildMissionPrompt } from './prompt';
import { type MissionResponder } from './responder';
import { advance, turnsLeft } from './state';
import type { MissionStatus } from './types';

export class MissionError extends Error {
  constructor(
    message: string,
    public code: 'not_found' | 'forbidden' | 'finished',
  ) {
    super(message);
    this.name = 'MissionError';
  }
}

export async function startRun(
  userId: string,
  missionId: string,
): Promise<{ runId: string; opener: string; objective: string; turnLimit: number }> {
  const mission = getMission(missionId);
  if (!mission) throw new MissionError('unknown mission', 'not_found');

  const inserted = await db
    .insert(missionRuns)
    .values({ userId, missionId, status: 'in_progress', turnCount: 0 })
    .returning({ id: missionRuns.id });
  const run = inserted[0];
  if (!run) throw new Error('failed to create mission run');

  await db.insert(missionTurns).values({ runId: run.id, role: 'assistant', content: mission.opener });

  return {
    runId: run.id,
    opener: mission.opener,
    objective: mission.objective,
    turnLimit: mission.turnLimit,
  };
}

export async function loadRun(userId: string, runId: string) {
  const rows = await db.select().from(missionRuns).where(eq(missionRuns.id, runId)).limit(1);
  const run = rows[0];
  if (!run) throw new MissionError('run not found', 'not_found');
  if (run.userId !== userId) throw new MissionError('not your run', 'forbidden');
  const mission = getMission(run.missionId);
  if (!mission) throw new MissionError('mission missing from catalog', 'not_found');

  const turns = await db
    .select({ role: missionTurns.role, content: missionTurns.content, correction: missionTurns.correction })
    .from(missionTurns)
    .where(eq(missionTurns.runId, runId))
    .orderBy(asc(missionTurns.createdAt));

  return { run, mission, turns };
}

export async function submitTurn(
  userId: string,
  runId: string,
  message: string,
  respond: MissionResponder,
): Promise<{ reply: string; correction: string | null; status: MissionStatus; turnsLeft: number }> {
  const { run, mission, turns } = await loadRun(userId, runId);
  if (run.status !== 'in_progress') throw new MissionError('run already finished', 'finished');

  await db.insert(missionTurns).values({ runId, role: 'user', content: message });

  const history = [
    ...turns.map((t) => ({ role: t.role as 'user' | 'assistant', content: t.content })),
    { role: 'user' as const, content: message },
  ];
  const result = await respond(buildMissionPrompt(mission), history);

  const nextState = advance({ status: 'in_progress', turnCount: run.turnCount }, result.objectiveMet, mission.turnLimit);

  await db.insert(missionTurns).values({
    runId,
    role: 'assistant',
    content: result.reply,
    correction: result.correction,
  });

  await db
    .update(missionRuns)
    .set({
      status: nextState.status,
      turnCount: nextState.turnCount,
      endedAt: nextState.status === 'in_progress' ? null : new Date(),
    })
    .where(eq(missionRuns.id, runId));

  return {
    reply: result.reply,
    correction: result.correction,
    status: nextState.status,
    turnsLeft: turnsLeft(nextState, mission.turnLimit),
  };
}

// Latest run status per mission for the current user (for the list badges).
export async function statusByMission(userId: string): Promise<Record<string, MissionStatus>> {
  const rows = await db
    .select({ missionId: missionRuns.missionId, status: missionRuns.status, startedAt: missionRuns.startedAt })
    .from(missionRuns)
    .where(eq(missionRuns.userId, userId))
    .orderBy(desc(missionRuns.startedAt));
  const out: Record<string, MissionStatus> = {};
  for (const r of rows) {
    if (!(r.missionId in out)) out[r.missionId] = r.status as MissionStatus;
  }
  return out;
}
```

- [ ] **Step 2: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint:fix && pnpm lint
```

Expected : 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/lib/missions/runtime.ts
git commit -m "feat(missions): runtime to start runs and submit turns"
```

---

## Task 8: Route API — start

**Files:**
- Create: `src/app/api/missions/start/route.ts`

- [ ] **Step 1: Implémenter**

Créer `src/app/api/missions/start/route.ts` :

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, UnauthorizedError } from '@/lib/auth';
import { MissionError, startRun } from '@/lib/missions/runtime';

const bodySchema = z.object({ missionId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const result = await startRun(user.id, parsed.data.missionId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err instanceof MissionError && err.code === 'not_found') {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
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
git add src/app/api/missions/start/route.ts
git commit -m "feat(missions): api route to start a mission run"
```

---

## Task 9: Route API — turn

**Files:**
- Create: `src/app/api/missions/turn/route.ts`

- [ ] **Step 1: Implémenter**

Créer `src/app/api/missions/turn/route.ts` :

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, UnauthorizedError } from '@/lib/auth';
import { getMissionResponder } from '@/lib/missions/responder';
import { MissionError, submitTurn } from '@/lib/missions/runtime';

const bodySchema = z.object({
  runId: z.uuid(),
  message: z.string().min(1).max(2000),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const result = await submitTurn(
      user.id,
      parsed.data.runId,
      parsed.data.message,
      getMissionResponder(),
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err instanceof MissionError) {
      const status = err.code === 'forbidden' ? 403 : err.code === 'finished' ? 409 : 404;
      return NextResponse.json({ error: err.message }, { status });
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
git add src/app/api/missions/turn/route.ts
git commit -m "feat(missions): api route to submit a mission turn"
```

---

## Task 10: Composant client — liste des missions

**Files:**
- Create: `src/app/(app)/missions/mission-list.tsx`

- [ ] **Step 1: Implémenter**

Créer `src/app/(app)/missions/mission-list.tsx` :

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

type MissionCard = {
  id: string;
  title: string;
  cefr: string;
  objective: string;
  status: 'none' | 'in_progress' | 'success' | 'incomplete';
};

const STATUS_LABEL: Record<MissionCard['status'], string> = {
  none: 'Jamais faite',
  in_progress: 'En cours',
  success: 'Réussie',
  incomplete: 'À retravailler',
};

export function MissionList({ missions }: { missions: MissionCard[] }) {
  const router = useRouter();
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(missionId: string) {
    if (startingId) return;
    setStartingId(missionId);
    setError(null);
    try {
      const res = await fetch('/api/missions/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ missionId }),
      });
      if (!res.ok) throw new Error('network');
      const data = (await res.json()) as { runId: string };
      router.push(`/missions/${data.runId}`);
    } catch {
      setError('Petit souci au lancement. Réessaie.');
      setStartingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {missions.map((m) => (
          <div key={m.id} className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{m.title}</span>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{m.cefr}</span>
            </div>
            <p className="text-sm text-gray-600">{m.objective}</p>
            <span className="text-xs text-gray-400">{STATUS_LABEL[m.status]}</span>
            <Button disabled={startingId === m.id} onClick={() => void start(m.id)}>
              {startingId === m.id ? 'Démarrage…' : 'Démarrer'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint:fix && pnpm lint
```

Expected : 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/missions/mission-list.tsx"
git commit -m "feat(missions): mission list client component"
```

---

## Task 11: Page liste des missions (server, gated)

**Files:**
- Create: `src/app/(app)/missions/page.tsx`

- [ ] **Step 1: Implémenter**

Créer `src/app/(app)/missions/page.tsx` :

```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireOnboardingStep } from '@/lib/onboarding/gate';
import { ALL_MISSIONS } from '@/lib/missions/catalog';
import { statusByMission } from '@/lib/missions/runtime';
import { MissionList } from './mission-list';

export default async function MissionsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await requireOnboardingStep(user.id, 'home');

  const statuses = user ? await statusByMission(user.id) : {};
  const missions = ALL_MISSIONS.map((m) => ({
    id: m.id,
    title: m.title,
    cefr: m.cefr,
    objective: m.objective,
    status: statuses[m.id] ?? 'none',
  }));

  return (
    <section className="space-y-6 pt-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Missions</h1>
        <p className="text-gray-700">
          Choisis une situation à jouer. Atteins l'objectif avant la fin des tours.
        </p>
      </div>
      <MissionList missions={missions} />
    </section>
  );
}
```

- [ ] **Step 2: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint:fix && pnpm lint
```

Expected : 0 erreur. (Le type de `status` venant de `statusByMission` est `MissionStatus` ; `'none'` complète l'union attendue par `MissionList` — la valeur par défaut `?? 'none'` produit l'union `MissionStatus | 'none'`, compatible avec la prop du composant.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/missions/page.tsx"
git commit -m "feat(missions): missions list page gated to onboarded users"
```

---

## Task 12: Run client + page de run

**Files:**
- Create: `src/app/(app)/missions/[runId]/run-client.tsx`, `src/app/(app)/missions/[runId]/page.tsx`

- [ ] **Step 1: Composant client du run**

Créer `src/app/(app)/missions/[runId]/run-client.tsx` :

```typescript
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Turn = { role: 'user' | 'assistant'; content: string; correction: string | null };
type Status = 'in_progress' | 'success' | 'incomplete';

export function RunClient({
  runId,
  objective,
  turnLimit,
  initialStatus,
  initialTurns,
}: {
  runId: string;
  objective: string;
  turnLimit: number;
  initialStatus: Status;
  initialTurns: Turn[];
}) {
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [status, setStatus] = useState<Status>(initialStatus);
  const [turnsLeft, setTurnsLeft] = useState<number>(turnLimit - initialTurns.filter((t) => t.role === 'user').length);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const text = draft.trim();
    if (!text || pending || status !== 'in_progress') return;
    setDraft('');
    setError(null);
    setTurns((t) => [...t, { role: 'user', content: text, correction: null }]);
    setPending(true);
    try {
      const res = await fetch('/api/missions/turn', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ runId, message: text }),
      });
      if (!res.ok) throw new Error('network');
      const data = (await res.json()) as {
        reply: string;
        correction: string | null;
        status: Status;
        turnsLeft: number;
      };
      setTurns((t) => [...t, { role: 'assistant', content: data.reply, correction: data.correction }]);
      setStatus(data.status);
      setTurnsLeft(data.turnsLeft);
    } catch {
      setError('Petit souci. Réessaie.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-gray-100 p-3 text-sm">
        <span className="font-medium">Objectif :</span> {objective}
        {status === 'in_progress' && <span className="ml-2 text-gray-500">· {turnsLeft} tour(s) restant(s)</span>}
      </div>

      <div className="space-y-3 rounded-md border border-gray-200 bg-white p-4">
        {turns.map((t, i) => (
          <div key={`${i}-${t.role}`} className={t.role === 'user' ? 'text-right' : 'text-left'}>
            <span
              className={`inline-block max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                t.role === 'user' ? 'bg-black text-white' : 'bg-gray-100 text-gray-900'
              }`}
            >
              {t.content}
            </span>
            {t.correction && (
              <p className="mt-1 text-xs text-amber-700">✍️ {t.correction}</p>
            )}
          </div>
        ))}
        {pending && <p className="text-sm text-gray-400">…</p>}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {status === 'in_progress' ? (
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
            placeholder="Ta réponse en anglais…"
            aria-label="Réponse"
            disabled={pending}
          />
          <Button type="submit" disabled={pending || draft.trim().length === 0}>
            Envoyer
          </Button>
        </form>
      ) : (
        <div className="space-y-3 rounded-md border border-gray-200 bg-white p-4">
          <p className={`font-medium ${status === 'success' ? 'text-green-700' : 'text-red-600'}`}>
            {status === 'success' ? '🎉 Mission réussie !' : 'Mission à retravailler.'}
          </p>
          <div className="flex gap-2">
            <Link href="/missions">
              <Button variant="ghost">Retour aux missions</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Page de run**

Créer `src/app/(app)/missions/[runId]/page.tsx` :

```typescript
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireOnboardingStep } from '@/lib/onboarding/gate';
import { MissionError, loadRun } from '@/lib/missions/runtime';
import { RunClient } from './run-client';

export default async function MissionRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  await requireOnboardingStep(user.id, 'home');

  try {
    const { run, mission, turns } = await loadRun(user.id, runId);
    return (
      <section className="space-y-6 pt-6">
        <h1 className="text-2xl font-semibold">{mission.title}</h1>
        <RunClient
          runId={run.id}
          objective={mission.objective}
          turnLimit={mission.turnLimit}
          initialStatus={run.status}
          initialTurns={turns.map((t) => ({
            role: t.role as 'user' | 'assistant',
            content: t.content,
            correction: t.correction,
          }))}
        />
      </section>
    );
  } catch (err) {
    if (err instanceof MissionError) notFound();
    throw err;
  }
}
```

- [ ] **Step 3: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint:fix && pnpm lint
```

Expected : 0 erreur. (Next 16 : `params` est un `Promise` — on l'`await`. `notFound()` lève ; le `catch` ne doit pas l'avaler : `notFound()` jette une erreur spéciale `NEXT_NOT_FOUND` — ne PAS la rattraper. Ici on appelle `notFound()` seulement dans la branche `MissionError`, et on relance le reste, donc OK.)

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/missions/[runId]/run-client.tsx" "src/app/(app)/missions/[runId]/page.tsx"
git commit -m "feat(missions): mission run page and interactive client"
```

---

## Task 13: Lien « Missions » dans la nav

**Files:**
- Modify: `src/components/app-nav.tsx`

- [ ] **Step 1: Ajouter le lien**

Dans `src/components/app-nav.tsx`, dans le tableau `LINKS`, ajouter une entrée `{ href: '/missions', label: 'Missions' }` après l'entrée `/practice` (ordre : Accueil, Pratique, Missions, Tuteur). Le reste du composant (rendu, masquage onboarding, surlignage actif) ne change pas.

- [ ] **Step 2: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint:fix && pnpm lint
```

Expected : 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/components/app-nav.tsx
git commit -m "feat(nav): add missions link to header nav"
```

---

## Task 14: Faux répondeur en CI + E2E

**Files:**
- Modify: `playwright.config.ts`, `.github/workflows/ci.yml`
- Create: `tests/e2e/missions.spec.ts`

- [ ] **Step 1: Passer `MISSION_FAKE=1` au serveur dev de Playwright et au CI**

Dans `playwright.config.ts`, la commande `webServer.command` du cas non-CI passe déjà `PLACEMENT_FAKE=1 CHAT_FAKE=1` via cross-env. Ajouter `MISSION_FAKE=1` à la même commande cross-env :

```typescript
        command: process.env.CI
          ? 'pnpm next dev'
          : 'pnpm exec dotenv -e .env.test -- cross-env PLACEMENT_FAKE=1 CHAT_FAKE=1 MISSION_FAKE=1 pnpm next dev',
```

Et dans `.github/workflows/ci.yml`, sous `env:` (où `PLACEMENT_FAKE`/`CHAT_FAKE` sont déjà), ajouter :

```yaml
      MISSION_FAKE: '1'
```

- [ ] **Step 2: Écrire le test E2E**

Créer `tests/e2e/missions.spec.ts` :

```typescript
import { expect, test } from '@playwright/test';

const randomEmail = () => `miss+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@teyen.test`;

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

test('user starts a mission and reaches success', async ({ page }) => {
  test.setTimeout(60_000);
  await completeOnboarding(page);

  await page.getByRole('link', { name: 'Missions', exact: true }).click();
  await expect(page).toHaveURL(/\/missions$/);

  // Start the first mission.
  await page.getByRole('button', { name: /Démarrer/i }).first().click();
  await expect(page).toHaveURL(/\/missions\/[0-9a-f-]+$/);
  await expect(page.getByText(/Objectif/i)).toBeVisible();

  // One normal turn (fake: objective not met).
  await page.getByLabel('Réponse').fill('Hello, nice to meet you');
  await page.getByRole('button', { name: /Envoyer/i }).click();
  await expect(page.getByText(/tour\(s\) restant/i)).toBeVisible();

  // A turn containing "success" → fake marks the objective met.
  await page.getByLabel('Réponse').fill('I think this is a success');
  await page.getByRole('button', { name: /Envoyer/i }).click();
  await expect(page.getByText(/Mission réussie/i)).toBeVisible();
});

test('/api/missions/turn requires auth', async ({ request }) => {
  const res = await request.post('/api/missions/turn', {
    data: { runId: '00000000-0000-0000-0000-000000000000', message: 'hi' },
  });
  expect(res.status()).toBe(401);
});
```

- [ ] **Step 3: Lancer le test missions**

```bash
pnpm e2e tests/e2e/missions.spec.ts
```

Expected : 2 passed.

Note : si un serveur dev tourne déjà sur :3000 SANS `MISSION_FAKE`, Playwright le réutilise et le test échoue (vrais appels OpenAI, pas de « success » contrôlé). Arrêter ce serveur d'abord (`lsof -ti :3000 | xargs kill`).

- [ ] **Step 4: Suite complète + commit**

```bash
pnpm e2e
pnpm test
pnpm lint
git add tests/e2e/missions.spec.ts playwright.config.ts .github/workflows/ci.yml
git commit -m "test(e2e): mission start, success path and auth guard"
```

Expected : toute la suite passe.

---

## Critère de fin

- ✅ `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e` passent.
- ✅ Un utilisateur onboardé ouvre « Missions », choisit un scénario, joue le roleplay, atteint l'objectif → écran « Mission réussie », ou épuise les tours → « à retravailler ».
- ✅ Corrections affichées sous les répliques du coach.
- ✅ Les E2E utilisent le faux répondeur (`MISSION_FAKE=1`) — aucun appel OpenAI.
- ✅ 2 nouvelles tables, isolées du chat libre ; pas de mutation des `skill_levels`.

## Ce qui reste (pivot)

- **P2** : pipeline audio (STT → mission LLM → TTS compressé) branché sur les missions.
- **P0** : coque PWA + UX mobile + offline statique.
- **P3** : approfondir le contenu/persona ; **P4** : Mobile Money + rationing de tokens.
- Plus tard : replier le « suivi de progression » et la « révision espacée » dans le produit pivoté ; éventuellement retirer le chat libre au profit des missions.
