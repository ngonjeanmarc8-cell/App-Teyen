import { describe, expect, it } from 'vitest';
import { fakeTts } from './tts';

describe('fakeTts', () => {
  it('returns a non-empty audio buffer with an audio content type', async () => {
    const res = await fakeTts('Hello there');
    expect(res.audio.length).toBeGreaterThan(0);
    expect(res.contentType).toBe('audio/mpeg');
  });
});
