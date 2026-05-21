import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles, skillLevels } from '@/db/schema';
import { levelToLabel } from '@/lib/cefr';
import type { Skill } from '@/lib/exercises/types';
import { loadRecentTurns, saveTurn } from './persistence';
import { type AgentMessage, getResponder } from './responder';
import { buildSystemPrompt, type TutorState } from './system-prompt';
import { resolveTool } from './tools';

const MAX_TOOL_ROUNDS = 4;

async function loadTutorState(userId: string): Promise<TutorState> {
  const levelRows = await db.select().from(skillLevels).where(eq(skillLevels.userId, userId));
  const profileRows = await db
    .select({
      domains: profiles.domains,
      interests: profiles.interests,
      goalText: profiles.goalText,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  const profile = profileRows[0];
  return {
    levels: levelRows.map((r) => ({
      skill: r.skill as Skill,
      label: levelToLabel(Number(r.cefrEstimate)),
    })),
    domains: profile?.domains ?? [],
    interests: profile?.interests ?? [],
    goalText: profile?.goalText ?? '',
  };
}

// Run one user message through the tutor; persists the user turn and the final
// assistant turn; resolves tool calls server-side in between. Returns the reply.
export async function runChatTurn(userId: string, userMessage: string): Promise<string> {
  await saveTurn(userId, 'user', userMessage);

  const state = await loadTutorState(userId);
  const history = await loadRecentTurns(userId);
  const messages: AgentMessage[] = [
    { role: 'system', content: buildSystemPrompt(state) },
    ...history.map((t) => ({ role: t.role, content: t.content }) as AgentMessage),
  ];

  const respond = getResponder();

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const result = await respond(messages);

    if (result.toolCalls.length === 0) {
      const reply = result.content ?? "Sorry, I didn't catch that. Could you rephrase?";
      await saveTurn(userId, 'assistant', reply);
      return reply;
    }

    // Append the assistant tool-call request, then each tool result.
    messages.push({ role: 'assistant', content: '', toolCalls: result.toolCalls });
    for (const call of result.toolCalls) {
      const toolResult = await resolveTool(userId, call.name);
      messages.push({ role: 'tool', toolCallId: call.id, content: JSON.stringify(toolResult) });
    }
  }

  // Tool-round budget exhausted: return a safe fallback.
  const fallback = "Let's keep it simple — what would you like to practice today?";
  await saveTurn(userId, 'assistant', fallback);
  return fallback;
}
