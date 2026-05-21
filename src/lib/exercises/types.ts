import { z } from 'zod';

export const SKILLS = ['reading', 'writing', 'vocab', 'grammar'] as const;
export type Skill = (typeof SKILLS)[number];

// A placement/practice multiple-choice item. Exactly 4 options, one correct.
export const mcqItemSchema = z.object({
  passage: z.string().nullable(),
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  rationale: z.string().min(1),
});

export type McqItem = z.infer<typeof mcqItemSchema>;

// What the caller asks the generator to produce.
export type GenerationSpec = {
  skill: Skill;
  level: number; // CEFR numeric 1..6
  topic: string; // neutral topic for placement (e.g. 'daily life')
};
