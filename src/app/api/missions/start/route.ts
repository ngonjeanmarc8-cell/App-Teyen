import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, UnauthorizedError } from '@/lib/auth';
import { MissionError, startRun } from '@/lib/missions/runtime';

const bodySchema = z.object({ missionId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const result = await startRun(user.id, parsed.data.missionId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err instanceof MissionError && err.code === 'not_found') {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }
    throw err;
  }
}
