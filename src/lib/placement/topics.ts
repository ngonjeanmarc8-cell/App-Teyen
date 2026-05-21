import type { Skill } from '@/lib/exercises/types';

// Neutral topics used during placement (before the user picks a domain).
const NEUTRAL_TOPICS = ['daily life', 'travel', 'work', 'food', 'technology', 'health'];

// Deterministic topic pick so a placement session is reproducible per (skill, index).
export function placementTopic(skill: Skill, index: number): string {
  const seed = skill.length + index;
  return NEUTRAL_TOPICS[seed % NEUTRAL_TOPICS.length] ?? 'daily life';
}
