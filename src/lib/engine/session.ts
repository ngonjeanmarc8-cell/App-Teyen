import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { attempts, exercises, profiles, skillLevels } from '@/db/schema';
import type { ExerciseGenerator } from '@/lib/exercises/generator';
import type { Skill } from '@/lib/exercises/types';
import { pickTopic, type SkillLevel, selectLevel, selectSkill } from './selection';
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
): Promise<{
  exerciseId: string;
  passage: string | null;
  prompt: string;
  options: string[];
  skill: Skill;
}> {
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
  return {
    exerciseId: row.id,
    passage: item.passage,
    prompt: item.prompt,
    options: item.options,
    skill,
  };
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
