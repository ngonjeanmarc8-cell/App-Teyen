import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { hasPlacement } from '@/lib/placement/session';

export type OnboardingState = { hasPlacement: boolean; profileComplete: boolean };
export type OnboardingStep = 'placement' | 'profile' | 'home';

export function onboardingStep(state: OnboardingState): OnboardingStep {
  if (!state.hasPlacement) return 'placement';
  if (!state.profileComplete) return 'profile';
  return 'home';
}

export async function loadOnboardingState(userId: string): Promise<OnboardingState> {
  const placed = await hasPlacement(userId);
  const rows = await db
    .select({ domains: profiles.domains, goalText: profiles.goalText })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  const row = rows[0];
  const profileComplete = !!row && row.domains.length > 0;
  return { hasPlacement: placed, profileComplete };
}

const STEP_PATH: Record<OnboardingStep, string> = {
  placement: '/onboarding/placement',
  profile: '/onboarding/profile',
  home: '/home',
};

// Call at the top of a page server component. If the user's real step differs
// from `expected`, redirect them to where they belong. Throws (redirect) on mismatch.
export async function requireOnboardingStep(
  userId: string,
  expected: OnboardingStep,
): Promise<void> {
  const step = onboardingStep(await loadOnboardingState(userId));
  if (step !== expected) {
    redirect(STEP_PATH[step]);
  }
}
