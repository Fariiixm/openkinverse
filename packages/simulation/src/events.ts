/**
 * Typed, versioned simulation events and the pure `applyEvent` reducer.
 *
 * Every state change produced by the engine is expressed as an event. Events
 * carry absolute resulting values (positions, need values, PRNG state)
 * rather than instructions to recompute them, so replaying a log does not
 * depend on engine heuristics and reproduces the original state exactly.
 *
 * Time: an event's `simTime` is the tick boundary at which its change holds;
 * applying it moves `simTimeMs` forward to that boundary. Ticks without any
 * state change emit no events (ADR-0002), so `replay` accepts the target time
 * to fast-forward over trailing no-op ticks.
 */
import type { RngState } from './prng.ts';
import type {
  CharacterState,
  InteractionKind,
  NeedRecord,
  Task,
  Vec2,
  WorldState,
} from './types.ts';

/** Version of the event envelope and payload layouts. */
export const EVENT_SCHEMA_VERSION = 1;

/** Reasons a structured intent can be rejected by the validator. */
export type IntentRejectionReason =
  | 'malformed_intent'
  | 'unsupported_intent'
  | 'unknown_character'
  | 'unknown_activity'
  | 'unknown_spot'
  | 'spot_does_not_support_activity'
  | 'no_spot_for_activity'
  | 'already_performing_activity'
  | 'already_at_spot'
  | 'no_active_task';

/** Reasons a direct interaction can be rejected. */
export type InteractionRejectionReason =
  'malformed_input' | 'unsupported_input' | 'no_companion' | 'cooldown' | 'need_already_satisfied';

export interface EventPayloads {
  /** Catch-up exceeded the maximum window; the skipped span was not simulated. */
  catch_up_skipped: {
    readonly fromMs: number;
    readonly toMs: number;
    readonly skippedMs: number;
    readonly maxCatchUpMs: number;
  };
  /** A companion began a task. `rng` is the PRNG state after selection, if a draw occurred. */
  task_started: {
    readonly characterId: string;
    readonly task: Task;
    readonly rng: RngState | null;
  };
  /** A companion moved to a new room-relative position. */
  character_moved: { readonly characterId: string; readonly position: Vec2 };
  /** A companion reached the spot of its task. */
  arrived_at_spot: {
    readonly characterId: string;
    readonly spotId: string;
    readonly endsAtMs: number | null;
  };
  /** Need values after decay and restoration for one tick. */
  needs_changed: { readonly characterId: string; readonly needs: NeedRecord };
  /** A companion finished performing an activity. */
  activity_completed: {
    readonly characterId: string;
    readonly activityId: string;
    readonly spotId: string;
  };
  /** A companion's task was stopped before completion. */
  task_interrupted: { readonly characterId: string; readonly cause: 'intent' };
  /** A structured intent passed validation. */
  intent_accepted: { readonly intentKind: string; readonly characterId: string };
  /** A structured intent failed validation. State is otherwise unchanged. */
  intent_rejected: {
    readonly intentKind: string | null;
    readonly characterId: string | null;
    readonly reason: IntentRejectionReason;
  };
  /** A direct user interaction changed need values. */
  interaction_applied: {
    readonly characterId: string;
    readonly kind: InteractionKind;
    readonly needs: NeedRecord;
  };
  /** A direct user interaction was rejected. State is otherwise unchanged. */
  interaction_rejected: {
    readonly kind: InteractionKind | null;
    readonly reason: InteractionRejectionReason;
  };
}

export type SimulationEventType = keyof EventPayloads;

/** Event envelope. `seq` is monotonic per world; `simTime` is UTC epoch milliseconds. */
export type SimulationEvent = {
  [K in SimulationEventType]: {
    readonly schemaVersion: typeof EVENT_SCHEMA_VERSION;
    readonly seq: number;
    readonly simTime: number;
    readonly type: K;
    readonly payload: EventPayloads[K];
  };
}[SimulationEventType];

export type EventOf<K extends SimulationEventType> = Extract<SimulationEvent, { type: K }>;

/** Thrown when an event cannot be applied to a state (corrupt or out-of-order log). */
export class EventApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventApplicationError';
  }
}

/** Builds an event envelope stamped with the state's next sequence number. */
export function makeEvent<K extends SimulationEventType>(
  state: WorldState,
  type: K,
  simTime: number,
  payload: EventPayloads[K],
): EventOf<K> {
  return {
    schemaVersion: EVENT_SCHEMA_VERSION,
    seq: state.nextSeq,
    simTime,
    type,
    payload,
  } as EventOf<K>;
}

function updateCharacter(
  state: WorldState,
  characterId: string,
  update: (character: CharacterState) => CharacterState,
): readonly CharacterState[] {
  const index = state.characters.findIndex((character) => character.id === characterId);
  const target = state.characters[index];
  if (target === undefined) throw new EventApplicationError(`unknown character ${characterId}`);
  const characters = [...state.characters];
  characters[index] = update(target);
  return characters;
}

function isAligned(state: WorldState, simTime: number): boolean {
  return Number.isSafeInteger(simTime) && (simTime - state.tickOriginMs) % state.tickMs === 0;
}

/**
 * Applies one event to a state and returns the new state. Pure: the input is
 * never mutated. Throws `EventApplicationError` if the event does not follow
 * the state (wrong sequence number or schema version, time going backwards or
 * off the tick grid, unknown character).
 */
export function applyEvent(state: WorldState, event: SimulationEvent): WorldState {
  const version: number = event.schemaVersion;
  if (version !== EVENT_SCHEMA_VERSION) {
    throw new EventApplicationError(`unsupported event schemaVersion ${String(version)}`);
  }
  if (event.seq !== state.nextSeq) {
    throw new EventApplicationError(
      `expected event seq ${String(state.nextSeq)}, received ${String(event.seq)}`,
    );
  }
  if (event.simTime < state.simTimeMs || !isAligned(state, event.simTime)) {
    throw new EventApplicationError(
      `event simTime ${String(event.simTime)} is before ${String(state.simTimeMs)} or off the tick grid`,
    );
  }
  const base: WorldState = { ...state, nextSeq: state.nextSeq + 1, simTimeMs: event.simTime };

  switch (event.type) {
    case 'catch_up_skipped':
      if (event.payload.fromMs !== state.simTimeMs || event.payload.toMs !== event.simTime) {
        throw new EventApplicationError('catch_up_skipped does not match the state time');
      }
      return base;
    case 'task_started': {
      const { characterId, task, rng } = event.payload;
      return {
        ...base,
        rng: rng ?? base.rng,
        characters: updateCharacter(base, characterId, (c) => ({ ...c, task })),
      };
    }
    case 'character_moved': {
      const { characterId, position } = event.payload;
      return {
        ...base,
        characters: updateCharacter(base, characterId, (c) => ({ ...c, position })),
      };
    }
    case 'arrived_at_spot': {
      const { characterId, endsAtMs } = event.payload;
      return {
        ...base,
        characters: updateCharacter(base, characterId, (c) => {
          if (c.task === null) {
            throw new EventApplicationError(`character ${characterId} has no task`);
          }
          if (c.task.type === 'move') return { ...c, task: null };
          return { ...c, task: { ...c.task, phase: 'performing', endsAtMs } };
        }),
      };
    }
    case 'needs_changed': {
      const { characterId, needs } = event.payload;
      return {
        ...base,
        characters: updateCharacter(base, characterId, (c) => ({ ...c, needs })),
      };
    }
    case 'activity_completed':
    case 'task_interrupted': {
      const { characterId } = event.payload;
      return {
        ...base,
        characters: updateCharacter(base, characterId, (c) => ({ ...c, task: null })),
      };
    }
    case 'interaction_applied': {
      const { characterId, kind, needs } = event.payload;
      return {
        ...base,
        characters: updateCharacter(base, characterId, (c) => ({
          ...c,
          needs,
          lastInteractionMs: { ...c.lastInteractionMs, [kind]: event.simTime },
        })),
      };
    }
    case 'intent_accepted':
    case 'intent_rejected':
    case 'interaction_rejected':
      return base;
  }
}

/** Largest tick boundary of `state` that is at or before `timeMs`. */
export function alignedFloor(state: WorldState, timeMs: number): number {
  const ticks = Math.floor((timeMs - state.tickOriginMs) / state.tickMs);
  return state.tickOriginMs + ticks * state.tickMs;
}

export interface ReplayOptions {
  /**
   * The `untilTimeMs` passed to `advance` when the events were produced.
   * Trailing no-op ticks emit no events; this fast-forwards `simTimeMs` to
   * the same tick boundary that `advance` reached.
   */
  readonly untilTimeMs?: number;
}

/** Applies a sequence of events to an initial state. */
export function replay(
  initial: WorldState,
  events: readonly SimulationEvent[],
  options: ReplayOptions = {},
): WorldState {
  let state = initial;
  for (const event of events) state = applyEvent(state, event);
  if (options.untilTimeMs !== undefined) {
    const target = alignedFloor(state, options.untilTimeMs);
    if (target > state.simTimeMs) state = { ...state, simTimeMs: target };
  }
  return state;
}
