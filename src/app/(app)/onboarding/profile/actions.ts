'use server';

import { eq } from 'drizzle-orm';
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

  await db
    .update(profiles)
    .set({
      domains: parsed.data.domains,
      interests: parsed.data.interests,
      goalText: parsed.data.goalText,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, user.id));

  redirect('/home');
}
