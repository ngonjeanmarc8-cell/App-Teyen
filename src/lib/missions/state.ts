import type { MissionStatus } from './types';

export const DEFAULT_TURN_LIMIT = 5;

export type RunState = { status: MissionStatus; turnCount: number };

export function advance(state: RunState, objectiveMet: boolean, turnLimit: number): RunState {
  const turnCount = state.turnCount + 1;
  if (objectiveMet) return { status: 'success', turnCount };
  if (turnCount >= turnLimit) return { status: 'incomplete', turnCount };
  return { status: 'in_progress', turnCount };
}

export function turnsLeft(state: RunState, turnLimit: number): number {
  return Math.max(0, turnLimit - state.turnCount);
}
