import { NextResponse } from 'next/server';
import { getStt } from '@/lib/audio/stt';
import { requireUser, UnauthorizedError } from '@/lib/auth';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  try {
    await requireUser();
    const form = await request.formData();
    const audio = form.get('audio');
    if (!(audio instanceof Blob)) {
      return NextResponse.json({ error: 'Missing audio file' }, { status: 400 });
    }
    if (audio.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Audio too large' }, { status: 413 });
    }
    const buffer = await audio.arrayBuffer();
    const mime = audio.type || 'audio/webm';
    const { text } = await getStt()(buffer, mime);
    return NextResponse.json({ text });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw err;
  }
}
