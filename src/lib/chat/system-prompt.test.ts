import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from './system-prompt';

describe('buildSystemPrompt', () => {
  const state = {
    levels: [
      { skill: 'reading' as const, label: 'B1' },
      { skill: 'writing' as const, label: 'A2' },
      { skill: 'vocab' as const, label: 'B1' },
      { skill: 'grammar' as const, label: 'B2' },
    ],
    domains: ['business', 'tech'],
    interests: ['films'],
    goalText: 'pass the TOEFL',
  };

  it('includes the per-skill CEFR levels', () => {
    const p = buildSystemPrompt(state);
    expect(p).toContain('reading: B1');
    expect(p).toContain('writing: A2');
  });

  it('includes the profile domains, interests and goal', () => {
    const p = buildSystemPrompt(state);
    expect(p).toContain('business');
    expect(p).toContain('films');
    expect(p).toContain('pass the TOEFL');
  });

  it('instructs the tutor to reply in English calibrated to the level', () => {
    const p = buildSystemPrompt(state);
    expect(p.toLowerCase()).toContain('english');
  });

  it('handles an empty goal gracefully', () => {
    const p = buildSystemPrompt({ ...state, goalText: '' });
    expect(typeof p).toBe('string');
    expect(p.length).toBeGreaterThan(0);
  });
});
