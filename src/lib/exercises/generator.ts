import type { GenerationSpec, McqItem } from './types';

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
