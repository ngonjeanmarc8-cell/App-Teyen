'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { DOMAIN_CODES } from '@/lib/profile/constants';

export type ProfileResult = { ok: false; error: string };

const schema = z.object({
  domains: z.array(z.enum(DOMAIN_CODES as [string, ...string[]])).min(1),
  interests: z.array(z.string().min(1)).max(20),
  goalText: z.string().max(500),
});

export async function saveProfileAction(
  _prev: ProfileResult | null,
  formData: FormData,
): Promise<ProfileResult> {
  const user = await requireUser();
  const domains = formData.getAll('domains').map(String);
  const interests = String(formData.get('interests') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const goalText = String(formData.get('goalText') ?? '').trim();

  const parsed = schema.safeParse({ domains, interests, goalText });
  if (!parsed.success) {
    return { ok: false, error: 'Choisis au moins un domaine.' };
  }

  // Upsert: the signup trigger normally seeds an empty profile row, but don't
  // rely on it — a missing row would otherwise leave profileComplete false and
  // bounce the user back into an onboarding redirect loop.
  await db
    .insert(profiles)
    .values({
      userId: user.id,
      domains: parsed.data.domains,
      interests: parsed.data.interests,
      goalText: parsed.data.goalText,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: {
        domains: parsed.data.domains,
        interests: parsed.data.interests,
        goalText: parsed.data.goalText,
        updatedAt: new Date(),
      },
    });

  redirect('/home');
}
