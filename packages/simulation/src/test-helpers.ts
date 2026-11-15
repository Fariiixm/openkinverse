/** Shared helpers for simulation tests. Not exported from the package. */
import {
  createInitialState,
  type CharacterState,
  type Personality,
  type WorldState,
} from './index.ts';

export const COMPANION = 'chr_test';
/** 2026-01-05T00:00:00Z, a Monday. */
export const START = Date.UTC(2026, 0, 5);

export const BALANCED: Personality = {
  openness: 0.5,
  energy: 0.5,
  sociability: 0.5,
  curiosity: 0.5,
  tidiness: 0.5,
};

export function world(
  seed: number,
  overrides: Partial<{ timezone: string; startTimeMs: number; personality: Personality }> = {},
): WorldState {
  return createInitialState({
    companionId: COMPANION,
    personality: overrides.personality ?? BALANCED,
    timezone: overrides.timezone ?? 'UTC',
    startTimeMs: overrides.startTimeMs ?? START,
    seed,
  });
}

export function must<T>(value: T | undefined | null, label = 'value'): T {
  if (value === undefined || value === null) throw new Error(`expected ${label} to be defined`);
  return value;
}

export function companion(state: WorldState): CharacterState {
  return must(state.characters[0], 'companion');
}

export function withCompanion(state: WorldState, patch: Partial<CharacterState>): WorldState {
  return { ...state, characters: [{ ...companion(state), ...patch }] };
}

export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
