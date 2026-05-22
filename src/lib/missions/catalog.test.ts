import { describe, expect, it } from 'vitest';
import { CEFR_LABELS } from '@/lib/cefr';
import { ALL_MISSIONS, getMission } from './catalog';

describe('mission catalog', () => {
  it('has at least 10 missions', () => {
    expect(ALL_MISSIONS.length).toBeGreaterThanOrEqual(10);
  });

  it('has unique ids', () => {
    const ids = ALL_MISSIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every mission is well-formed', () => {
    for (const m of ALL_MISSIONS) {
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.scenario.length).toBeGreaterThan(0);
      expect(m.objective.length).toBeGreaterThan(0);
      expect(m.opener.length).toBeGreaterThan(0);
      expect(m.requiredVocab.length).toBeGreaterThan(0);
      expect(m.turnLimit).toBeGreaterThanOrEqual(3);
      expect(m.turnLimit).toBeLessThanOrEqual(5);
      expect(CEFR_LABELS).toContain(m.cefr);
    }
  });

  it('getMission returns a mission by id and undefined otherwise', () => {
    const first = ALL_MISSIONS[0];
    expect(first).toBeDefined();
    if (first) {
      expect(getMission(first.id)?.id).toBe(first.id);
    }
    expect(getMission('does-not-exist')).toBeUndefined();
  });
});
