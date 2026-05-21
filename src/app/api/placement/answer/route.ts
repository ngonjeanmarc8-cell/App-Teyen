import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, UnauthorizedError } from '@/lib/auth';
import { finalizePlacement, recordAnswer } from '@/lib/placement/session';

const bodySchema = z.object({
  exerciseId: z.uuid(),
  selectedIndex: z.number().int().min(0).max(3),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const result = await recordAnswer(user.id, parsed.data.exerciseId, parsed.data.selectedIndex);
    if (result.complete) {
      await finalizePlacement(user.id);
    }
    return NextResponse.json({ correct: result.correct, complete: result.complete });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw err;
  }
}
