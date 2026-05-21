import { clampLevel } from '@/lib/cefr';

const STEP = 0.1;
const CONFIDENCE_INCREMENT = 0.02;
const CONFIDENCE_CAP = 0.95;

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

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
  // Round the level to 3 decimals (DB stores numeric(5,3)). At high confidence
  // the delta shrinks to 0.005, which 2-decimal rounding would swallow —
  // freezing adaptation. 3 decimals keeps the damped signal alive.
  const level = round3(clampLevel(currentLevel + delta));
  const confidence = Math.min(CONFIDENCE_CAP, round2(currentConfidence + CONFIDENCE_INCREMENT));
  return { level, confidence };
}
