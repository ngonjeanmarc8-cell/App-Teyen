import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { conversationTurns } from '@/db/schema';

export const CHAT_HISTORY_LIMIT = 20;

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

// Load the last CHAT_HISTORY_LIMIT user/assistant turns, oldest-first.
export async function loadRecentTurns(userId: string): Promise<ChatTurn[]> {
  const rows = await db
    .select({ role: conversationTurns.role, content: conversationTurns.content })
    .from(conversationTurns)
    .where(
      and(
        eq(conversationTurns.userId, userId),
        inArray(conversationTurns.role, ['user', 'assistant']),
      ),
    )
    .orderBy(desc(conversationTurns.createdAt))
    .limit(CHAT_HISTORY_LIMIT);

  return rows.map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content })).reverse();
}

export async function saveTurn(
  userId: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<void> {
  await db.insert(conversationTurns).values({
    userId,
    sessionId: userId, // one ongoing conversation per user in the MVP
    role,
    content,
  });
}

// Full history (oldest-first) for rendering the page on load.
export async function loadFullHistory(userId: string): Promise<ChatTurn[]> {
  const rows = await db
    .select({ role: conversationTurns.role, content: conversationTurns.content })
    .from(conversationTurns)
    .where(
      and(
        eq(conversationTurns.userId, userId),
        inArray(conversationTurns.role, ['user', 'assistant']),
      ),
    )
    .orderBy(asc(conversationTurns.createdAt));

  return rows.map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }));
}
