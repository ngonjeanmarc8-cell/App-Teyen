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

const NON_READING_RULE =
  'The question must be fully self-contained and must NOT refer to any passage, text, or article. Set the "passage" field to null.';

const SKILL_INSTRUCTIONS: Record<GenerationSpec['skill'], string> = {
  reading:
    'Put a self-contained 2-4 sentence English passage in the "passage" field (it must NOT be empty), then write a comprehension question in "prompt" with 4 options. The question must be answerable ONLY from the passage.',
  writing: `Write a question asking which of 4 sentences is the most natural, well-formed English. ${NON_READING_RULE}`,
  vocab: `Write a vocabulary question (meaning, synonym, or best word to fill a blank) with 4 options. ${NON_READING_RULE}`,
  grammar: `Write a grammar question (verb form, tense, preposition, article...) with 4 options. ${NON_READING_RULE}`,
};

function isBlank(s: string | null): boolean {
  return s === null || s.trim().length === 0;
}

async function generateOnce(spec: GenerationSpec, instruction: string): Promise<McqItem> {
  const label = levelToLabel(spec.level);
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
        content: `Skill: ${spec.skill}. CEFR level: ${label}. Topic: ${spec.topic}. ${instruction}`,
      },
    ],
    response_format: zodResponseFormat(mcqItemSchema, 'mcq_item'),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error('OpenAI returned no parsed mcq item');
  }
  return parsed;
}

export const openAiGenerator: ExerciseGenerator = async (spec) => {
  const instruction = SKILL_INSTRUCTIONS[spec.skill];
  let item = await generateOnce(spec, instruction);

  // A reading question depends on its passage; the model occasionally leaves it
  // empty. Retry once with a firmer instruction, then fail loudly rather than
  // showing a question that references an invisible text.
  if (spec.skill === 'reading' && isBlank(item.passage)) {
    item = await generateOnce(
      spec,
      `${instruction} CRITICAL: the "passage" field MUST contain the full text and must not be empty.`,
    );
    if (isBlank(item.passage)) {
      throw new Error('reading item generated without a passage');
    }
  }

  // Non-reading items never carry a passage, even if the model added one.
  if (spec.skill !== 'reading') {
    return { ...item, passage: null };
  }
  return item;
};

export function getGenerator(): ExerciseGenerator {
  return process.env.PLACEMENT_FAKE === '1' ? fakeGenerator : openAiGenerator;
}
