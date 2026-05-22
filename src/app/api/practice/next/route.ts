import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, UnauthorizedError } from '@/lib/auth';
import { selectNextPractice } from '@/lib/engine/session';
import { getGenerator } from '@/lib/exercises/generator';
import { SKILLS } from '@/lib/exercises/types';

const bodySchema = z.object({
  skill: z.enum(SKILLS).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const raw = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const item = await selectNextPractice(user.id, getGenerator(), parsed.data.skill);
    return NextResponse.json({
      exerciseId: item.exerciseId,
      passage: item.passage,
      prompt: item.prompt,
      options: item.options,
      skill: item.skill,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw err;
  }
}
