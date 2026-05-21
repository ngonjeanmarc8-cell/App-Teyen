import { NextResponse } from 'next/server';
import { requireUser, UnauthorizedError } from '@/lib/auth';
import { selectNextPractice } from '@/lib/engine/session';
import { getGenerator } from '@/lib/exercises/generator';

export async function POST() {
  try {
    const user = await requireUser();
    const item = await selectNextPractice(user.id, getGenerator());
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
