import { describe, expect, it } from 'vitest';
import { fakeResponder } from './responder';

describe('fakeResponder', () => {
  it('requests the recommendation tool when no tool result is present yet', async () => {
    const res = await fakeResponder([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hello' },
    ]);
    expect(res.toolCalls).toHaveLength(1);
    expect(res.toolCalls[0]?.name).toBe('get_next_recommendation');
    expect(res.content).toBeNull();
  });

  it('returns a final text once a tool result is in the messages', async () => {
    const res = await fakeResponder([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hello' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 't1', name: 'get_next_recommendation', arguments: '{}' }],
      },
      { role: 'tool', toolCallId: 't1', content: '{"skill":"writing","levelLabel":"A2"}' },
    ]);
    expect(res.toolCalls).toHaveLength(0);
    expect(res.content).toContain('writing');
  });
});
