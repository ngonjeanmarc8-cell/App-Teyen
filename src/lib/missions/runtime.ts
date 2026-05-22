import { asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { missionRuns, missionTurns } from '@/db/schema';
import { getMission } from './catalog';
import { buildMissionPrompt } from './prompt';
import type { MissionResponder } from './responder';
import { advance, turnsLeft } from './state';
import type { MissionStatus } from './types';

export class MissionError extends Error {
  constructor(
    message: string,
    public code: 'not_found' | 'forbidden' | 'finished',
  ) {
    super(message);
    this.name = 'MissionError';
  }
}

export async function startRun(
  userId: string,
  missionId: string,
): Promise<{ runId: string; opener: string; objective: string; turnLimit: number }> {
  const mission = getMission(missionId);
  if (!mission) throw new MissionError('unknown mission', 'not_found');

  const inserted = await db
    .insert(missionRuns)
    .values({ userId, missionId, status: 'in_progress', turnCount: 0 })
    .returning({ id: missionRuns.id });
  const run = inserted[0];
  if (!run) throw new Error('failed to create mission run');

  await db
    .insert(missionTurns)
    .values({ runId: run.id, role: 'assistant', content: mission.opener });

  return {
    runId: run.id,
    opener: mission.opener,
    objective: mission.objective,
    turnLimit: mission.turnLimit,
  };
}

export async function loadRun(userId: string, runId: string) {
  const rows = await db.select().from(missionRuns).where(eq(missionRuns.id, runId)).limit(1);
  const run = rows[0];
  if (!run) throw new MissionError('run not found', 'not_found');
  if (run.userId !== userId) throw new MissionError('not your run', 'forbidden');
  const mission = getMission(run.missionId);
  if (!mission) throw new MissionError('mission missing from catalog', 'not_found');

  const turns = await db
    .select({
      role: missionTurns.role,
      content: missionTurns.content,
      correction: missionTurns.correction,
    })
    .from(missionTurns)
    .where(eq(missionTurns.runId, runId))
    .orderBy(asc(missionTurns.createdAt));

  return { run, mission, turns };
}

export async function submitTurn(
  userId: string,
  runId: string,
  message: string,
  respond: MissionResponder,
): Promise<{ reply: string; correction: string | null; status: MissionStatus; turnsLeft: number }> {
  const { run, mission, turns } = await loadRun(userId, runId);
  if (run.status !== 'in_progress') throw new MissionError('run already finished', 'finished');

  await db.insert(missionTurns).values({ runId, role: 'user', content: message });

  const history = [
    ...turns.map((t) => ({ role: t.role as 'user' | 'assistant', content: t.content })),
    { role: 'user' as const, content: message },
  ];
  const result = await respond(buildMissionPrompt(mission), history);

  const nextState = advance(
    { status: 'in_progress', turnCount: run.turnCount },
    result.objectiveMet,
    mission.turnLimit,
  );

  await db.insert(missionTurns).values({
    runId,
    role: 'assistant',
    content: result.reply,
    correction: result.correction,
  });

  await db
    .update(missionRuns)
    .set({
      status: nextState.status,
      turnCount: nextState.turnCount,
      endedAt: nextState.status === 'in_progress' ? null : new Date(),
    })
    .where(eq(missionRuns.id, runId));

  return {
    reply: result.reply,
    correction: result.correction,
    status: nextState.status,
    turnsLeft: turnsLeft(nextState, mission.turnLimit),
  };
}

// Latest run status per mission for the current user (for the list badges).
export async function statusByMission(userId: string): Promise<Record<string, MissionStatus>> {
  const rows = await db
    .select({
      missionId: missionRuns.missionId,
      status: missionRuns.status,
      startedAt: missionRuns.startedAt,
    })
    .from(missionRuns)
    .where(eq(missionRuns.userId, userId))
    .orderBy(desc(missionRuns.startedAt));
  const out: Record<string, MissionStatus> = {};
  for (const r of rows) {
    if (!(r.missionId in out)) out[r.missionId] = r.status as MissionStatus;
  }
  return out;
}
