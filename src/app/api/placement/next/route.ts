import { NextResponse } from 'next/server';
import { requireUser, UnauthorizedError } from '@/lib/auth';
import { getGenerator } from '@/lib/exercises/generator';
import { createNextItem } from '@/lib/placement/session';

export async function POST() {
  try {
    const user = await requireUser();
    const item = await createNextItem(user.id, getGenerator());
    if (!item) {
      return NextResponse.json({ done: true });
    }
    return NextResponse.json({
      done: false,
      exerciseId: item.exerciseId,
      passage: item.passage,
      prompt: item.prompt,
      options: item.options,
      slotIndex: item.slotIndex,
      total: 12,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw err;
  }
}
