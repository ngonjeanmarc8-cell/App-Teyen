import type OpenAI from 'openai';
import { recommendFocus } from '@/lib/engine/session';

// OpenAI function-tool definitions exposed to the chat model.
export const CHAT_TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_next_recommendation',
      description:
        'Returns what the learner should practice next (skill, CEFR level, topic, reason), computed from their current levels and history. Call this when you want to suggest a focus.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
];

// Resolve a tool call by name. Returns a JSON-serialisable result.
export async function resolveTool(userId: string, name: string): Promise<unknown> {
  if (name === 'get_next_recommendation') {
    const reco = await recommendFocus(userId);
    return reco;
  }
  return { error: `unknown tool: ${name}` };
}
