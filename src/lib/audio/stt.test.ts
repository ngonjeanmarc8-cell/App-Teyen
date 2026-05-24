import { describe, expect, it } from 'vitest';
import { fakeStt } from './stt';

describe('fakeStt', () => {
  it('returns a non-empty fixed transcript', async () => {
    const res = await fakeStt(new ArrayBuffer(8), 'audio/webm');
    expect(res.text.length).toBeGreaterThan(0);
  });
});
