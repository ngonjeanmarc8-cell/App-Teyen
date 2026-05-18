import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireUser, UnauthorizedError } from '@/lib/auth';

export async function GET() {
  try {
    const authed = await requireUser();
    const rows = await db.select().from(users).where(eq(users.id, authed.id)).limit(1);
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: 'User row missing' }, { status: 500 });
    }
    return NextResponse.json({ id: row.id, email: row.email, targetCefr: row.targetCefr });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw err;
  }
}
