import { zodResponseFormat } from 'openai/helpers/zod';
import { MISSION_MODEL, openai } from '@/lib/openai';
import { type MissionTurn, missionTurnSchema } from './types';

export type MissionMessage = { role: 'user' | 'assistant'; content: string };

export type MissionResponder = (
  systemPrompt: string,
  history: MissionMessage[],
) => Promise<MissionTurn>;

// Deterministic fake (MISSION_FAKE=1): objective met when the last user message says "success".
export const fakeMissionResponder: MissionResponder = async (_systemPrompt, history) => {
  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  const objectiveMet = (lastUser?.content ?? '').toLowerCase().includes('success');
  return {
    reply: objectiveMet ? 'Perfect, all done!' : 'Okay, go on — tell me more.',
    objectiveMet,
    correction: null,
  };
};

export const openAiMissionResponder: MissionResponder = async (systemPrompt, history) => {
  const completion = await openai().chat.completions.parse({
    model: MISSION_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content }) as const),
    ],
    response_format: zodResponseFormat(missionTurnSchema, 'mission_turn'),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error('OpenAI returned no parsed mission turn');
  }
  return parsed;
};

export function getMissionResponder(): MissionResponder {
  return process.env.MISSION_FAKE === '1' ? fakeMissionResponder : openAiMissionResponder;
}
