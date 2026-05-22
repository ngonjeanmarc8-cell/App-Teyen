import { describe, expect, it } from 'vitest';
import { buildMissionPrompt } from './prompt';
import type { Mission } from './types';

const mission: Mission = {
  id: 'restaurant-order',
  title: 'Commander au restaurant',
  scenario: 'You are a waiter at a casual restaurant.',
  objective: 'The customer orders a main dish and a drink.',
  requiredVocab: ['I would like', 'the menu'],
  cefr: 'A2',
  turnLimit: 5,
  opener: 'Welcome!',
};

describe('buildMissionPrompt', () => {
  it('includes the scenario, objective, vocab and CEFR level', () => {
    const p = buildMissionPrompt(mission);
    expect(p).toContain(mission.scenario);
    expect(p).toContain(mission.objective);
    expect(p).toContain('I would like');
    expect(p).toContain('A2');
  });

  it('instructs to reply in English and keep it short', () => {
    const p = buildMissionPrompt(mission).toLowerCase();
    expect(p).toContain('english');
    expect(p).toContain('objectivemet');
  });
});
