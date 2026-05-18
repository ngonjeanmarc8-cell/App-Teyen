import { describe, expect, it } from 'vitest';
import { UnauthorizedError } from './auth';

describe('UnauthorizedError', () => {
  it('is identifiable by name', () => {
    const err = new UnauthorizedError();
    expect(err.name).toBe('UnauthorizedError');
    expect(err instanceof Error).toBe(true);
  });
});
