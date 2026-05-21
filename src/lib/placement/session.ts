import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { attempts, exercises, skillLevels } from '@/db/schema';
import type { ExerciseGenerator } from '@/lib/exercises/generator';
import type { Skill } from '@/lib/exercises/types';
import { estimateFromPresented, ITEMS_PER_SKILL, nextLevel, START_LEVEL } from './scoring';
import { placementTopic } from './topics';

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
): Promise<{
  exerciseId: string;
  prompt: string;
  passage: string | null;
  options: string[];
  slotIndex: number;
} | null> {
  const done = await answeredCount(userId);
  const slots = plannedSlots();
  if (done >= slots.length) return null;
  const slot = slots[done];
  if (!slot) return null;

  const level = await currentLevelForSkill(userId, slot.skill);
  const item = await generate({
    skill: slot.skill,
    level,
    topic: placementTopic(slot.skill, slot.index),
  });

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
  return {
    exerciseId: row.id,
    prompt: item.prompt,
    passage: item.passage,
    options: item.options,
    slotIndex: done,
  };
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

  // Idempotent: a double-submit for the same exercise must not create a second
  // attempt (which would over-count the 12-item placement and skew estimates).
  const existing = await db
    .select({ id: attempts.id })
    .from(attempts)
    .where(and(eq(attempts.userId, userId), eq(attempts.exerciseId, exerciseId)))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(attempts).values({
      userId,
      exerciseId,
      response: String(selectedIndex),
      score: correct ? '1' : '0',
      feedback: key.rationale,
    });
  }

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
  const rows = await db
    .select({ id: skillLevels.id })
    .from(skillLevels)
    .where(eq(skillLevels.userId, userId));
  return rows.length >= SKILL_ORDER.length;
}
