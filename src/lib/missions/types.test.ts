import { describe, expect, it } from 'vitest';
import { missionTurnSchema } from './types';

describe('missionTurnSchema', () => {
  it('accepts a well-formed turn with a correction', () => {
    const parsed = missionTurnSchema.parse({
      reply: 'Sure, a table for two?',
      objectiveMet: false,
      correction: "On dit 'I would like', pas 'I want'.",
    });
    expect(parsed.objectiveMet).toBe(false);
    expect(parsed.correction).not.toBeNull();
  });

  it('accepts a null correction', () => {
    const parsed = missionTurnSchema.parse({
      reply: 'Great, see you at 8pm.',
      objectiveMet: true,
      correction: null,
    });
    expect(parsed.correction).toBeNull();
    expect(parsed.objectiveMet).toBe(true);
  });

  it('rejects a missing reply', () => {
    expect(() => missionTurnSchema.parse({ objectiveMet: false, correction: null })).toThrow();
  });
});
