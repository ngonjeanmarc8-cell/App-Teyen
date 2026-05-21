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

  it('still moves the level at max confidence (no freeze from rounding)', () => {
    // delta = 0.1 * (1 - 0.95) = 0.005; must survive rounding (3 decimals)
    expect(applyAttempt(3, 0.95, 1).level).toBe(3.005);
    expect(applyAttempt(3, 0.95, 0).level).toBe(2.995);
  });
});
