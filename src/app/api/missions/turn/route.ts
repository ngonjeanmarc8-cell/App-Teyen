import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, UnauthorizedError } from '@/lib/auth';
import { getMissionResponder } from '@/lib/missions/responder';
import { MissionError, submitTurn } from '@/lib/missions/runtime';

const bodySchema = z.object({
  runId: z.uuid(),
  message: z.string().min(1).max(2000),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const result = await submitTurn(
      user.id,
      parsed.data.runId,
      parsed.data.message,
      getMissionResponder(),
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err instanceof MissionError) {
      const status = err.code === 'forbidden' ? 403 : err.code === 'finished' ? 409 : 404;
      return NextResponse.json({ error: err.message }, { status });
    }
    throw err;
  }
}
