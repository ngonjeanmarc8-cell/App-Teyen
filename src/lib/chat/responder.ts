import type OpenAI from 'openai';
import { CHAT_MODEL, openai } from '@/lib/openai';
import { CHAT_TOOLS } from './tools';

// Internal, SDK-agnostic message shape used by the agent loop.
export type AgentMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | {
      role: 'assistant';
      content: string;
      toolCalls?: { id: string; name: string; arguments: string }[];
    }
  | { role: 'tool'; toolCallId: string; content: string };

export type ResponderResult = {
  content: string | null;
  toolCalls: { id: string; name: string; arguments: string }[];
};

export type ChatResponder = (messages: AgentMessage[]) => Promise<ResponderResult>;

// --- Fake responder (CHAT_FAKE=1): deterministic, no OpenAI call ---
export const fakeResponder: ChatResponder = async (messages) => {
  const hasToolResult = messages.some((m) => m.role === 'tool');
  if (!hasToolResult) {
    return {
      content: null,
      toolCalls: [{ id: 'fake-1', name: 'get_next_recommendation', arguments: '{}' }],
    };
  }
  const toolMsg = messages.find((m) => m.role === 'tool');
  const reco = toolMsg && toolMsg.role === 'tool' ? toolMsg.content : '{}';
  let skill = 'your weakest skill';
  try {
    const parsed = JSON.parse(reco) as { skill?: string };
    if (parsed.skill) skill = parsed.skill;
  } catch {
    // keep default
  }
  return {
    content: `Let's work on ${skill} next. What would you like to talk about?`,
    toolCalls: [],
  };
};

// --- Real OpenAI responder ---
function toOpenAiMessages(messages: AgentMessage[]): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (m.role === 'assistant') {
      return {
        role: 'assistant',
        content: m.content,
        ...(m.toolCalls && m.toolCalls.length > 0
          ? {
              tool_calls: m.toolCalls.map((tc) => ({
                id: tc.id,
                type: 'function' as const,
                function: { name: tc.name, arguments: tc.arguments },
              })),
            }
          : {}),
      };
    }
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
    }
    return { role: m.role, content: m.content };
  });
}

export const openAiResponder: ChatResponder = async (messages) => {
  const completion = await openai().chat.completions.create({
    model: CHAT_MODEL,
    messages: toOpenAiMessages(messages),
    tools: CHAT_TOOLS,
  });
  const choice = completion.choices[0]?.message;
  const toolCalls = (choice?.tool_calls ?? [])
    .filter((tc): tc is OpenAI.ChatCompletionMessageFunctionToolCall => tc.type === 'function')
    .map((tc) => ({ id: tc.id, name: tc.function.name, arguments: tc.function.arguments }));
  return { content: choice?.content ?? null, toolCalls };
};

export function getResponder(): ChatResponder {
  return process.env.CHAT_FAKE === '1' ? fakeResponder : openAiResponder;
}
