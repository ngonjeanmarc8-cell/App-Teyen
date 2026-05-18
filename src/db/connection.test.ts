import { describe, expect, it } from 'vitest';
import { db } from './index';
import {
  attempts,
  conversationTurns,
  exercises,
  knowledgeItems,
  profiles,
  skillLevels,
  users,
} from './schema';

describe('database connection', () => {
  it('can query users table', async () => {
    const rows = await db.select().from(users).limit(1);
    expect(Array.isArray(rows)).toBe(true);
  });

  it('can query all 7 tables without error', async () => {
    await db.select().from(users).limit(1);
    await db.select().from(profiles).limit(1);
    await db.select().from(skillLevels).limit(1);
    await db.select().from(exercises).limit(1);
    await db.select().from(attempts).limit(1);
    await db.select().from(knowledgeItems).limit(1);
    await db.select().from(conversationTurns).limit(1);
    expect(true).toBe(true);
  });
});
