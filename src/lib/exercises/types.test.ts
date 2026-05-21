import { describe, expect, it } from 'vitest';
import { mcqItemSchema } from './types';

describe('mcqItemSchema', () => {
  it('accepts a well-formed mcq item', () => {
    const parsed = mcqItemSchema.parse({
      passage: null,
      prompt: 'Choose the correct form: She ___ to school every day.',
      options: ['go', 'goes', 'going', 'gone'],
      correctIndex: 1,
      rationale: 'Third person singular present takes -s.',
    });
    expect(parsed.correctIndex).toBe(1);
    expect(parsed.options).toHaveLength(4);
  });

  it('rejects when options length is not 4', () => {
    expect(() =>
      mcqItemSchema.parse({
        passage: null,
        prompt: 'x',
        options: ['a', 'b', 'c'],
        correctIndex: 0,
        rationale: 'r',
      }),
    ).toThrow();
  });

  it('rejects a correctIndex out of range', () => {
    expect(() =>
      mcqItemSchema.parse({
        passage: null,
        prompt: 'x',
        options: ['a', 'b', 'c', 'd'],
        correctIndex: 4,
        rationale: 'r',
      }),
    ).toThrow();
  });
});
