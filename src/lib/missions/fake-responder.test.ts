import { describe, expect, it } from 'vitest';
import { fakeMissionResponder } from './responder';

describe('fakeMissionResponder', () => {
  it('does not mark the objective met for a normal message', async () => {
    const res = await fakeMissionResponder('system', [{ role: 'user', content: 'Hello there' }]);
    expect(res.objectiveMet).toBe(false);
    expect(res.reply.length).toBeGreaterThan(0);
  });

  it('marks the objective met when the user message contains "success"', async () => {
    const res = await fakeMissionResponder('system', [
      { role: 'user', content: 'I think this is a success' },
    ]);
    expect(res.objectiveMet).toBe(true);
  });
});
