/**
 * World construction and structural validation.
 *
 * `createInitialState` is the stable entry point for the server: one
 * companion in a default room. `createWorld` accepts a full configuration.
 */
import {
  affinityFromPersonality,
  decayFromPersonality,
  needWeightsFromPersonality,
} from './personality.ts';
import { createRng } from './prng.ts';
import { isInsideRoom } from './room.ts';
import { isValidTimeZone } from './time.ts';
import {
  DEFAULT_TICK_MS,
  INTERACTION_KINDS,
  NEED_KEYS,
  NEED_MAX,
  NEED_MIN,
  PERSONALITY_TRAITS,
  WORLD_STATE_SCHEMA_VERSION,
  type ActivityDefinition,
  type CharacterState,
  type NeedRecord,
  type Personality,
  type Room,
  type ScheduleBlock,
  type Vec2,
  type WorldState,
} from './types.ts';

export class WorldConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorldConfigError';
  }
}

/** Configuration of a companion in a new world. Tasks always start empty. */
export interface CharacterConfig {
  readonly id: string;
  readonly personality: Personality;
  readonly needs: NeedRecord;
  /** Defaults are derived from `personality`. */
  readonly decayPerHour?: NeedRecord;
  readonly needWeights?: NeedRecord;
  readonly activityAffinity?: Readonly<Record<string, number>>;
  readonly position: Vec2;
  readonly speedMps: number;
  readonly schedule: readonly ScheduleBlock[];
}

export interface WorldConfig {
  readonly worldId: string;
  readonly seed: number;
  readonly timezone: string;
  /** UTC epoch milliseconds; also the tick origin. Default 0. */
  readonly startTimeMs?: number;
  readonly tickMs?: number;
  readonly room: Room;
  readonly activities: readonly ActivityDefinition[];
  readonly characters: readonly CharacterConfig[];
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new WorldConfigError(message);
}

function assertUnique(ids: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    assert(id.length > 0, `${label} id must not be empty`);
    assert(!seen.has(id), `duplicate ${label} id ${id}`);
    seen.add(id);
  }
}

const isFiniteNumber = (value: number): boolean => Number.isFinite(value);
const isNonNegativeInteger = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;

/** Throws `WorldConfigError` if the state is structurally invalid. */
export function validateWorldState(state: WorldState): void {
  const version: number = state.schemaVersion;
  assert(version === WORLD_STATE_SCHEMA_VERSION, 'unsupported world state schemaVersion');
  assert(state.worldId.length > 0, 'worldId must not be empty');
  assert(isValidTimeZone(state.timezone), `unknown time zone ${state.timezone}`);
  assert(
    Number.isSafeInteger(state.tickMs) && state.tickMs > 0,
    'tickMs must be a positive integer',
  );
  assert(isNonNegativeInteger(state.tickOriginMs), 'tickOriginMs must be a non-negative integer');
  assert(
    isNonNegativeInteger(state.simTimeMs) &&
      state.simTimeMs >= state.tickOriginMs &&
      (state.simTimeMs - state.tickOriginMs) % state.tickMs === 0,
    'simTimeMs must be tick-aligned and not before tickOriginMs',
  );
  assert(isNonNegativeInteger(state.nextSeq), 'nextSeq must be a non-negative integer');
  const algorithm: string = state.rng.algorithm;
  assert(
    algorithm === 'mulberry32' && state.rng.state >>> 0 === state.rng.state,
    'rng state must be a mulberry32 uint32',
  );

  const { room } = state;
  assert(isFiniteNumber(room.widthM) && room.widthM > 0, 'room widthM must be positive');
  assert(isFiniteNumber(room.depthM) && room.depthM > 0, 'room depthM must be positive');

  assertUnique(
    state.activities.map((a) => a.id),
    'activity',
  );
  const activityIds = new Set(state.activities.map((a) => a.id));
  for (const activity of state.activities) {
    assert(
      Number.isSafeInteger(activity.durationMs) && activity.durationMs > 0,
      `activity ${activity.id} durationMs must be a positive integer`,
    );
    for (const [key, rate] of Object.entries(activity.restoresPerHour)) {
      assert(
        (NEED_KEYS as readonly string[]).includes(key),
        `activity ${activity.id} restores unknown need ${key}`,
      );
      assert(
        typeof rate === 'number' && isFiniteNumber(rate) && rate >= 0,
        `activity ${activity.id} restore rate must be non-negative`,
      );
    }
  }

  assertUnique(
    room.spots.map((s) => s.id),
    'spot',
  );
  for (const spot of room.spots) {
    assert(isInsideRoom(room, spot.position), `spot ${spot.id} is outside the room`);
    for (const activityId of spot.activityIds) {
      assert(
        activityIds.has(activityId),
        `spot ${spot.id} references unknown activity ${activityId}`,
      );
    }
  }

  assertUnique(
    state.characters.map((c) => c.id),
    'character',
  );
  for (const character of state.characters) validateCharacter(state, character, activityIds);
}

function validateCharacter(
  state: WorldState,
  character: CharacterState,
  activityIds: ReadonlySet<string>,
): void {
  const label = `character ${character.id}`;
  for (const trait of PERSONALITY_TRAITS) {
    const value = character.personality[trait];
    assert(
      isFiniteNumber(value) && value >= 0 && value <= 1,
      `${label} trait ${trait} must be in [0, 1]`,
    );
  }
  for (const key of NEED_KEYS) {
    const value = character.needs[key];
    assert(
      isFiniteNumber(value) && value >= NEED_MIN && value <= NEED_MAX,
      `${label} need ${key} out of bounds`,
    );
    assert(
      isFiniteNumber(character.decayPerHour[key]) && character.decayPerHour[key] >= 0,
      `${label} decay for ${key} must be non-negative`,
    );
    assert(
      isFiniteNumber(character.needWeights[key]) && character.needWeights[key] > 0,
      `${label} need weight for ${key} must be positive`,
    );
  }
  for (const [activityId, weight] of Object.entries(character.activityAffinity)) {
    assert(
      activityIds.has(activityId),
      `${label} affinity references unknown activity ${activityId}`,
    );
    assert(
      isFiniteNumber(weight) && weight > 0,
      `${label} affinity for ${activityId} must be positive`,
    );
  }
  for (const kind of INTERACTION_KINDS) {
    const last = character.lastInteractionMs[kind];
    assert(
      last === null || isNonNegativeInteger(last),
      `${label} lastInteractionMs.${kind} invalid`,
    );
  }
  assert(isInsideRoom(state.room, character.position), `${label} is outside the room`);
  assert(
    isFiniteNumber(character.speedMps) && character.speedMps > 0,
    `${label} speedMps must be positive`,
  );
  for (const block of character.schedule) {
    for (const minute of [block.startMinute, block.endMinute]) {
      assert(
        Number.isInteger(minute) && minute >= 0 && minute < 1440,
        `${label} schedule minute out of range`,
      );
    }
    assert(block.startMinute !== block.endMinute, `${label} schedule block must not be empty`);
    assert(
      activityIds.has(block.activityId),
      `${label} schedule references unknown activity ${block.activityId}`,
    );
  }
}

/** Creates and validates the initial state of a world. */
export function createWorld(config: WorldConfig): WorldState {
  const startTimeMs = config.startTimeMs ?? 0;
  const activityIds = new Set(config.activities.map((a) => a.id));
  const state: WorldState = {
    schemaVersion: WORLD_STATE_SCHEMA_VERSION,
    worldId: config.worldId,
    timezone: config.timezone,
    tickOriginMs: startTimeMs,
    simTimeMs: startTimeMs,
    tickMs: config.tickMs ?? DEFAULT_TICK_MS,
    rng: createRng(config.seed),
    nextSeq: 0,
    room: config.room,
    activities: config.activities,
    characters: config.characters.map((c) => {
      const derivedAffinity = Object.fromEntries(
        Object.entries(affinityFromPersonality(c.personality)).filter(([id]) =>
          activityIds.has(id),
        ),
      );
      return {
        id: c.id,
        personality: c.personality,
        needs: c.needs,
        decayPerHour: c.decayPerHour ?? decayFromPersonality(c.personality),
        needWeights: c.needWeights ?? needWeightsFromPersonality(c.personality),
        activityAffinity: c.activityAffinity ?? derivedAffinity,
        position: c.position,
        speedMps: c.speedMps,
        schedule: c.schedule,
        task: null,
        lastInteractionMs: { talk: null, play: null, feed: null, rest: null },
      };
    }),
  };
  validateWorldState(state);
  return state;
}

/** Default room used by `createInitialState`. */
export const DEFAULT_ROOM: Room = {
  id: 'room_default',
  widthM: 5,
  depthM: 4,
  spots: [
    { id: 'bed', name: 'Bed', position: { x: 0.8, z: 0.8 }, activityIds: ['sleep'] },
    { id: 'kitchen', name: 'Kitchen counter', position: { x: 4.5, z: 0.5 }, activityIds: ['eat'] },
    {
      id: 'sofa',
      name: 'Sofa',
      position: { x: 2.5, z: 3.2 },
      activityIds: ['watch_tv', 'call_friend', 'read_book'],
    },
    {
      id: 'desk',
      name: 'Desk',
      position: { x: 4.2, z: 3.5 },
      activityIds: ['play_game', 'call_friend', 'read_book'],
    },
    { id: 'shelf', name: 'Shelf', position: { x: 0.5, z: 3.5 }, activityIds: ['tidy_up'] },
  ],
};

/** Default activity catalog used by `createInitialState`. */
export const DEFAULT_ACTIVITIES: readonly ActivityDefinition[] = [
  { id: 'sleep', name: 'Sleep', durationMs: 2 * 3_600_000, restoresPerHour: { energy: 30 } },
  { id: 'eat', name: 'Eat', durationMs: 30 * 60_000, restoresPerHour: { satiety: 120 } },
  {
    id: 'call_friend',
    name: 'Call a friend',
    durationMs: 30 * 60_000,
    restoresPerHour: { social: 60 },
  },
  { id: 'watch_tv', name: 'Watch TV', durationMs: 60 * 60_000, restoresPerHour: { fun: 40 } },
  { id: 'play_game', name: 'Play a game', durationMs: 45 * 60_000, restoresPerHour: { fun: 45 } },
  { id: 'read_book', name: 'Read a book', durationMs: 45 * 60_000, restoresPerHour: { fun: 35 } },
  { id: 'tidy_up', name: 'Tidy up', durationMs: 20 * 60_000, restoresPerHour: { fun: 25 } },
];

/** Default daily schedule in local time used by `createInitialState`. */
export const DEFAULT_SCHEDULE: readonly ScheduleBlock[] = [
  { startMinute: 23 * 60, endMinute: 7 * 60, activityId: 'sleep' },
  { startMinute: 12 * 60, endMinute: 12 * 60 + 30, activityId: 'eat' },
  { startMinute: 19 * 60, endMinute: 19 * 60 + 30, activityId: 'eat' },
];

export interface InitialStateOptions {
  readonly companionId: string;
  readonly personality: Personality;
  /** IANA time zone used for the schedule, e.g. `Europe/Madrid`. */
  readonly timezone: string;
  /** Default 60,000 ms. */
  readonly tickMs?: number;
  /** UTC epoch milliseconds; becomes the world's tick origin. */
  readonly startTimeMs: number;
  /** Integer seed for the world PRNG. */
  readonly seed: number;
  /** Default `wld_<companionId>`. */
  readonly worldId?: string;
}

/** Creates a world with one companion in the default room, schedule and catalog. */
export function createInitialState(options: InitialStateOptions): WorldState {
  return createWorld({
    worldId: options.worldId ?? `wld_${options.companionId}`,
    seed: options.seed,
    timezone: options.timezone,
    startTimeMs: options.startTimeMs,
    ...(options.tickMs === undefined ? {} : { tickMs: options.tickMs }),
    room: DEFAULT_ROOM,
    activities: DEFAULT_ACTIVITIES,
    characters: [
      {
        id: options.companionId,
        personality: options.personality,
        needs: { energy: 80, satiety: 60, social: 60, fun: 60 },
        position: { x: 2.5, z: 2 },
        speedMps: 0.8,
        schedule: DEFAULT_SCHEDULE,
      },
    ],
  });
}
