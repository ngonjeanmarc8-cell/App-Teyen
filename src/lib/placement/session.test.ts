import { describe, expect, it } from 'vitest';
import { parsePlacementTag, placementTopicTag, plannedSlots, SKILL_ORDER } from './session';

describe('placement session helpers', () => {
  it('orders skills reading, writing, vocab, grammar', () => {
    expect(SKILL_ORDER).toEqual(['reading', 'writing', 'vocab', 'grammar']);
  });

  it('builds and parses a placement topic tag', () => {
    const tag = placementTopicTag('grammar', 2);
    expect(tag).toBe('placement:grammar:2');
    expect(parsePlacementTag(tag)).toEqual({ skill: 'grammar', index: 2 });
  });

  it('returns null when parsing a non-placement tag', () => {
    expect(parsePlacementTag('daily life')).toBeNull();
  });

  it('plans 12 slots (4 skills x 3 items) in order', () => {
    const slots = plannedSlots();
    expect(slots).toHaveLength(12);
    expect(slots[0]).toEqual({ skill: 'reading', index: 0 });
    expect(slots[11]).toEqual({ skill: 'grammar', index: 2 });
  });
});
