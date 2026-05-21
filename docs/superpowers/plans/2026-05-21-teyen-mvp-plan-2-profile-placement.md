# Teyen MVP — Plan 2 : Profil + Placement (onboarding)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le parcours d'onboarding complet : après inscription, l'utilisateur passe un test de placement adaptatif (~12 QCM générés par IA), ses 4 niveaux CEFR sont initialisés, puis il renseigne son profil (domaines, intérêts, objectif), et atterrit sur une page d'accueil affichant ses niveaux estimés.

**Architecture:** Le générateur d'exercices (OpenAI gpt-4o-mini + Structured Outputs) produit des QCM validés par schéma Zod. Il est **injecté par dépendance** dans l'orchestrateur de placement, pour que les tests utilisent un faux générateur sans appeler OpenAI. La logique de scoring du placement (staircase adaptatif + estimation CEFR) est du code pur, testée unitairement. Le profil est persisté dans la table `profiles` existante. Un "onboarding gate" route l'utilisateur selon l'état de ses `skill_levels` et de son `profile`.

**Tech Stack:** OpenAI SDK (`openai`) avec Structured Outputs via `zodResponseFormat`, Zod, Drizzle (tables existantes `exercises`, `attempts`, `skill_levels`, `profiles`), Next.js 16 App Router (Server Actions + Route Handlers), React 19, Vitest, Playwright.

---

## Contexte : état du projet (fin Plan 1)

Plan 1 est terminé en local (Phases 0-3 ; déploiement GitHub/Vercel non fait mais hors-scope ici). Disponible :
- Next.js 16.2.6, React 19, Tailwind 4, TypeScript strict, Biome, Vitest, Playwright.
- Supabase `teyen-dev` (via `.env.local`) et `teyen-test` (via `.env.test`), 7 tables + 4 enums migrés, trigger qui crée une ligne `users` + `profiles` (vides) à chaque signup.
- Auth fonctionnelle : `/signup`, `/login`, logout, `src/proxy.ts` protège `/home`.
- `src/lib/env.ts` (validé Zod, contient `OPENAI_API_KEY`), `src/lib/supabase/server.ts`, `src/lib/auth.ts` (`requireUser`, `UnauthorizedError`), `src/db/index.ts` (`db`), `src/db/schema.ts`.
- Composants UI : `src/components/ui/button.tsx`, `src/components/ui/input.tsx`.

## Conventions de ce plan

- **Échelle CEFR numérique** : A1=1, A2=2, B1=3, B2=4, C1=5, C2=6 (0 = pré-A1). Stockée en `numeric(4,2)`. Le placement démarre à B1=3.
- **Tous les items de placement sont des QCM** (`type = 'mcq'`), auto-scorables (pas de LLM-juge — réservé au Plan 4). Le skill testé est porté par le champ `skill`. Pour `writing`, le QCM demande de choisir la phrase la mieux écrite/la plus naturelle. Pour `reading`, le payload inclut un `passage`.
- **Le générateur est une interface injectable** : `ExerciseGenerator` est un type de fonction. La prod utilise `openAiGenerator`, les tests utilisent `fakeGenerator`. Le flag d'env `PLACEMENT_FAKE` (=`'1'`) sélectionne le faux générateur côté serveur, pour que les E2E n'appellent pas OpenAI.
- **gpt-4o-mini** pour toute génération de ce plan.

## File Structure

| Fichier | Responsabilité |
|---|---|
| `src/lib/openai.ts` | Client OpenAI singleton |
| `src/lib/cefr.ts` | Conversions niveau numérique ↔ label CEFR, clamp |
| `src/lib/exercises/types.ts` | Schémas Zod + types de l'item QCM et de la spec |
| `src/lib/exercises/generator.ts` | `ExerciseGenerator` interface, `openAiGenerator`, `fakeGenerator`, `getGenerator()` |
| `src/lib/placement/scoring.ts` | Logique pure : staircase + estimation CEFR par compétence |
| `src/lib/placement/session.ts` | Persistance d'une session de placement (exercises + attempts), init skill_levels |
| `src/app/api/placement/next/route.ts` | Génère/retourne le prochain item de placement |
| `src/app/api/placement/answer/route.ts` | Enregistre la réponse, fait avancer la session |
| `src/app/(app)/onboarding/placement/page.tsx` | UI du test de placement |
| `src/app/(app)/onboarding/placement/placement-client.tsx` | Composant client interactif du placement |
| `src/lib/profile/constants.ts` | Liste des domaines prédéfinis |
| `src/app/(app)/onboarding/profile/page.tsx` | UI du profil |
| `src/app/(app)/onboarding/profile/actions.ts` | Server action de sauvegarde du profil |
| `src/lib/onboarding/gate.ts` | Calcule l'étape d'onboarding selon l'état DB |
| `src/app/(app)/layout.tsx` | (modifié) applique le gate de redirection |
| `src/app/(app)/home/page.tsx` | (modifié) affiche les niveaux estimés |

## Vue d'ensemble

| # | Phase | Tasks |
|---|---|---|
| A | OpenAI + générateur d'exercices | 1–6 |
| B | Moteur de placement | 7–10 |
| C | UI placement | 11–12 |
| D | Profil | 13–15 |
| E | Onboarding routing + home + E2E | 16–18 |

Total : **18 tâches**.

---

## Phase A — OpenAI et générateur d'exercices

### Task 1: Installer le SDK OpenAI et créer le client

**Files:**
- Create: `src/lib/openai.ts`
- Modify: `package.json`

- [ ] **Step 1: Installer le SDK**

```bash
pnpm add openai
```

- [ ] **Step 2: Créer le client**

Créer `src/lib/openai.ts` :

```typescript
import OpenAI from 'openai';
import { env } from '@/lib/env';

let cached: OpenAI | undefined;

export function openai(): OpenAI {
  if (!cached) {
    cached = new OpenAI({ apiKey: env().OPENAI_API_KEY });
  }
  return cached;
}

export const GENERATION_MODEL = 'gpt-4o-mini';
```

- [ ] **Step 3: Vérifier compilation**

```bash
pnpm typecheck
```

Expected : 0 erreur.

- [ ] **Step 4: Commit**

```bash
git add src/lib/openai.ts package.json pnpm-lock.yaml
git commit -m "feat(llm): add openai client singleton"
```

---

### Task 2: Helpers CEFR (échelle numérique ↔ label)

**Files:**
- Create: `src/lib/cefr.ts`, `src/lib/cefr.test.ts`

- [ ] **Step 1: Écrire les tests (TDD)**

Créer `src/lib/cefr.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { CEFR_LABELS, clampLevel, levelToLabel, labelToLevel } from './cefr';

describe('cefr helpers', () => {
  it('maps numeric levels to labels', () => {
    expect(levelToLabel(1)).toBe('A1');
    expect(levelToLabel(3)).toBe('B1');
    expect(levelToLabel(6)).toBe('C2');
  });

  it('rounds fractional levels to the nearest label', () => {
    expect(levelToLabel(3.4)).toBe('B1');
    expect(levelToLabel(3.6)).toBe('B2');
  });

  it('clamps fractional levels below 1 and above 6 for labels', () => {
    expect(levelToLabel(0.2)).toBe('A1');
    expect(levelToLabel(9)).toBe('C2');
  });

  it('maps labels back to numeric levels', () => {
    expect(labelToLevel('A1')).toBe(1);
    expect(labelToLevel('C2')).toBe(6);
  });

  it('clamps a level into the 1..6 range', () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(7)).toBe(6);
    expect(clampLevel(4)).toBe(4);
  });

  it('exposes the ordered list of labels', () => {
    expect(CEFR_LABELS).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
pnpm test src/lib/cefr.test.ts
```

Expected : FAIL ("Cannot find module './cefr'").

- [ ] **Step 3: Implémenter**

Créer `src/lib/cefr.ts` :

```typescript
export const CEFR_LABELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export type CefrLabel = (typeof CEFR_LABELS)[number];

export function clampLevel(level: number): number {
  if (level < 1) return 1;
  if (level > 6) return 6;
  return level;
}

export function levelToLabel(level: number): CefrLabel {
  const index = Math.round(clampLevel(level)) - 1;
  return CEFR_LABELS[index] ?? 'A1';
}

export function labelToLevel(label: CefrLabel): number {
  return CEFR_LABELS.indexOf(label) + 1;
}
```

- [ ] **Step 4: Relancer**

```bash
pnpm test src/lib/cefr.test.ts
```

Expected : 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cefr.ts src/lib/cefr.test.ts
git commit -m "feat(cefr): numeric level and label helpers"
```

---

### Task 3: Types et schémas Zod de l'item QCM

**Files:**
- Create: `src/lib/exercises/types.ts`, `src/lib/exercises/types.test.ts`

- [ ] **Step 1: Écrire le test (TDD)**

Créer `src/lib/exercises/types.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { mcqItemSchema } from './types';

describe('mcqItemSchema', () => {
  it('accepts a well-formed mcq item', () => {
    const parsed = mcqItemSchema.parse({
      passage: null,
      prompt: 'Choose the correct form: She ___ to school every day.',
      options: ['go', 'goes', 'going', 'gone'],
      correctIndex: 1,
      rationale: 'Third person singular present takes -s.',
    });
    expect(parsed.correctIndex).toBe(1);
    expect(parsed.options).toHaveLength(4);
  });

  it('rejects when options length is not 4', () => {
    expect(() =>
      mcqItemSchema.parse({
        passage: null,
        prompt: 'x',
        options: ['a', 'b', 'c'],
        correctIndex: 0,
        rationale: 'r',
      }),
    ).toThrow();
  });

  it('rejects a correctIndex out of range', () => {
    expect(() =>
      mcqItemSchema.parse({
        passage: null,
        prompt: 'x',
        options: ['a', 'b', 'c', 'd'],
        correctIndex: 4,
        rationale: 'r',
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
pnpm test src/lib/exercises/types.test.ts
```

Expected : FAIL ("Cannot find module './types'").

- [ ] **Step 3: Implémenter**

Créer `src/lib/exercises/types.ts` :

```typescript
import { z } from 'zod';

export const SKILLS = ['reading', 'writing', 'vocab', 'grammar'] as const;
export type Skill = (typeof SKILLS)[number];

// A placement/practice multiple-choice item. Exactly 4 options, one correct.
export const mcqItemSchema = z.object({
  passage: z.string().nullable(),
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  rationale: z.string().min(1),
});

export type McqItem = z.infer<typeof mcqItemSchema>;

// What the caller asks the generator to produce.
export type GenerationSpec = {
  skill: Skill;
  level: number; // CEFR numeric 1..6
  topic: string; // neutral topic for placement (e.g. 'daily life')
};
```

- [ ] **Step 4: Relancer**

```bash
pnpm test src/lib/exercises/types.test.ts
```

Expected : 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/exercises/types.ts src/lib/exercises/types.test.ts
git commit -m "feat(exercises): mcq item schema and generation spec types"
```

---

### Task 4: Générateur — interface + faux générateur déterministe

**Files:**
- Create: `src/lib/exercises/generator.ts`, `src/lib/exercises/fake-generator.test.ts`

Le faux générateur est déterministe et sert aux tests (placement E2E, scoring). Le vrai générateur OpenAI vient en Task 5.

- [ ] **Step 1: Écrire le test (TDD)**

Créer `src/lib/exercises/fake-generator.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { fakeGenerator } from './generator';

describe('fakeGenerator', () => {
  it('produces a valid mcq item for the requested skill and level', async () => {
    const item = await fakeGenerator({ skill: 'grammar', level: 3, topic: 'daily life' });
    expect(item.options).toHaveLength(4);
    expect(item.correctIndex).toBeGreaterThanOrEqual(0);
    expect(item.correctIndex).toBeLessThanOrEqual(3);
    expect(item.prompt).toContain('grammar');
  });

  it('includes a passage for the reading skill', async () => {
    const item = await fakeGenerator({ skill: 'reading', level: 4, topic: 'travel' });
    expect(item.passage).not.toBeNull();
  });

  it('is deterministic for the same spec', async () => {
    const a = await fakeGenerator({ skill: 'vocab', level: 2, topic: 'food' });
    const b = await fakeGenerator({ skill: 'vocab', level: 2, topic: 'food' });
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
pnpm test src/lib/exercises/fake-generator.test.ts
```

Expected : FAIL ("Cannot find module './generator'").

- [ ] **Step 3: Implémenter l'interface et le faux générateur**

Créer `src/lib/exercises/generator.ts` :

```typescript
import type { GenerationSpec, McqItem } from './types';

export type ExerciseGenerator = (spec: GenerationSpec) => Promise<McqItem>;

// Deterministic fake used by tests and when PLACEMENT_FAKE='1'.
// correctIndex is derived from the spec so it's stable but varied.
export const fakeGenerator: ExerciseGenerator = async (spec) => {
  const correctIndex = (spec.level + spec.skill.length) % 4;
  const passage = spec.skill === 'reading' ? `A short ${spec.topic} passage at level ${spec.level}.` : null;
  return {
    passage,
    prompt: `[fake ${spec.skill}] Question about ${spec.topic} at level ${spec.level}.`,
    options: ['option A', 'option B', 'option C', 'option D'],
    correctIndex,
    rationale: `Option ${correctIndex} is correct (fake).`,
  };
};
```

- [ ] **Step 4: Relancer**

```bash
pnpm test src/lib/exercises/fake-generator.test.ts
```

Expected : 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/exercises/generator.ts src/lib/exercises/fake-generator.test.ts
git commit -m "feat(exercises): generator interface and deterministic fake generator"
```

---

### Task 5: Générateur OpenAI (Structured Outputs) + sélecteur

**Files:**
- Modify: `src/lib/exercises/generator.ts`

- [ ] **Step 1: Ajouter le générateur OpenAI et le sélecteur**

Ajouter à `src/lib/exercises/generator.ts` (en gardant `fakeGenerator`) :

```typescript
import { zodResponseFormat } from 'openai/helpers/zod';
import { GENERATION_MODEL, openai } from '@/lib/openai';
import { levelToLabel } from '@/lib/cefr';
import { mcqItemSchema } from './types';

const SKILL_INSTRUCTIONS: Record<GenerationSpec['skill'], string> = {
  reading: 'Write a 2-4 sentence English passage, then a comprehension question with 4 options.',
  writing: 'Write a question asking which of 4 sentences is the most natural, well-formed English. No passage.',
  vocab: 'Write a vocabulary question (meaning, synonym, or best word to fill a blank) with 4 options. No passage.',
  grammar: 'Write a grammar question (verb form, tense, preposition, article...) with 4 options. No passage.',
};

export const openAiGenerator: ExerciseGenerator = async (spec) => {
  const label = levelToLabel(spec.level);
  const instruction = SKILL_INSTRUCTIONS[spec.skill];
  const completion = await openai().chat.completions.parse({
    model: GENERATION_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You write English-learning multiple-choice questions for a CEFR placement test. Always produce exactly 4 options with exactly one correct answer. Keep difficulty calibrated to the requested CEFR level.',
      },
      {
        role: 'user',
        content: `Skill: ${spec.skill}. CEFR level: ${label}. Topic: ${spec.topic}. ${instruction} Set passage to null when not a reading item.`,
      },
    ],
    response_format: zodResponseFormat(mcqItemSchema, 'mcq_item'),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error('OpenAI returned no parsed mcq item');
  }
  return parsed;
};

export function getGenerator(): ExerciseGenerator {
  return process.env.PLACEMENT_FAKE === '1' ? fakeGenerator : openAiGenerator;
}
```

- [ ] **Step 2: Vérifier l'API du SDK OpenAI installé**

L'API exacte de Structured Outputs peut varier selon la version du SDK `openai`. Vérifier :

```bash
node -e "const o=require('openai'); console.log(require('openai/package.json').version)"
ls node_modules/openai/helpers/zod*
```

Si `openai/helpers/zod` n'existe pas, chercher l'export équivalent :

```bash
grep -rl "zodResponseFormat" node_modules/openai/ | head -5
```

Et si `chat.completions.parse` n'existe pas (SDK ancien), utiliser `openai().beta.chat.completions.parse(...)`. Adapter l'import et l'appel en conséquence. Confirmer via les types : `node_modules/openai/resources/chat/completions/*.d.ts`.

- [ ] **Step 3: Vérifier compilation**

```bash
pnpm typecheck
```

Expected : 0 erreur. (Si la signature `.parse` diffère, corriger jusqu'à 0 erreur.)

- [ ] **Step 4: Test d'intégration réel (gated, manuel)**

Créer un test temporaire pour valider un vrai appel OpenAI (à supprimer après) :

```bash
cat > /tmp/gen-check.ts <<'EOF'
import { openAiGenerator } from '@/lib/exercises/generator';
async function main() {
  const item = await openAiGenerator({ skill: 'grammar', level: 3, topic: 'daily life' });
  console.log(JSON.stringify(item, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
EOF
pnpm exec dotenv -e .env.local -- tsx --tsconfig tsconfig.json -r tsconfig-paths/register /tmp/gen-check.ts 2>&1 | tail -20 || true
```

Note : si `tsconfig-paths` n'est pas installé, créer plutôt le fichier dans `src/` temporairement (ex: `src/_gencheck.ts`) pour bénéficier de l'alias `@/`, le lancer avec `pnpm exec dotenv -e .env.local -- tsx src/_gencheck.ts`, puis le supprimer. L'objectif : confirmer qu'un vrai item JSON valide revient d'OpenAI. Supprimer le fichier de check après.

Expected : un JSON avec `prompt`, 4 `options`, `correctIndex` 0-3, `rationale`. Coût : ~1 appel gpt-4o-mini (négligeable).

- [ ] **Step 5: Lint + commit**

```bash
pnpm lint
git add src/lib/exercises/generator.ts
git commit -m "feat(exercises): openai structured-output generator and selector"
```

---

### Task 6: Topics neutres de placement

**Files:**
- Create: `src/lib/placement/topics.ts`

- [ ] **Step 1: Implémenter (pas de test — données constantes)**

Créer `src/lib/placement/topics.ts` :

```typescript
import type { Skill } from '@/lib/exercises/types';

// Neutral topics used during placement (before the user picks a domain).
const NEUTRAL_TOPICS = ['daily life', 'travel', 'work', 'food', 'technology', 'health'];

// Deterministic topic pick so a placement session is reproducible per (skill, index).
export function placementTopic(skill: Skill, index: number): string {
  const seed = skill.length + index;
  return NEUTRAL_TOPICS[seed % NEUTRAL_TOPICS.length] ?? 'daily life';
}
```

- [ ] **Step 2: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected : 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/lib/placement/topics.ts
git commit -m "feat(placement): neutral topics for placement items"
```

---

## Phase B — Moteur de placement

### Task 7: Logique de scoring (staircase + estimation)

**Files:**
- Create: `src/lib/placement/scoring.ts`, `src/lib/placement/scoring.test.ts`

- [ ] **Step 1: Écrire les tests (TDD)**

Créer `src/lib/placement/scoring.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { nextLevel, estimateFromPresented, ITEMS_PER_SKILL, START_LEVEL } from './scoring';

describe('placement scoring', () => {
  it('starts at B1 (level 3)', () => {
    expect(START_LEVEL).toBe(3);
  });

  it('uses 3 items per skill', () => {
    expect(ITEMS_PER_SKILL).toBe(3);
  });

  it('moves up one level on a correct answer, capped at 6', () => {
    expect(nextLevel(3, true)).toBe(4);
    expect(nextLevel(6, true)).toBe(6);
  });

  it('moves down one level on a wrong answer, floored at 1', () => {
    expect(nextLevel(3, false)).toBe(2);
    expect(nextLevel(1, false)).toBe(1);
  });

  it('estimates the average of presented levels, rounded to 2 decimals', () => {
    expect(estimateFromPresented([3, 4, 5])).toBe(4);
    expect(estimateFromPresented([3, 2, 1])).toBe(2);
    expect(estimateFromPresented([3, 4, 3])).toBe(3.33);
  });

  it('clamps the estimate into 1..6', () => {
    expect(estimateFromPresented([1, 1, 1])).toBe(1);
    expect(estimateFromPresented([6, 6, 6])).toBe(6);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
pnpm test src/lib/placement/scoring.test.ts
```

Expected : FAIL ("Cannot find module './scoring'").

- [ ] **Step 3: Implémenter**

Créer `src/lib/placement/scoring.ts` :

```typescript
import { clampLevel } from '@/lib/cefr';

export const START_LEVEL = 3; // B1
export const ITEMS_PER_SKILL = 3;

export function nextLevel(current: number, correct: boolean): number {
  return clampLevel(correct ? current + 1 : current - 1);
}

export function estimateFromPresented(presentedLevels: number[]): number {
  if (presentedLevels.length === 0) return START_LEVEL;
  const mean = presentedLevels.reduce((a, b) => a + b, 0) / presentedLevels.length;
  return Math.round(clampLevel(mean) * 100) / 100;
}
```

- [ ] **Step 4: Relancer**

```bash
pnpm test src/lib/placement/scoring.test.ts
```

Expected : 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/placement/scoring.ts src/lib/placement/scoring.test.ts
git commit -m "feat(placement): staircase scoring and cefr estimation"
```

---

### Task 8: Persistance de session de placement

**Files:**
- Create: `src/lib/placement/session.ts`, `src/lib/placement/session.test.ts`

Une session de placement parcourt les 4 compétences ; pour chacune, `ITEMS_PER_SKILL` items. On stocke chaque item généré dans `exercises` et chaque réponse dans `attempts`. L'état de progression est dérivé du nombre d'`attempts` de l'utilisateur pour les exercices de skill `mcq` non encore "consommés". Pour rester simple et déterministe, on encode l'état de placement dans le `topic` des exercices (`placement:<skill>:<index>`) afin de reconstruire la progression sans table supplémentaire.

- [ ] **Step 1: Écrire les tests (TDD)**

Créer `src/lib/placement/session.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { placementTopicTag, parsePlacementTag, plannedSlots, SKILL_ORDER } from './session';

describe('placement session helpers', () => {
  it('orders skills reading, writing, vocab, grammar', () => {
    expect(SKILL_ORDER).toEqual(['reading', 'writing', 'vocab', 'grammar']);
  });

  it('builds and parses a placement topic tag', () => {
    const tag = placementTopicTag('grammar', 2);
    expect(tag).toBe('placement:grammar:2');
    expect(parsePlacementTag(tag)).toEqual({ skill: 'grammar', index: 2 });
  });

  it('returns null when parsing a non-placement tag', () => {
    expect(parsePlacementTag('daily life')).toBeNull();
  });

  it('plans 12 slots (4 skills x 3 items) in order', () => {
    const slots = plannedSlots();
    expect(slots).toHaveLength(12);
    expect(slots[0]).toEqual({ skill: 'reading', index: 0 });
    expect(slots[11]).toEqual({ skill: 'grammar', index: 2 });
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
pnpm test src/lib/placement/session.test.ts
```

Expected : FAIL ("Cannot find module './session'").

- [ ] **Step 3: Implémenter les helpers purs**

Créer `src/lib/placement/session.ts` (pour l'instant, uniquement les imports nécessaires aux helpers purs — les imports DB seront ajoutés au Step 5) :

```typescript
import type { Skill } from '@/lib/exercises/types';
import { ITEMS_PER_SKILL } from './scoring';

export const SKILL_ORDER: Skill[] = ['reading', 'writing', 'vocab', 'grammar'];

export function placementTopicTag(skill: Skill, index: number): string {
  return `placement:${skill}:${index}`;
}

export function parsePlacementTag(tag: string): { skill: Skill; index: number } | null {
  const parts = tag.split(':');
  if (parts.length !== 3 || parts[0] !== 'placement') return null;
  const skill = parts[1] as Skill;
  const index = Number(parts[2]);
  if (!SKILL_ORDER.includes(skill) || Number.isNaN(index)) return null;
  return { skill, index };
}

export type Slot = { skill: Skill; index: number };

export function plannedSlots(): Slot[] {
  const slots: Slot[] = [];
  for (const skill of SKILL_ORDER) {
    for (let index = 0; index < ITEMS_PER_SKILL; index++) {
      slots.push({ skill, index });
    }
  }
  return slots;
}
```

- [ ] **Step 4: Relancer**

```bash
pnpm test src/lib/placement/session.test.ts
```

Expected : 4 passed.

- [ ] **Step 5: Ajouter les fonctions de persistance (avec DB)**

D'abord compléter les imports en tête de `src/lib/placement/session.ts`. Le bloc d'imports final doit être (fusionner la ligne `./scoring` existante avec les nouveaux symboles ; ne pas créer deux imports depuis `./scoring`) :

```typescript
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { attempts, exercises, skillLevels } from '@/db/schema';
import type { ExerciseGenerator } from '@/lib/exercises/generator';
import type { Skill } from '@/lib/exercises/types';
import { ITEMS_PER_SKILL, START_LEVEL, estimateFromPresented, nextLevel } from './scoring';
import { placementTopic } from './topics';
```

Puis ajouter les fonctions à la fin de `src/lib/placement/session.ts` :

```typescript
// Current per-skill level during the staircase, derived from past attempts.
async function currentLevelForSkill(userId: string, skill: Skill): Promise<number> {
  const rows = await db
    .select({ topic: exercises.topic, cefr: exercises.cefr, score: attempts.score })
    .from(attempts)
    .innerJoin(exercises, eq(attempts.exerciseId, exercises.id))
    .where(eq(attempts.userId, userId));

  let level = START_LEVEL;
  const answered = rows
    .map((r) => ({ tag: parsePlacementTag(r.topic), cefr: Number(r.cefr), score: Number(r.score) }))
    .filter((r) => r.tag?.skill === skill)
    .sort((a, b) => (a.tag?.index ?? 0) - (b.tag?.index ?? 0));

  for (const a of answered) {
    level = nextLevel(level, a.score >= 0.5);
  }
  return level;
}

// How many placement items the user has already answered (0..12).
export async function answeredCount(userId: string): Promise<number> {
  const rows = await db
    .select({ topic: exercises.topic })
    .from(attempts)
    .innerJoin(exercises, eq(attempts.exerciseId, exercises.id))
    .where(eq(attempts.userId, userId));
  return rows.filter((r) => parsePlacementTag(r.topic) !== null).length;
}

// Generate and persist the next placement item; returns the exercise row id + item payload.
export async function createNextItem(
  userId: string,
  generate: ExerciseGenerator,
): Promise<{ exerciseId: string; prompt: string; passage: string | null; options: string[]; slotIndex: number } | null> {
  const done = await answeredCount(userId);
  const slots = plannedSlots();
  if (done >= slots.length) return null;
  const slot = slots[done];
  if (!slot) return null;

  const level = await currentLevelForSkill(userId, slot.skill);
  const item = await generate({ skill: slot.skill, level, topic: placementTopic(slot.skill, slot.index) });

  const inserted = await db
    .insert(exercises)
    .values({
      userId,
      type: 'mcq',
      skill: slot.skill,
      cefr: String(level),
      topic: placementTopicTag(slot.skill, slot.index),
      domain: 'placement',
      payload: { passage: item.passage, prompt: item.prompt, options: item.options },
      answerKey: { correctIndex: item.correctIndex, rationale: item.rationale },
    })
    .returning({ id: exercises.id });

  const row = inserted[0];
  if (!row) throw new Error('failed to insert placement exercise');
  return { exerciseId: row.id, prompt: item.prompt, passage: item.passage, options: item.options, slotIndex: done };
}

// Record an answer; returns whether it was correct and whether placement is now complete.
export async function recordAnswer(
  userId: string,
  exerciseId: string,
  selectedIndex: number,
): Promise<{ correct: boolean; complete: boolean }> {
  const rows = await db.select().from(exercises).where(eq(exercises.id, exerciseId)).limit(1);
  const ex = rows[0];
  if (!ex || ex.userId !== userId) throw new Error('exercise not found for user');
  const key = ex.answerKey as { correctIndex: number; rationale: string };
  const correct = key.correctIndex === selectedIndex;

  await db.insert(attempts).values({
    userId,
    exerciseId,
    response: String(selectedIndex),
    score: correct ? '1' : '0',
    feedback: key.rationale,
  });

  const done = await answeredCount(userId);
  return { correct, complete: done >= plannedSlots().length };
}

// After all items answered, compute and persist the 4 skill_levels rows.
export async function finalizePlacement(userId: string): Promise<void> {
  const rows = await db
    .select({ topic: exercises.topic, cefr: exercises.cefr })
    .from(attempts)
    .innerJoin(exercises, eq(attempts.exerciseId, exercises.id))
    .where(eq(attempts.userId, userId));

  for (const skill of SKILL_ORDER) {
    const presented = rows
      .map((r) => ({ tag: parsePlacementTag(r.topic), cefr: Number(r.cefr) }))
      .filter((r) => r.tag?.skill === skill)
      .map((r) => r.cefr);
    const estimate = estimateFromPresented(presented);
    await db
      .insert(skillLevels)
      .values({ userId, skill, cefrEstimate: String(estimate), confidence: '0.30' })
      .onConflictDoUpdate({
        target: [skillLevels.userId, skillLevels.skill],
        set: { cefrEstimate: String(estimate), confidence: '0.30', updatedAt: new Date() },
      });
  }
}

// Has the user completed placement (4 skill_levels rows exist)?
export async function hasPlacement(userId: string): Promise<boolean> {
  const rows = await db.select({ id: skillLevels.id }).from(skillLevels).where(eq(skillLevels.userId, userId));
  return rows.length >= SKILL_ORDER.length;
}
```

- [ ] **Step 6: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected : 0 erreur. (Si Drizzle se plaint du typage `onConflictDoUpdate` sur la contrainte composite, vérifier que le nom de contrainte `skill_levels_user_skill_uq` est bien défini dans `src/db/schema.ts` ; la cible peut alors être `target: [skillLevels.userId, skillLevels.skill]`.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/placement/session.ts src/lib/placement/session.test.ts
git commit -m "feat(placement): session persistence, scoring integration and skill_levels init"
```

---

### Task 9: Route API — prochain item de placement

**Files:**
- Create: `src/app/api/placement/next/route.ts`

- [ ] **Step 1: Implémenter la route**

Créer `src/app/api/placement/next/route.ts` :

```typescript
import { NextResponse } from 'next/server';
import { requireUser, UnauthorizedError } from '@/lib/auth';
import { getGenerator } from '@/lib/exercises/generator';
import { createNextItem } from '@/lib/placement/session';

export async function POST() {
  try {
    const user = await requireUser();
    const item = await createNextItem(user.id, getGenerator());
    if (!item) {
      return NextResponse.json({ done: true });
    }
    return NextResponse.json({
      done: false,
      exerciseId: item.exerciseId,
      passage: item.passage,
      prompt: item.prompt,
      options: item.options,
      slotIndex: item.slotIndex,
      total: 12,
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
pnpm typecheck && pnpm lint
```

Expected : 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/placement/next/route.ts
git commit -m "feat(placement): api route to fetch the next placement item"
```

---

### Task 10: Route API — soumettre une réponse

**Files:**
- Create: `src/app/api/placement/answer/route.ts`

- [ ] **Step 1: Implémenter la route**

Créer `src/app/api/placement/answer/route.ts` :

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, UnauthorizedError } from '@/lib/auth';
import { finalizePlacement, recordAnswer } from '@/lib/placement/session';

const bodySchema = z.object({
  exerciseId: z.string().uuid(),
  selectedIndex: z.number().int().min(0).max(3),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const result = await recordAnswer(user.id, parsed.data.exerciseId, parsed.data.selectedIndex);
    if (result.complete) {
      await finalizePlacement(user.id);
    }
    return NextResponse.json({ correct: result.correct, complete: result.complete });
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
pnpm typecheck && pnpm lint
```

Expected : 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/placement/answer/route.ts
git commit -m "feat(placement): api route to submit an answer and finalize"
```

---

## Phase C — UI placement

### Task 11: Composant client du placement

**Files:**
- Create: `src/app/(app)/onboarding/placement/placement-client.tsx`

- [ ] **Step 1: Implémenter le composant client**

Créer `src/app/(app)/onboarding/placement/placement-client.tsx` :

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

type Item = {
  done: boolean;
  exerciseId?: string;
  passage?: string | null;
  prompt?: string;
  options?: string[];
  slotIndex?: number;
  total?: number;
};

export function PlacementClient() {
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadNext() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/placement/next', { method: 'POST' });
      if (!res.ok) throw new Error('network');
      const data: Item = await res.json();
      if (data.done) {
        router.push('/onboarding/profile');
        router.refresh();
        return;
      }
      setItem(data);
    } catch {
      setError('Petit souci de chargement. Réessaie.');
    } finally {
      setLoading(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: load the first item once on mount
  useEffect(() => {
    void loadNext();
  }, []);

  async function answer(selectedIndex: number) {
    if (!item?.exerciseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/placement/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ exerciseId: item.exerciseId, selectedIndex }),
      });
      if (!res.ok) throw new Error('network');
      await loadNext();
    } catch {
      setError('Petit souci. Réessaie.');
      setLoading(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-red-600">{error}</p>
        <Button onClick={() => void loadNext()}>Réessayer</Button>
      </div>
    );
  }

  if (loading || !item || !item.options) {
    return <p className="text-gray-600">Chargement…</p>;
  }

  const progress = ((item.slotIndex ?? 0) + 1);
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">Question {progress} / {item.total ?? 12}</p>
      {item.passage && <p className="rounded-md bg-gray-100 p-4 text-sm">{item.passage}</p>}
      <p className="font-medium">{item.prompt}</p>
      <div className="grid gap-2">
        {item.options.map((opt, i) => (
          <Button key={opt} variant="ghost" className="justify-start" onClick={() => void answer(i)}>
            {opt}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected : 0 erreur. (Biome peut réordonner les imports ou demander une clé stable dans `.map` — la clé `opt` est utilisée ; si deux options sont identiques, utiliser `key={`${i}-${opt}`}`.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/onboarding/placement/placement-client.tsx"
git commit -m "feat(placement): interactive client component"
```

---

### Task 12: Page du placement

**Files:**
- Create: `src/app/(app)/onboarding/placement/page.tsx`

- [ ] **Step 1: Implémenter la page**

Créer `src/app/(app)/onboarding/placement/page.tsx` :

```typescript
import { PlacementClient } from './placement-client';

export default function PlacementPage() {
  return (
    <section className="space-y-6 pt-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Situons ton niveau</h1>
        <p className="text-gray-700">
          Quelques questions rapides pour estimer ton niveau d'anglais. Réponds du mieux que tu peux ;
          il n'y a pas d'échec, ça nous sert juste à personnaliser ton parcours.
        </p>
      </div>
      <PlacementClient />
    </section>
  );
}
```

- [ ] **Step 2: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected : 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/onboarding/placement/page.tsx"
git commit -m "feat(placement): placement page"
```

---

## Phase D — Profil

### Task 13: Constantes de domaines

**Files:**
- Create: `src/lib/profile/constants.ts`

- [ ] **Step 1: Implémenter**

Créer `src/lib/profile/constants.ts` :

```typescript
export const DOMAINS = [
  { code: 'business', label: 'Business / professionnel' },
  { code: 'tech', label: 'Tech / informatique' },
  { code: 'medical', label: 'Médical / santé' },
  { code: 'legal', label: 'Juridique' },
  { code: 'academic', label: 'Académique / études' },
  { code: 'travel', label: 'Voyage / tourisme' },
  { code: 'everyday', label: 'Vie quotidienne' },
] as const;

export const DOMAIN_CODES = DOMAINS.map((d) => d.code);

export const INTEREST_SUGGESTIONS = [
  'films',
  'musique',
  'sport',
  'jeux vidéo',
  'cuisine',
  'sciences',
  'philosophie',
  'actualités',
] as const;
```

- [ ] **Step 2: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected : 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/lib/profile/constants.ts
git commit -m "feat(profile): domain and interest constants"
```

---

### Task 14: Server action de sauvegarde du profil

**Files:**
- Create: `src/app/(app)/onboarding/profile/actions.ts`

- [ ] **Step 1: Implémenter l'action**

Créer `src/app/(app)/onboarding/profile/actions.ts` :

```typescript
'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { DOMAIN_CODES } from '@/lib/profile/constants';

export type ProfileResult = { ok: false; error: string };

const schema = z.object({
  domains: z.array(z.enum(DOMAIN_CODES as [string, ...string[]])).min(1),
  interests: z.array(z.string().min(1)).max(20),
  goalText: z.string().max(500),
});

export async function saveProfileAction(
  _prev: ProfileResult | null,
  formData: FormData,
): Promise<ProfileResult> {
  const user = await requireUser();
  const domains = formData.getAll('domains').map(String);
  const interests = String(formData.get('interests') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const goalText = String(formData.get('goalText') ?? '').trim();

  const parsed = schema.safeParse({ domains, interests, goalText });
  if (!parsed.success) {
    return { ok: false, error: 'Choisis au moins un domaine.' };
  }

  await db
    .update(profiles)
    .set({
      domains: parsed.data.domains,
      interests: parsed.data.interests,
      goalText: parsed.data.goalText,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, user.id));

  redirect('/home');
}
```

- [ ] **Step 2: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected : 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/onboarding/profile/actions.ts"
git commit -m "feat(profile): save profile server action"
```

---

### Task 15: Page profil

**Files:**
- Create: `src/app/(app)/onboarding/profile/page.tsx`, `src/app/(app)/onboarding/profile/profile-form.tsx`

- [ ] **Step 1: Composant formulaire client**

Créer `src/app/(app)/onboarding/profile/profile-form.tsx` :

```typescript
'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DOMAINS } from '@/lib/profile/constants';
import { type ProfileResult, saveProfileAction } from './actions';

export function ProfileForm() {
  const [state, formAction, pending] = useActionState<ProfileResult | null, FormData>(
    saveProfileAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-gray-800">Quels domaines veux-tu maîtriser ?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DOMAINS.map((d) => (
            <label key={d.code} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="domains" value={d.code} />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-800">Centres d'intérêt (séparés par des virgules)</span>
        <Input type="text" name="interests" placeholder="films, sport, cuisine" />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-800">Ton objectif (optionnel)</span>
        <textarea
          name="goalText"
          maxLength={500}
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          placeholder="Ex : passer le TOEFL, manager une équipe internationale…"
        />
      </label>

      {state && !state.ok && (
        <p role="alert" className="text-sm text-red-600">{state.error}</p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Enregistrement…' : 'Terminer'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Page profil**

Créer `src/app/(app)/onboarding/profile/page.tsx` :

```typescript
import { ProfileForm } from './profile-form';

export default function ProfilePage() {
  return (
    <section className="space-y-6 pt-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Personnalise ton parcours</h1>
        <p className="text-gray-700">
          Dis-nous ce que tu veux maîtriser pour qu'on adapte les exercices et les conversations.
        </p>
      </div>
      <ProfileForm />
    </section>
  );
}
```

- [ ] **Step 3: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected : 0 erreur. (Biome a11y peut demander un `id`/`htmlFor` ou un label associé pour le `<textarea>` : il est déjà enveloppé par `<label>`, donc OK.)

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/onboarding/profile/page.tsx" "src/app/(app)/onboarding/profile/profile-form.tsx"
git commit -m "feat(profile): profile setup page and form"
```

---

## Phase E — Onboarding routing, home, E2E

### Task 16: Gate d'onboarding

**Files:**
- Create: `src/lib/onboarding/gate.ts`, `src/lib/onboarding/gate.test.ts`

- [ ] **Step 1: Écrire les tests (TDD)**

Créer `src/lib/onboarding/gate.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { onboardingStep } from './gate';

describe('onboardingStep', () => {
  it('sends a brand-new user to placement', () => {
    expect(onboardingStep({ hasPlacement: false, profileComplete: false })).toBe('placement');
  });

  it('sends a placed-but-no-profile user to profile', () => {
    expect(onboardingStep({ hasPlacement: true, profileComplete: false })).toBe('profile');
  });

  it('sends a fully onboarded user to home', () => {
    expect(onboardingStep({ hasPlacement: true, profileComplete: true })).toBe('home');
  });

  it('keeps a user without placement at placement even if profile somehow set', () => {
    expect(onboardingStep({ hasPlacement: false, profileComplete: true })).toBe('placement');
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
pnpm test src/lib/onboarding/gate.test.ts
```

Expected : FAIL ("Cannot find module './gate'").

- [ ] **Step 3: Implémenter**

Créer `src/lib/onboarding/gate.ts` :

```typescript
export type OnboardingState = { hasPlacement: boolean; profileComplete: boolean };
export type OnboardingStep = 'placement' | 'profile' | 'home';

export function onboardingStep(state: OnboardingState): OnboardingStep {
  if (!state.hasPlacement) return 'placement';
  if (!state.profileComplete) return 'profile';
  return 'home';
}
```

- [ ] **Step 4: Relancer**

```bash
pnpm test src/lib/onboarding/gate.test.ts
```

Expected : 4 passed.

- [ ] **Step 5: Ajouter le helper qui lit l'état DB et celui qui redirige**

Ajouter à `src/lib/onboarding/gate.ts` :

```typescript
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { hasPlacement } from '@/lib/placement/session';

export async function loadOnboardingState(userId: string): Promise<OnboardingState> {
  const placed = await hasPlacement(userId);
  const rows = await db
    .select({ domains: profiles.domains, goalText: profiles.goalText })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  const row = rows[0];
  const profileComplete = !!row && row.domains.length > 0;
  return { hasPlacement: placed, profileComplete };
}

const STEP_PATH: Record<OnboardingStep, string> = {
  placement: '/onboarding/placement',
  profile: '/onboarding/profile',
  home: '/home',
};

// Call at the top of a page server component. If the user's real step differs
// from `expected`, redirect them to where they belong. Throws (redirect) on mismatch.
export async function requireOnboardingStep(userId: string, expected: OnboardingStep): Promise<void> {
  const step = onboardingStep(await loadOnboardingState(userId));
  if (step !== expected) {
    redirect(STEP_PATH[step]);
  }
}
```

- [ ] **Step 6: Compilation + lint + commit**

```bash
pnpm typecheck && pnpm lint
git add src/lib/onboarding/gate.ts src/lib/onboarding/gate.test.ts
git commit -m "feat(onboarding): step gate logic, db state loader and redirect guard"
```

---

### Task 17: Brancher le gate dans les pages et afficher les niveaux sur /home

On met la logique de redirection **dans chaque page** (server component), pas dans le layout : un Server Component lit son propre chemin par construction (c'est la page elle-même), donc pas besoin de transmettre le pathname. Chaque page appelle `requireOnboardingStep` avec l'étape qu'elle représente.

**Files:**
- Modify: `src/app/(app)/onboarding/placement/page.tsx`
- Modify: `src/app/(app)/onboarding/profile/page.tsx`
- Modify: `src/app/(app)/home/page.tsx`

- [ ] **Step 1: Gate sur la page placement**

Remplacer le contenu de `src/app/(app)/onboarding/placement/page.tsx` par :

```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireOnboardingStep } from '@/lib/onboarding/gate';
import { PlacementClient } from './placement-client';

export default async function PlacementPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await requireOnboardingStep(user.id, 'placement');

  return (
    <section className="space-y-6 pt-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Situons ton niveau</h1>
        <p className="text-gray-700">
          Quelques questions rapides pour estimer ton niveau d'anglais. Réponds du mieux que tu peux ;
          il n'y a pas d'échec, ça nous sert juste à personnaliser ton parcours.
        </p>
      </div>
      <PlacementClient />
    </section>
  );
}
```

- [ ] **Step 2: Gate sur la page profil**

Remplacer le contenu de `src/app/(app)/onboarding/profile/page.tsx` par :

```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireOnboardingStep } from '@/lib/onboarding/gate';
import { ProfileForm } from './profile-form';

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await requireOnboardingStep(user.id, 'profile');

  return (
    <section className="space-y-6 pt-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Personnalise ton parcours</h1>
        <p className="text-gray-700">
          Dis-nous ce que tu veux maîtriser pour qu'on adapte les exercices et les conversations.
        </p>
      </div>
      <ProfileForm />
    </section>
  );
}
```

- [ ] **Step 3: Gate + niveaux estimés sur /home**

Remplacer le contenu de `src/app/(app)/home/page.tsx` par :

```typescript
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { skillLevels } from '@/db/schema';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { levelToLabel } from '@/lib/cefr';
import { requireOnboardingStep } from '@/lib/onboarding/gate';
import { LogoutButton } from '@/components/logout-button';
import type { Skill } from '@/lib/exercises/types';

const SKILL_LABELS: Record<Skill, string> = {
  reading: 'Compréhension écrite',
  writing: 'Expression écrite',
  vocab: 'Vocabulaire',
  grammar: 'Grammaire',
};

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await requireOnboardingStep(user.id, 'home');

  const levels = user
    ? await db.select().from(skillLevels).where(eq(skillLevels.userId, user.id))
    : [];

  return (
    <section className="space-y-6 pt-6">
      <h1 className="text-2xl font-semibold">Bienvenue sur Teyen</h1>
      <p className="text-gray-700">Connecté en tant que <strong>{user?.email}</strong>.</p>

      <div className="space-y-2">
        <h2 className="text-lg font-medium">Tes niveaux estimés</h2>
        <ul className="grid grid-cols-2 gap-2">
          {levels.map((l) => (
            <li key={l.id} className="rounded-md border border-gray-200 bg-white p-3 text-sm">
              <span className="text-gray-600">{SKILL_LABELS[l.skill as Skill]}</span>
              <span className="ml-2 font-semibold">{levelToLabel(Number(l.cefrEstimate))}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-500">
          Estimations initiales — elles s'affineront au fil de tes exercices. Le tuteur arrive bientôt.
        </p>
      </div>

      <LogoutButton />
    </section>
  );
}
```

- [ ] **Step 4: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected : 0 erreur.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/onboarding/placement/page.tsx" "src/app/(app)/onboarding/profile/page.tsx" "src/app/(app)/home/page.tsx"
git commit -m "feat(onboarding): gate redirects in pages and show levels on home"
```

---

### Task 18: Test E2E du parcours d'onboarding complet

**Files:**
- Create: `tests/e2e/onboarding.spec.ts`
- Modify: `playwright.config.ts`

On force le faux générateur via `PLACEMENT_FAKE=1` pour ne pas appeler OpenAI pendant les E2E.

- [ ] **Step 1: Passer `PLACEMENT_FAKE=1` au serveur dev de Playwright**

Modifier `playwright.config.ts`, dans la commande `webServer.command` du cas non-CI, préfixer la variable. Remplacer la ligne `command:` par :

```typescript
        command: process.env.CI
          ? 'pnpm next dev'
          : 'pnpm exec dotenv -e .env.test -- cross-env PLACEMENT_FAKE=1 pnpm next dev',
```

Et pour le cas CI, exposer aussi le flag : ajouter `PLACEMENT_FAKE: '1'` à l'env du job CI dans `.github/workflows/ci.yml` (sous `env:`). (Note : pour le local on utilise `cross-env` pour la portabilité ; l'installer : `pnpm add -D cross-env`.)

- [ ] **Step 2: Installer cross-env**

```bash
pnpm add -D cross-env
```

- [ ] **Step 3: Écrire le test E2E**

Créer `tests/e2e/onboarding.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';

const randomEmail = () => `onb+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@teyen.test`;

test('new user is routed through placement then profile then home', async ({ page }) => {
  const email = randomEmail();
  const password = 'TestPassword123!';

  // Signup
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: /Créer mon compte/i }).click();

  // After signup, the gate sends the user to placement.
  await expect(page).toHaveURL(/\/onboarding\/placement$/);
  await expect(page.getByText(/Situons ton niveau/i)).toBeVisible();

  // Answer all 12 placement questions (fake generator: 4 options, click the first each time).
  for (let i = 0; i < 12; i++) {
    await expect(page.getByText(/Question \d+ \/ 12/)).toBeVisible();
    // Click the first option button (options render as ghost buttons after the prompt).
    await page.getByRole('button', { name: 'option A' }).click();
  }

  // Then routed to profile.
  await expect(page).toHaveURL(/\/onboarding\/profile$/);
  await page.getByLabel(/Business/i).check();
  await page.getByRole('button', { name: /Terminer/i }).click();

  // Finally home, with estimated levels visible.
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText(/Tes niveaux estimés/i)).toBeVisible();
  await expect(page.getByText(/Compréhension écrite/i)).toBeVisible();
});
```

- [ ] **Step 4: Lancer**

```bash
pnpm e2e tests/e2e/onboarding.spec.ts
```

Expected : 1 passed. (Si le bouton "option A" est ambigu parce que plusieurs items affichent les mêmes libellés à la suite, ajouter `.first()` ou attendre la disparition de la question précédente. Le `await expect(...Question N...)` avant chaque clic synchronise déjà les étapes.)

- [ ] **Step 5: Relancer toute la suite E2E + unit**

```bash
pnpm e2e
pnpm test
```

Expected : tous les tests passent (les 5 E2E auth de Plan 1 + le nouveau onboarding ; tous les tests unitaires).

- [ ] **Step 6: Lint + commit**

```bash
pnpm lint
git add tests/e2e/onboarding.spec.ts playwright.config.ts package.json pnpm-lock.yaml .github/workflows/ci.yml
git commit -m "test(e2e): full onboarding flow with fake generator"
```

---

## Critère de fin de Plan 2

- ✅ `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e` passent.
- ✅ Un nouvel utilisateur après signup est dirigé vers le placement, répond à 12 QCM, puis remplit son profil, puis voit ses 4 niveaux estimés sur `/home`.
- ✅ Les 4 lignes `skill_levels` sont créées avec `confidence = 0.30`.
- ✅ Le profil (domaines, intérêts, objectif) est persisté dans `profiles`.
- ✅ Les E2E utilisent le faux générateur (aucun appel OpenAI), et un appel OpenAI réel a été validé manuellement une fois (Task 5 Step 4).

## Ce qui reste (plans à venir)

- **Plan 3** : `pedagogical_engine` déterministe complet (sélection deux-phases, Leitner, anti-boucle, mise à jour des niveaux post-attempt) avec tests unitaires exhaustifs.
- **Plan 4** : chat agent (OpenAI tools), page chat, cartes exercice dans le chat, LLM-juge pour le writing, types d'exercices non-QCM.
- **Plan 5** : progress tracker (dashboard, série de jours), résumé de conversation, cost cap, suppression de compte.
- **Déploiement** : Tasks 26-27 de Plan 1 (push GitHub + Vercel) restent à faire.
