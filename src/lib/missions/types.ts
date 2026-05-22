import { z } from 'zod';
import type { CefrLabel } from '@/lib/cefr';

export type Mission = {
  id: string;
  title: string;
  scenario: string;
  objective: string;
  requiredVocab: string[];
  cefr: CefrLabel;
  turnLimit: number;
  opener: string;
};

export type MissionStatus = 'in_progress' | 'success' | 'incomplete';

export const missionTurnSchema = z.object({
  reply: z.string().min(1),
  objectiveMet: z.boolean(),
  correction: z.string().nullable(),
});

export type MissionTurn = z.infer<typeof missionTurnSchema>;
