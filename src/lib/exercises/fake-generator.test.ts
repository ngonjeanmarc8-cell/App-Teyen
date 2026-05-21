import { describe, expect, it } from 'vitest';
import { fakeGenerator } from './generator';

describe('fakeGenerator', () => {
  it('produces a valid mcq item for the requested skill and level', async () => {
    const item = await fakeGenerator({ skill: 'grammar', level: 3, topic: 'daily life' });
    expect(item.options).toHaveLength(4);
    expect(item.correctIndex).toBeGreaterThanOrEqual(0);
    expect(item.correctIndex).toBeLessThanOrEqual(3);
    expect(item.prompt).toContain('grammar');
  });

  it('includes a passage for the reading skill', async () => {
    const item = await fakeGenerator({ skill: 'reading', level: 4, topic: 'travel' });
    expect(item.passage).not.toBeNull();
  });

  it('is deterministic for the same spec', async () => {
    const a = await fakeGenerator({ skill: 'vocab', level: 2, topic: 'food' });
    const b = await fakeGenerator({ skill: 'vocab', level: 2, topic: 'food' });
    expect(a).toEqual(b);
  });
});
