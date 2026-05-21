# Teyen MVP — Plan 3 : Moteur pédagogique + pratique

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le moteur pédagogique déterministe (choix de la prochaine cible : compétence, niveau, thème ; mise à jour adaptative des niveaux après chaque réponse) et une page `/practice` minimale qui l'utilise en boucle : le moteur choisit, on génère un QCM, l'utilisateur répond, son niveau s'ajuste.

**Architecture:** Le moteur est en deux couches : (1) logique **pure** déterministe (`src/lib/engine/selection.ts`, `src/lib/engine/update.ts`) testée unitairement ; (2) une couche **DB** (`src/lib/engine/session.ts`) qui lit `skill_levels`/`profiles`/`exercises`, appelle la logique pure, génère un QCM (réutilise le générateur de Plan 2) et persiste. Une page `/practice` consomme le tout via deux routes API. Les exercices de pratique sont stockés avec `domain = 'practice'` pour les distinguer des items de placement (`domain = 'placement'`).

**Tech Stack:** Drizzle (tables existantes `skill_levels`, `profiles`, `exercises`, `attempts`), réutilise `src/lib/exercises/generator.ts` (`getGenerator`, gated par `PLACEMENT_FAKE=1`), `src/lib/cefr.ts`, Next.js 16 (Route Handlers + Server Component), React 19, Vitest, Playwright.

---

## Contexte : état du projet (fin Plan 2)

Plans 1 et 2 terminés en local. Disponible et pertinent pour ce plan :
- `src/lib/exercises/types.ts` → `SKILLS` (= `['reading','writing','vocab','grammar']`, ordre canonique, **module pur sans dépendance DB**), `Skill`, `McqItem`, `GenerationSpec`, `mcqItemSchema`.
- `src/lib/exercises/generator.ts` → `getGenerator()` (retourne `fakeGenerator` si `process.env.PLACEMENT_FAKE === '1'`, sinon `openAiGenerator`), type `ExerciseGenerator`.
- `src/lib/cefr.ts` → `clampLevel`, `levelToLabel`.
- `src/db/schema.ts` → tables. `exercises` : id, userId, type (`'mcq'`...), skill, cefr (numeric string), topic, domain, payload (jsonb `{passage,prompt,options}`), answerKey (jsonb `{correctIndex,rationale}`), createdAt. `attempts` : id, userId, exerciseId, response, score (numeric string), feedback, createdAt. `skill_levels` : id, userId, skill, cefrEstimate (numeric string), confidence (numeric string), updatedAt ; unique (userId, skill).
- `src/lib/auth.ts` → `requireUser`, `UnauthorizedError`.
- `src/lib/onboarding/gate.ts` → `requireOnboardingStep(userId, expected)`.
- `src/lib/supabase/server.ts` → `createSupabaseServerClient`.
- `src/components/ui/button.tsx` → `Button` ; `src/components/logout-button.tsx` → `LogoutButton`.
- Onboarding : après placement+profil, l'utilisateur a 4 lignes `skill_levels` (confidence 0.30) et un profil rempli (domaines + intérêts + objectif).
- Tests E2E lancés avec `PLACEMENT_FAKE=1` (faux générateur déterministe ; options `option A`..`option D`).

## Conventions et décisions de ce plan

- **Échelle CEFR** : A1=1 … C2=6 (numérique, cf. Plan 2). `clampLevel` borne à [1,6].
- **Stratégie de sélection (deux phases)** :
  - *Cold-start* — au moins une compétence a `confidence < 0.5` : round-robin sur `SKILLS` indexé par le nombre d'exercices de pratique déjà faits (`SKILLS[practiceCount % 4]`).
  - *Stable* — toutes les compétences `confidence ≥ 0.5` : cible la compétence au `cefr_estimate` le plus bas ; égalité tranchée déterministe par un seed (hash de `userId + date du jour`).
- **Niveau de pratique** : `round(clampLevel(cefr_estimate))` de la compétence ciblée. **Pas de cap cold-start séparé** : la sécurité vient de l'amortissement du delta (`×(1-confidence)`), qui rend la progression lente tant que la confiance est basse.
- **Mise à jour après réponse** : `delta = signe × 0.1 × (1 - confidence)`, signe = +1 si score ≥ 0.7, −1 si ≤ 0.3, 0 sinon ; `confidence += 0.02` plafonné à 0.95.
- **Topic** : tiré (déterministe par seed, en évitant le dernier topic) de `profile.domains ∪ profile.interests`. Fallback `'daily life'` si pool vide.
- **Type d'exercice** : uniquement `mcq` pour ce plan (les autres types et l'anti-boucle sur types viennent en Plan 4 avec leurs générateurs). Le moteur choisit compétence/niveau/thème ; le type est implicitement `mcq`.
- **Leitner / `knowledge_items`** : **hors scope** (reporté à Plan 4/5, faute de source d'items avant le tuteur).
- Les exercices de pratique : `domain = 'practice'`, `topic = <topic réel>`. Le placement reste `domain = 'placement'`, `topic = 'placement:...'`. La distinction se fait sur `domain`.

## File Structure

| Fichier | Responsabilité |
|---|---|
| `src/lib/engine/selection.ts` | Pur : `isColdStart`, `selectSkill`, `selectLevel`, `pickTopic`, type `SkillLevel` |
| `src/lib/engine/update.ts` | Pur : `applyAttempt` (delta + confidence) |
| `src/lib/engine/session.ts` | DB : `selectNextPractice`, `submitPractice` (+ helpers de lecture) |
| `src/app/api/practice/next/route.ts` | Génère/retourne le prochain exercice de pratique |
| `src/app/api/practice/answer/route.ts` | Score, met à jour le niveau, renvoie le feedback |
| `src/app/(app)/practice/practice-client.tsx` | Boucle de pratique interactive |
| `src/app/(app)/practice/page.tsx` | Page pratique (gated 'home') |
| `src/app/(app)/home/page.tsx` | (modifié) ajoute un lien vers `/practice` |

## Vue d'ensemble

| # | Tasks |
|---|---|
| Logique pure | 1–2 |
| Couche DB | 3 |
| Routes API | 4–5 |
| UI | 6–7 |
| Intégration home + E2E | 8–9 |

Total : **9 tâches**.

---

## Task 1: Logique de sélection (pure)

**Files:**
- Create: `src/lib/engine/selection.ts`, `src/lib/engine/selection.test.ts`

- [ ] **Step 1: Écrire les tests (TDD)**

Créer `src/lib/engine/selection.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { isColdStart, pickTopic, selectLevel, selectSkill, type SkillLevel } from './selection';

const lvl = (skill: SkillLevel['skill'], cefrEstimate: number, confidence: number): SkillLevel => ({
  skill,
  cefrEstimate,
  confidence,
});

describe('isColdStart', () => {
  it('is cold-start when any skill confidence is below 0.5', () => {
    expect(isColdStart([lvl('reading', 3, 0.3), lvl('writing', 3, 0.6)])).toBe(true);
  });
  it('is not cold-start when all confidences are at least 0.5', () => {
    expect(isColdStart([lvl('reading', 3, 0.5), lvl('writing', 4, 0.7)])).toBe(false);
  });
});

describe('selectSkill', () => {
  const cold: SkillLevel[] = [
    lvl('reading', 3, 0.3),
    lvl('writing', 3, 0.3),
    lvl('vocab', 3, 0.3),
    lvl('grammar', 3, 0.3),
  ];

  it('round-robins by practice count during cold-start', () => {
    expect(selectSkill(cold, 0, 0)).toBe('reading');
    expect(selectSkill(cold, 1, 0)).toBe('writing');
    expect(selectSkill(cold, 2, 0)).toBe('vocab');
    expect(selectSkill(cold, 3, 0)).toBe('grammar');
    expect(selectSkill(cold, 4, 0)).toBe('reading');
  });

  it('targets the lowest cefr skill in the stable phase', () => {
    const stable: SkillLevel[] = [
      lvl('reading', 5, 0.8),
      lvl('writing', 2, 0.8),
      lvl('vocab', 4, 0.8),
      lvl('grammar', 5, 0.8),
    ];
    expect(selectSkill(stable, 10, 0)).toBe('writing');
  });

  it('breaks stable-phase ties deterministically by seed', () => {
    const tie: SkillLevel[] = [
      lvl('reading', 3, 0.8),
      lvl('writing', 3, 0.8),
      lvl('vocab', 5, 0.8),
      lvl('grammar', 5, 0.8),
    ];
    // candidates sorted alphabetically: ['reading','writing']; seed picks index seed%2
    expect(selectSkill(tie, 0, 0)).toBe('reading');
    expect(selectSkill(tie, 0, 1)).toBe('writing');
  });
});

describe('selectLevel', () => {
  it('rounds the cefr estimate to an integer level', () => {
    expect(selectLevel(lvl('reading', 3.4, 0.3))).toBe(3);
    expect(selectLevel(lvl('reading', 3.6, 0.3))).toBe(4);
  });
  it('clamps into 1..6', () => {
    expect(selectLevel(lvl('reading', 0.2, 0.3))).toBe(1);
    expect(selectLevel(lvl('reading', 9, 0.3))).toBe(6);
  });
});

describe('pickTopic', () => {
  it('avoids the last topic when alternatives exist', () => {
    const pool = ['business', 'films', 'travel'];
    expect(pickTopic(pool, 'business', 0)).not.toBe('business');
  });
  it('returns a member of the pool', () => {
    const pool = ['business', 'films'];
    expect(pool).toContain(pickTopic(pool, null, 0));
  });
  it('falls back to daily life when the pool is empty', () => {
    expect(pickTopic([], null, 0)).toBe('daily life');
  });
  it('is deterministic for the same args', () => {
    const pool = ['a', 'b', 'c'];
    expect(pickTopic(pool, null, 5)).toBe(pickTopic(pool, null, 5));
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
pnpm test src/lib/engine/selection.test.ts
```

Expected : FAIL ("Cannot find module './selection'").

- [ ] **Step 3: Implémenter**

Créer `src/lib/engine/selection.ts` :

```typescript
import { clampLevel } from '@/lib/cefr';
import { SKILLS, type Skill } from '@/lib/exercises/types';

export type SkillLevel = { skill: Skill; cefrEstimate: number; confidence: number };

const COLD_START_THRESHOLD = 0.5;

export function isColdStart(levels: SkillLevel[]): boolean {
  return levels.some((l) => l.confidence < COLD_START_THRESHOLD);
}

export function selectSkill(levels: SkillLevel[], practiceCount: number, seed: number): Skill {
  if (levels.length === 0) return 'reading';

  if (isColdStart(levels)) {
    return SKILLS[practiceCount % SKILLS.length] ?? 'reading';
  }

  const minEstimate = Math.min(...levels.map((l) => l.cefrEstimate));
  const candidates = levels
    .filter((l) => l.cefrEstimate === minEstimate)
    .map((l) => l.skill)
    .sort();
  return candidates[seed % candidates.length] ?? 'reading';
}

export function selectLevel(level: SkillLevel): number {
  return Math.round(clampLevel(level.cefrEstimate));
}

export function pickTopic(pool: string[], lastTopic: string | null, seed: number): string {
  const cleaned = pool.map((t) => t.trim()).filter((t) => t.length > 0);
  if (cleaned.length === 0) return 'daily life';
  const withoutLast = cleaned.filter((t) => t !== lastTopic);
  const pickFrom = withoutLast.length > 0 ? withoutLast : cleaned;
  return pickFrom[seed % pickFrom.length] ?? 'daily life';
}
```

- [ ] **Step 4: Relancer**

```bash
pnpm test src/lib/engine/selection.test.ts
```

Expected : tous les tests passent.

- [ ] **Step 5: Lint + commit**

```bash
pnpm lint:fix && pnpm lint
git add src/lib/engine/selection.ts src/lib/engine/selection.test.ts
git commit -m "feat(engine): pure selection logic (skill, level, topic)"
```

---

## Task 2: Mise à jour des niveaux (pure)

**Files:**
- Create: `src/lib/engine/update.ts`, `src/lib/engine/update.test.ts`

- [ ] **Step 1: Écrire les tests (TDD)**

Créer `src/lib/engine/update.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { applyAttempt } from './update';

describe('applyAttempt', () => {
  it('raises the level on a correct answer, damped by confidence', () => {
    const r = applyAttempt(3, 0.3, 1);
    expect(r.level).toBe(3.07); // 3 + 0.1*(1-0.3)
    expect(r.confidence).toBe(0.32);
  });

  it('lowers the level on a wrong answer, damped by confidence', () => {
    const r = applyAttempt(3, 0.3, 0);
    expect(r.level).toBe(2.93);
    expect(r.confidence).toBe(0.32);
  });

  it('does not move the level for a middling score', () => {
    const r = applyAttempt(3, 0.3, 0.5);
    expect(r.level).toBe(3);
    expect(r.confidence).toBe(0.32);
  });

  it('moves less as confidence grows', () => {
    const low = applyAttempt(3, 0.1, 1).level;
    const high = applyAttempt(3, 0.9, 1).level;
    expect(low - 3).toBeGreaterThan(high - 3);
  });

  it('clamps the level into 1..6', () => {
    expect(applyAttempt(6, 0.1, 1).level).toBe(6);
    expect(applyAttempt(1, 0.1, 0).level).toBe(1);
  });

  it('caps confidence at 0.95', () => {
    expect(applyAttempt(3, 0.94, 1).confidence).toBe(0.95);
    expect(applyAttempt(3, 0.95, 1).confidence).toBe(0.95);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
pnpm test src/lib/engine/update.test.ts
```

Expected : FAIL ("Cannot find module './update'").

- [ ] **Step 3: Implémenter**

Créer `src/lib/engine/update.ts` :

```typescript
import { clampLevel } from '@/lib/cefr';

const STEP = 0.1;
const CONFIDENCE_INCREMENT = 0.02;
const CONFIDENCE_CAP = 0.95;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function applyAttempt(
  currentLevel: number,
  currentConfidence: number,
  score: number,
): { level: number; confidence: number } {
  const sign = score >= 0.7 ? 1 : score <= 0.3 ? -1 : 0;
  const delta = sign * STEP * (1 - currentConfidence);
  const level = round2(clampLevel(currentLevel + delta));
  const confidence = Math.min(CONFIDENCE_CAP, round2(currentConfidence + CONFIDENCE_INCREMENT));
  return { level, confidence };
}
```

- [ ] **Step 4: Relancer**

```bash
pnpm test src/lib/engine/update.test.ts
```

Expected : tous les tests passent.

- [ ] **Step 5: Lint + commit**

```bash
pnpm lint:fix && pnpm lint
git add src/lib/engine/update.ts src/lib/engine/update.test.ts
git commit -m "feat(engine): adaptive level update after an attempt"
```

---

## Task 3: Couche DB du moteur (sélection + soumission)

**Files:**
- Create: `src/lib/engine/session.ts`

Pas de test unitaire ici (code DB) ; couvert par l'E2E (Task 9) + typecheck. Suit le même style que `src/lib/placement/session.ts`.

- [ ] **Step 1: Implémenter**

Créer `src/lib/engine/session.ts` :

```typescript
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { attempts, exercises, profiles, skillLevels } from '@/db/schema';
import type { ExerciseGenerator } from '@/lib/exercises/generator';
import type { Skill } from '@/lib/exercises/types';
import { type SkillLevel, pickTopic, selectLevel, selectSkill } from './selection';
import { applyAttempt } from './update';

const PRACTICE_DOMAIN = 'practice';

// Deterministic per-user, per-day seed for tie-breaking and topic rotation.
function daySeed(userId: string): number {
  const key = `${userId}:${new Date().toISOString().slice(0, 10)}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) % 1_000_000;
  }
  return h;
}

async function loadSkillLevels(userId: string): Promise<SkillLevel[]> {
  const rows = await db.select().from(skillLevels).where(eq(skillLevels.userId, userId));
  return rows.map((r) => ({
    skill: r.skill as Skill,
    cefrEstimate: Number(r.cefrEstimate),
    confidence: Number(r.confidence),
  }));
}

async function practiceCount(userId: string): Promise<number> {
  const rows = await db
    .select({ id: attempts.id })
    .from(attempts)
    .innerJoin(exercises, eq(attempts.exerciseId, exercises.id))
    .where(and(eq(attempts.userId, userId), eq(exercises.domain, PRACTICE_DOMAIN)));
  return rows.length;
}

async function lastPracticeTopic(userId: string): Promise<string | null> {
  const rows = await db
    .select({ topic: exercises.topic })
    .from(exercises)
    .where(and(eq(exercises.userId, userId), eq(exercises.domain, PRACTICE_DOMAIN)))
    .orderBy(desc(exercises.createdAt))
    .limit(1);
  return rows[0]?.topic ?? null;
}

async function profilePool(userId: string): Promise<string[]> {
  const rows = await db
    .select({ domains: profiles.domains, interests: profiles.interests })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return [];
  return [...row.domains, ...row.interests];
}

export async function selectNextPractice(
  userId: string,
  generate: ExerciseGenerator,
): Promise<{ exerciseId: string; passage: string | null; prompt: string; options: string[]; skill: Skill }> {
  const levels = await loadSkillLevels(userId);
  const count = await practiceCount(userId);
  const seed = daySeed(userId) + count;

  const skill = selectSkill(levels, count, seed);
  const skillLevel = levels.find((l) => l.skill === skill);
  const level = skillLevel ? selectLevel(skillLevel) : 3;
  const topic = pickTopic(await profilePool(userId), await lastPracticeTopic(userId), seed);

  const item = await generate({ skill, level, topic });

  const inserted = await db
    .insert(exercises)
    .values({
      userId,
      type: 'mcq',
      skill,
      cefr: String(level),
      topic,
      domain: PRACTICE_DOMAIN,
      payload: { passage: item.passage, prompt: item.prompt, options: item.options },
      answerKey: { correctIndex: item.correctIndex, rationale: item.rationale },
    })
    .returning({ id: exercises.id });

  const row = inserted[0];
  if (!row) throw new Error('failed to insert practice exercise');
  return { exerciseId: row.id, passage: item.passage, prompt: item.prompt, options: item.options, skill };
}

export async function submitPractice(
  userId: string,
  exerciseId: string,
  selectedIndex: number,
): Promise<{ correct: boolean; correctIndex: number; rationale: string }> {
  const rows = await db.select().from(exercises).where(eq(exercises.id, exerciseId)).limit(1);
  const ex = rows[0];
  if (!ex || ex.userId !== userId) throw new Error('exercise not found for user');
  if (ex.domain !== PRACTICE_DOMAIN) throw new Error('not a practice exercise');

  const key = ex.answerKey as { correctIndex: number; rationale: string };
  const correct = key.correctIndex === selectedIndex;
  const score = correct ? 1 : 0;

  await db.insert(attempts).values({
    userId,
    exerciseId,
    response: String(selectedIndex),
    score: String(score),
    feedback: key.rationale,
  });

  const levelRows = await db
    .select()
    .from(skillLevels)
    .where(and(eq(skillLevels.userId, userId), eq(skillLevels.skill, ex.skill)))
    .limit(1);
  const current = levelRows[0];
  if (current) {
    const updated = applyAttempt(Number(current.cefrEstimate), Number(current.confidence), score);
    await db
      .update(skillLevels)
      .set({
        cefrEstimate: String(updated.level),
        confidence: String(updated.confidence),
        updatedAt: new Date(),
      })
      .where(and(eq(skillLevels.userId, userId), eq(skillLevels.skill, ex.skill)));
  }

  return { correct, correctIndex: key.correctIndex, rationale: key.rationale };
}
```

- [ ] **Step 2: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint:fix && pnpm lint
```

Expected : 0 erreur. (`ex.skill` est typé par l'enum Drizzle `skill_kind` ; il est compatible avec `Skill`. Si le typage de l'enum diffère de `Skill`, caster : `ex.skill as Skill` dans l'appel `eq(skillLevels.skill, ex.skill)` n'est pas nécessaire car la colonne est du même enum — garder tel quel sauf erreur de type.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/engine/session.ts
git commit -m "feat(engine): db layer selecting and recording practice exercises"
```

---

## Task 4: Route API — prochain exercice de pratique

**Files:**
- Create: `src/app/api/practice/next/route.ts`

- [ ] **Step 1: Implémenter**

Créer `src/app/api/practice/next/route.ts` :

```typescript
import { NextResponse } from 'next/server';
import { requireUser, UnauthorizedError } from '@/lib/auth';
import { getGenerator } from '@/lib/exercises/generator';
import { selectNextPractice } from '@/lib/engine/session';

export async function POST() {
  try {
    const user = await requireUser();
    const item = await selectNextPractice(user.id, getGenerator());
    return NextResponse.json({
      exerciseId: item.exerciseId,
      passage: item.passage,
      prompt: item.prompt,
      options: item.options,
      skill: item.skill,
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

Expected : 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/practice/next/route.ts
git commit -m "feat(practice): api route to fetch the next practice exercise"
```

---

## Task 5: Route API — soumettre une réponse de pratique

**Files:**
- Create: `src/app/api/practice/answer/route.ts`

- [ ] **Step 1: Implémenter**

Créer `src/app/api/practice/answer/route.ts` :

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, UnauthorizedError } from '@/lib/auth';
import { submitPractice } from '@/lib/engine/session';

const bodySchema = z.object({
  exerciseId: z.uuid(),
  selectedIndex: z.number().int().min(0).max(3),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const result = await submitPractice(user.id, parsed.data.exerciseId, parsed.data.selectedIndex);
    return NextResponse.json(result);
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

Expected : 0 erreur. (`z.uuid()` est la forme Zod 4 utilisée ailleurs dans le projet.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/practice/answer/route.ts
git commit -m "feat(practice): api route to submit a practice answer"
```

---

## Task 6: Composant client de pratique

**Files:**
- Create: `src/app/(app)/practice/practice-client.tsx`

- [ ] **Step 1: Implémenter**

Créer `src/app/(app)/practice/practice-client.tsx` :

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type Item = {
  exerciseId: string;
  passage: string | null;
  prompt: string;
  options: string[];
  skill: string;
};

type Feedback = { correct: boolean; correctIndex: number; rationale: string };

const SKILL_LABELS: Record<string, string> = {
  reading: 'Compréhension écrite',
  writing: 'Expression écrite',
  vocab: 'Vocabulaire',
  grammar: 'Grammaire',
};

export function PracticeClient() {
  const [item, setItem] = useState<Item | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadNext() {
    setLoading(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch('/api/practice/next', { method: 'POST' });
      if (!res.ok) throw new Error('network');
      setItem((await res.json()) as Item);
    } catch {
      setError('Petit souci de chargement. Réessaie.');
    } finally {
      setLoading(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: load the first exercise once on mount
  useEffect(() => {
    void loadNext();
  }, []);

  async function answer(selectedIndex: number) {
    if (!item || feedback) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/practice/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ exerciseId: item.exerciseId, selectedIndex }),
      });
      if (!res.ok) throw new Error('network');
      setFeedback((await res.json()) as Feedback);
    } catch {
      setError('Petit souci. Réessaie.');
    } finally {
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

  if (loading && !item) {
    return <p className="text-gray-600">Chargement…</p>;
  }

  if (!item) {
    return <p className="text-gray-600">Chargement…</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-xs uppercase tracking-wide text-gray-400">{SKILL_LABELS[item.skill] ?? item.skill}</p>
      {item.passage && <p className="rounded-md bg-gray-100 p-4 text-sm">{item.passage}</p>}
      <p className="font-medium">{item.prompt}</p>
      <div className="grid gap-2">
        {item.options.map((opt, i) => {
          const isCorrect = feedback && i === feedback.correctIndex;
          const tone = feedback
            ? isCorrect
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200'
            : 'border-gray-200';
          return (
            <Button
              key={opt}
              variant="ghost"
              className={`justify-start border ${tone}`}
              disabled={loading || feedback !== null}
              onClick={() => void answer(i)}
            >
              {opt}
            </Button>
          );
        })}
      </div>
      {feedback && (
        <div className="space-y-3">
          <p className={`text-sm font-medium ${feedback.correct ? 'text-green-700' : 'text-red-600'}`}>
            {feedback.correct ? 'Correct !' : 'Pas tout à fait.'}
          </p>
          <p className="text-sm text-gray-700">{feedback.rationale}</p>
          <Button onClick={() => void loadNext()}>Question suivante</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint:fix && pnpm lint
```

Expected : 0 erreur. (Garder le `biome-ignore` du `useEffect`. `key={opt}` comme dans le placement pour éviter `noArrayIndexKey`.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/practice/practice-client.tsx"
git commit -m "feat(practice): interactive practice loop client"
```

---

## Task 7: Page de pratique (gated)

**Files:**
- Create: `src/app/(app)/practice/page.tsx`

- [ ] **Step 1: Implémenter**

Créer `src/app/(app)/practice/page.tsx` :

```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireOnboardingStep } from '@/lib/onboarding/gate';
import { PracticeClient } from './practice-client';

export default async function PracticePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await requireOnboardingStep(user.id, 'home');

  return (
    <section className="space-y-6 pt-6">
      <h1 className="text-2xl font-semibold">Pratique</h1>
      <p className="text-gray-700">
        Des exercices choisis pour toi selon ton niveau. Réponds, lis l'explication, continue.
      </p>
      <PracticeClient />
    </section>
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
git add "src/app/(app)/practice/page.tsx"
git commit -m "feat(practice): practice page gated to onboarded users"
```

---

## Task 8: Lien vers la pratique depuis /home

**Files:**
- Modify: `src/app/(app)/home/page.tsx`

- [ ] **Step 1: Ajouter un bouton vers /practice**

Dans `src/app/(app)/home/page.tsx`, ajouter l'import de `Link` et `Button` en tête (avec les imports existants) :

```typescript
import Link from 'next/link';
import { Button } from '@/components/ui/button';
```

Puis, juste **avant** le `<LogoutButton />` dans le JSX rendu, insérer :

```tsx
      <Link href="/practice">
        <Button>Commencer une session de pratique</Button>
      </Link>
```

(Ne pas toucher au reste de la page : gate, requête `skillLevels`, affichage des niveaux.)

- [ ] **Step 2: Vérifier compilation + lint**

```bash
pnpm typecheck && pnpm lint:fix && pnpm lint
```

Expected : 0 erreur. (Biome ordonnera les imports : `next/link` et le composant `@/`. Accepter l'ordre.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/home/page.tsx"
git commit -m "feat(home): link to the practice session"
```

---

## Task 9: Test E2E de la boucle de pratique

**Files:**
- Create: `tests/e2e/practice.spec.ts`

L'E2E réutilise `PLACEMENT_FAKE=1` (déjà passé au serveur dev de Playwright et au CI) : le faux générateur sert aussi la pratique (`getGenerator` lit le même flag). Le faux générateur renvoie toujours les options `option A`..`option D`.

- [ ] **Step 1: Écrire le test**

Créer `tests/e2e/practice.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';

const randomEmail = () => `prac+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@teyen.test`;

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

test('an onboarded user can practice: answer, see feedback, get the next one', async ({ page }) => {
  await completeOnboarding(page);

  // Go to practice from home.
  await page.getByRole('link', { name: /Commencer une session de pratique/i }).click();
  await expect(page).toHaveURL(/\/practice$/);

  // First exercise loads (fake generator → "option A".."option D").
  await expect(page.getByRole('button', { name: 'option A' })).toBeVisible();

  // Answer it.
  await page.getByRole('button', { name: 'option A' }).click();

  // Feedback appears (either "Correct !" or "Pas tout à fait.") plus a "next" button.
  await expect(page.getByRole('button', { name: /Question suivante/i })).toBeVisible();

  // Go to the next exercise.
  await page.getByRole('button', { name: /Question suivante/i }).click();
  await expect(page.getByRole('button', { name: 'option A' })).toBeVisible();
});

test('/api/practice/next requires auth', async ({ request }) => {
  const res = await request.post('/api/practice/next');
  expect(res.status()).toBe(401);
});
```

- [ ] **Step 2: Lancer le test pratique**

```bash
pnpm e2e tests/e2e/practice.spec.ts
```

Expected : 2 passed.

Note : si le bouton "option A" du feedback reste cliquable et provoque une ambiguïté, c'est que `disabled={feedback !== null}` n'a pas pris — vérifier le composant. Le test clique d'abord une option, attend le bouton "Question suivante", ce qui synchronise.

- [ ] **Step 3: Suite complète + commit**

```bash
pnpm e2e
pnpm test
pnpm lint
git add tests/e2e/practice.spec.ts
git commit -m "test(e2e): practice loop answer-feedback-next"
```

Expected : toute la suite passe (E2E auth + onboarding + practice ; tous les tests unitaires).

---

## Critère de fin de Plan 3

- ✅ `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e` passent.
- ✅ Un utilisateur onboardé clique « Commencer une session de pratique », reçoit un QCM choisi par le moteur, répond, voit un feedback (correct/incorrect + explication), et enchaîne sur l'exercice suivant.
- ✅ Le `cefr_estimate` et la `confidence` de la compétence pratiquée se mettent à jour après chaque réponse (logique `applyAttempt`, testée unitairement).
- ✅ La sélection respecte les deux phases (cold-start round-robin / stable lowest-cefr), testée unitairement.
- ✅ Les exercices de pratique (`domain='practice'`) coexistent avec ceux de placement (`domain='placement'`) sans interférence.

## Ce qui reste (plans à venir)

- **Plan 4** : tuteur conversationnel (OpenAI tools), page chat, cartes exercice dans le chat, LLM-juge pour le writing, types d'exercices non-QCM, **et** branchement de Leitner/`knowledge_items` (extraction du vocab depuis les conversations).
- **Plan 5** : progress tracker (dashboard détaillé, série de jours), résumé de conversation, cost cap par utilisateur/jour, suppression de compte.
- **Déploiement** : Tasks 26-27 de Plan 1 (push GitHub + Vercel) restent à faire.
