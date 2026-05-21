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
