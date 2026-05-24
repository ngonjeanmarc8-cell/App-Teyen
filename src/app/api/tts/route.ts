import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getTts } from '@/lib/audio/tts';
import { requireUser, UnauthorizedError } from '@/lib/auth';

const bodySchema = z.object({ text: z.string().min(1).max(1000) });

export async function POST(request: Request) {
  try {
    await requireUser();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const { audio, contentType } = await getTts()(parsed.data.text);
    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: { 'content-type': contentType, 'cache-control': 'no-store' },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw err;
  }
}
