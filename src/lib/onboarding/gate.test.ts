import { describe, expect, it } from 'vitest';
import { onboardingStep } from './gate';

describe('onboardingStep', () => {
  it('sends a brand-new user to placement', () => {
    expect(onboardingStep({ hasPlacement: false, profileComplete: false })).toBe('placement');
  });

  it('sends a placed-but-no-profile user to profile', () => {
    expect(onboardingStep({ hasPlacement: true, profileComplete: false })).toBe('profile');
  });

  it('sends a fully onboarded user to home', () => {
    expect(onboardingStep({ hasPlacement: true, profileComplete: true })).toBe('home');
  });

  it('keeps a user without placement at placement even if profile somehow set', () => {
    expect(onboardingStep({ hasPlacement: false, profileComplete: true })).toBe('placement');
  });
});
