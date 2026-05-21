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
