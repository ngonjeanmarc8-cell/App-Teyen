import { describe, expect, it } from 'vitest';
import { isColdStart, pickTopic, type SkillLevel, selectLevel, selectSkill } from './selection';

const lvl = (skill: SkillLevel['skill'], cefrEstimate: number, confidence: number): SkillLevel => ({
  skill,
  cefrEstimate,
  confidence,
});

describe('isColdStart', () => {
  it('is cold-start when any skill confidence is below 0.5', () => {
    expect(isColdStart([lvl('reading', 3, 0.3), lvl('writing', 3, 0.6)])).toBe(true);
  });
  it('is not cold-start when all confidences are at least 0.5', () => {
    expect(isColdStart([lvl('reading', 3, 0.5), lvl('writing', 4, 0.7)])).toBe(false);
  });
});

describe('selectSkill', () => {
  const cold: SkillLevel[] = [
    lvl('reading', 3, 0.3),
    lvl('writing', 3, 0.3),
    lvl('vocab', 3, 0.3),
    lvl('grammar', 3, 0.3),
  ];

  it('round-robins by practice count during cold-start', () => {
    expect(selectSkill(cold, 0, 0)).toBe('reading');
    expect(selectSkill(cold, 1, 0)).toBe('writing');
    expect(selectSkill(cold, 2, 0)).toBe('vocab');
    expect(selectSkill(cold, 3, 0)).toBe('grammar');
    expect(selectSkill(cold, 4, 0)).toBe('reading');
  });

  it('targets the lowest cefr skill in the stable phase', () => {
    const stable: SkillLevel[] = [
      lvl('reading', 5, 0.8),
      lvl('writing', 2, 0.8),
      lvl('vocab', 4, 0.8),
      lvl('grammar', 5, 0.8),
    ];
    expect(selectSkill(stable, 10, 0)).toBe('writing');
  });

  it('breaks stable-phase ties deterministically by seed', () => {
    const tie: SkillLevel[] = [
      lvl('reading', 3, 0.8),
      lvl('writing', 3, 0.8),
      lvl('vocab', 5, 0.8),
      lvl('grammar', 5, 0.8),
    ];
    expect(selectSkill(tie, 0, 0)).toBe('reading');
    expect(selectSkill(tie, 0, 1)).toBe('writing');
  });
});

describe('selectLevel', () => {
  it('rounds the cefr estimate to an integer level', () => {
    expect(selectLevel(lvl('reading', 3.4, 0.3))).toBe(3);
    expect(selectLevel(lvl('reading', 3.6, 0.3))).toBe(4);
  });
  it('clamps into 1..6', () => {
    expect(selectLevel(lvl('reading', 0.2, 0.3))).toBe(1);
    expect(selectLevel(lvl('reading', 9, 0.3))).toBe(6);
  });
});

describe('pickTopic', () => {
  it('avoids the last topic when alternatives exist', () => {
    const pool = ['business', 'films', 'travel'];
    expect(pickTopic(pool, 'business', 0)).not.toBe('business');
  });
  it('returns a member of the pool', () => {
    const pool = ['business', 'films'];
    expect(pool).toContain(pickTopic(pool, null, 0));
  });
  it('falls back to daily life when the pool is empty', () => {
    expect(pickTopic([], null, 0)).toBe('daily life');
  });
  it('is deterministic for the same args', () => {
    const pool = ['a', 'b', 'c'];
    expect(pickTopic(pool, null, 5)).toBe(pickTopic(pool, null, 5));
  });
});
