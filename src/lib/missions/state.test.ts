import { describe, expect, it } from 'vitest';
import { advance, DEFAULT_TURN_LIMIT, turnsLeft } from './state';

describe('mission state machine', () => {
  it('exposes a default turn limit between 3 and 5', () => {
    expect(DEFAULT_TURN_LIMIT).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_TURN_LIMIT).toBeLessThanOrEqual(5);
  });

  it('marks success when the objective is met', () => {
    const next = advance({ status: 'in_progress', turnCount: 0 }, true, 5);
    expect(next.status).toBe('success');
    expect(next.turnCount).toBe(1);
  });

  it('stays in progress when objective not met and turns remain', () => {
    const next = advance({ status: 'in_progress', turnCount: 0 }, false, 5);
    expect(next.status).toBe('in_progress');
    expect(next.turnCount).toBe(1);
  });

  it('marks incomplete when the turn limit is reached without success', () => {
    const next = advance({ status: 'in_progress', turnCount: 4 }, false, 5);
    expect(next.status).toBe('incomplete');
    expect(next.turnCount).toBe(5);
  });

  it('computes remaining turns, floored at 0', () => {
    expect(turnsLeft({ status: 'in_progress', turnCount: 2 }, 5)).toBe(3);
    expect(turnsLeft({ status: 'incomplete', turnCount: 5 }, 5)).toBe(0);
    expect(turnsLeft({ status: 'in_progress', turnCount: 7 }, 5)).toBe(0);
  });
});
