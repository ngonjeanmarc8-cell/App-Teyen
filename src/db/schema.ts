import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// --- ENUMs ---
export const skillKind = pgEnum('skill_kind', ['reading', 'writing', 'vocab', 'grammar']);

export const exerciseType = pgEnum('exercise_type', [
  'mcq',
  'fill_blank',
  'translate_fr_en',
  'translate_en_fr',
  'short_writing',
  'reading_comprehension',
  'vocab_recall',
]);

export const knowledgeKind = pgEnum('knowledge_kind', ['vocab', 'grammar_rule']);

export const turnRole = pgEnum('turn_role', ['user', 'assistant', 'tool', 'system_summary']);

// --- TABLES ---

// `users` mirrors a row from Supabase auth.users (linked by id).
// The FK to auth.users is added manually in a SQL migration (Task 13).
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  targetCefr: text('target_cefr').notNull().default('C2'),
  uiLang: text('ui_lang').notNull().default('fr'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const profiles = pgTable('profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  domains: text('domains').array().notNull().default(sql`'{}'::text[]`),
  interests: text('interests').array().notNull().default(sql`'{}'::text[]`),
  goalText: text('goal_text').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const skillLevels = pgTable(
  'skill_levels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    skill: skillKind('skill').notNull(),
    cefrEstimate: numeric('cefr_estimate', { precision: 4, scale: 2 }).notNull(),
    confidence: numeric('confidence', { precision: 3, scale: 2 }).notNull().default('0.30'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userSkillUq: unique('skill_levels_user_skill_uq').on(t.userId, t.skill),
  }),
);

export const exercises = pgTable(
  'exercises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: exerciseType('type').notNull(),
    skill: skillKind('skill').notNull(),
    cefr: numeric('cefr', { precision: 4, scale: 2 }).notNull(),
    topic: text('topic').notNull(),
    domain: text('domain').notNull(),
    payload: jsonb('payload').notNull(),
    answerKey: jsonb('answer_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index('exercises_user_created_idx').on(t.userId, t.createdAt),
  }),
);

export const attempts = pgTable(
  'attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    response: text('response').notNull(),
    score: numeric('score', { precision: 3, scale: 2 }).notNull(),
    feedback: text('feedback').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index('attempts_user_created_idx').on(t.userId, t.createdAt),
  }),
);

export const knowledgeItems = pgTable(
  'knowledge_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: knowledgeKind('kind').notNull(),
    value: text('value').notNull(),
    mastery: integer('mastery').notNull().default(0),
    nextReviewAt: timestamp('next_review_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    masteryRange: check('mastery_range', sql`${t.mastery} BETWEEN 0 AND 5`),
    userReviewIdx: index('knowledge_user_review_idx').on(t.userId, t.nextReviewAt),
  }),
);

export const conversationTurns = pgTable(
  'conversation_turns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').notNull(),
    role: turnRole('role').notNull(),
    content: text('content').notNull(),
    toolName: text('tool_name'),
    toolPayload: jsonb('tool_payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionCreatedIdx: index('conv_user_session_created_idx').on(
      t.userId,
      t.sessionId,
      t.createdAt,
    ),
  }),
);
