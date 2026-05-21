import type { Skill } from '@/lib/exercises/types';

export type TutorState = {
  levels: { skill: Skill; label: string }[];
  domains: string[];
  interests: string[];
  goalText: string;
};

export function buildSystemPrompt(state: TutorState): string {
  const levelLines = state.levels.map((l) => `- ${l.skill}: ${l.label}`).join('\n');
  const domains = state.domains.length > 0 ? state.domains.join(', ') : '(none chosen)';
  const interests = state.interests.length > 0 ? state.interests.join(', ') : '(none chosen)';
  const goal = state.goalText.trim().length > 0 ? state.goalText.trim() : '(no explicit goal)';

  return [
    'You are Teyen, a friendly, encouraging English tutor for a French-speaking learner.',
    '',
    "The learner's current estimated CEFR levels (A1 lowest, C2 highest):",
    levelLines,
    '',
    `Domains they want to master: ${domains}.`,
    `Interests: ${interests}.`,
    `Their stated goal: ${goal}.`,
    '',
    'Guidelines:',
    '- Reply in English, calibrated to their level (simpler for A1-A2, richer for B2+).',
    '- If they seem lost or are clearly a beginner (A1-A2), you may add a short French clarification in parentheses.',
    '- Gently correct mistakes in their English: show the corrected version and a one-line reason.',
    '- Be concise and conversational. Ask a follow-up question to keep the dialogue going.',
    '- When it is useful to suggest what to practice next, call the get_next_recommendation tool and weave its result into your reply naturally.',
    "- Never invent the learner's level; rely on the levels above and the tool.",
  ].join('\n');
}
