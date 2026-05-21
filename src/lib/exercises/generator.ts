import { zodResponseFormat } from 'openai/helpers/zod';
import { levelToLabel } from '@/lib/cefr';
import { GENERATION_MODEL, openai } from '@/lib/openai';
import type { GenerationSpec, McqItem } from './types';
import { mcqItemSchema } from './types';

export type ExerciseGenerator = (spec: GenerationSpec) => Promise<McqItem>;

// Deterministic fake used by tests and when PLACEMENT_FAKE='1'.
// correctIndex is derived from the spec so it's stable but varied.
export const fakeGenerator: ExerciseGenerator = async (spec) => {
  const correctIndex = (spec.level + spec.skill.length) % 4;
  const passage =
    spec.skill === 'reading' ? `A short ${spec.topic} passage at level ${spec.level}.` : null;
  return {
    passage,
    prompt: `[fake ${spec.skill}] Question about ${spec.topic} at level ${spec.level}.`,
    options: ['option A', 'option B', 'option C', 'option D'],
    correctIndex,
    rationale: `Option ${correctIndex} is correct (fake).`,
  };
};

const SKILL_INSTRUCTIONS: Record<GenerationSpec['skill'], string> = {
  reading: 'Write a 2-4 sentence English passage, then a comprehension question with 4 options.',
  writing:
    'Write a question asking which of 4 sentences is the most natural, well-formed English. No passage.',
  vocab:
    'Write a vocabulary question (meaning, synonym, or best word to fill a blank) with 4 options. No passage.',
  grammar:
    'Write a grammar question (verb form, tense, preposition, article...) with 4 options. No passage.',
};

export const openAiGenerator: ExerciseGenerator = async (spec) => {
  const label = levelToLabel(spec.level);
  const instruction = SKILL_INSTRUCTIONS[spec.skill];
  const completion = await openai().chat.completions.parse({
    model: GENERATION_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You write English-learning multiple-choice questions for a CEFR placement test. Always produce exactly 4 options with exactly one correct answer. Keep difficulty calibrated to the requested CEFR level.',
      },
      {
        role: 'user',
        content: `Skill: ${spec.skill}. CEFR level: ${label}. Topic: ${spec.topic}. ${instruction} Set passage to null when not a reading item.`,
      },
    ],
    response_format: zodResponseFormat(mcqItemSchema, 'mcq_item'),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error('OpenAI returned no parsed mcq item');
  }
  return parsed;
};

export function getGenerator(): ExerciseGenerator {
  return process.env.PLACEMENT_FAKE === '1' ? fakeGenerator : openAiGenerator;
}
