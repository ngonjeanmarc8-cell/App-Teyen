import { describe, expect, it } from 'vitest';
import { estimateFromPresented, ITEMS_PER_SKILL, nextLevel, START_LEVEL } from './scoring';

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
