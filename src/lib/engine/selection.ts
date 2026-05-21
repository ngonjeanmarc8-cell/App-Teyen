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
