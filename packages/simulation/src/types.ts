/**
 * Core data types of the deterministic simulation.
 *
 * Needs, personality traits, activities and schedules are numeric simulation
 * state used to choose plausible behavior. They do not represent feelings,
 * consciousness or any inner experience of a companion.
 *
 * IDs are plain strings in this package. Integration with the typed ID
 * schemas of `@openkinverse/core` happens at the server boundary.
 */
import type { RngState } from './prng.ts';

/** Version of the serialized `WorldState` layout. */
export const WORLD_STATE_SCHEMA_VERSION = 1;

/** Simulated milliseconds per minute, hour and day. */
export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;
/** Default fixed tick length: 60 simulated seconds. */
export const DEFAULT_TICK_MS = 60_000;
/** Default maximum catch-up window: 7 simulated days. */
export const DEFAULT_MAX_CATCH_UP_MS = 7 * MS_PER_DAY;

/** Lower and upper bound of every need value. */
export const NEED_MIN = 0;
export const NEED_MAX = 100;

/**
 * Need keys. Every need uses the same orientation: 100 means fully satisfied,
 * 0 means maximally urgent. `satiety` is the inverse of hunger.
 */
export const NEED_KEYS = ['energy', 'satiety', 'social', 'fun'] as const;
export type NeedKey = (typeof NEED_KEYS)[number];

/** Per-need numeric values. */
export type NeedRecord = Readonly<Record<NeedKey, number>>;

/** Personality trait keys. Each trait is a number in [0, 1]. */
export const PERSONALITY_TRAITS = [
  'openness',
  'energy',
  'sociability',
  'curiosity',
  'tidiness',
] as const;
export type PersonalityTrait = (typeof PERSONALITY_TRAITS)[number];

/** Configured personality traits; they bias decay rates and activity choice. */
export type Personality = Readonly<Record<PersonalityTrait, number>>;

/** Direct user interaction kinds accepted by `applyInput`. */
export const INTERACTION_KINDS = ['talk', 'play', 'feed', 'rest'] as const;
export type InteractionKind = (typeof INTERACTION_KINDS)[number];

/** Room-relative position in meters on the floor plane. */
export interface Vec2 {
  readonly x: number;
  readonly z: number;
}

/** A named place in the room where specific activities can be performed. */
export interface ActivitySpot {
  readonly id: string;
  readonly name: string;
  readonly position: Vec2;
  /** IDs of activities that can be performed at this spot. */
  readonly activityIds: readonly string[];
}

/**
 * A rectangular room. Coordinates are room-relative: x in [0, widthM],
 * z in [0, depthM], measured from the room origin.
 */
export interface Room {
  readonly id: string;
  readonly widthM: number;
  readonly depthM: number;
  readonly spots: readonly ActivitySpot[];
}

/** Definition of an activity that can be selected or requested. */
export interface ActivityDefinition {
  readonly id: string;
  readonly name: string;
  /** Simulated time spent performing the activity once at its spot (whole ms). */
  readonly durationMs: number;
  /** Need restoration in points per simulated hour while performing. */
  readonly restoresPerHour: Readonly<Partial<Record<NeedKey, number>>>;
}

/**
 * A schedule block in the world's local time. `startMinute` and `endMinute`
 * are minutes after local midnight in [0, 1440). A block with
 * `endMinute < startMinute` wraps past midnight.
 */
export interface ScheduleBlock {
  readonly startMinute: number;
  readonly endMinute: number;
  readonly activityId: string;
}

/** Why a task was started. */
export type TaskReason = 'schedule' | 'need' | 'critical_need' | 'intent';

/** Performing a defined activity at a spot. */
export interface ActivityTask {
  readonly type: 'activity';
  readonly activityId: string;
  readonly spotId: string;
  readonly reason: TaskReason;
  /** `moving` until the companion reaches the spot, then `performing`. */
  readonly phase: 'moving' | 'performing';
  /** Simulated time at which performing ends; `null` while moving. */
  readonly endsAtMs: number | null;
}

/** Walking to a spot without performing anything there. */
export interface MoveTask {
  readonly type: 'move';
  readonly spotId: string;
  readonly reason: TaskReason;
}

export type Task = ActivityTask | MoveTask;

/** Simulation state of one companion. */
export interface CharacterState {
  readonly id: string;
  readonly personality: Personality;
  readonly needs: NeedRecord;
  /** Need decay in points per simulated hour (non-negative). */
  readonly decayPerHour: NeedRecord;
  /** Multiplier applied to need urgency when choosing what to do (positive). */
  readonly needWeights: NeedRecord;
  /** Relative preference per activity ID (positive); used as selection weights. */
  readonly activityAffinity: Readonly<Record<string, number>>;
  readonly position: Vec2;
  /** Maximum walking speed in meters per simulated second. */
  readonly speedMps: number;
  readonly schedule: readonly ScheduleBlock[];
  readonly task: Task | null;
  /** Simulated time of the last accepted interaction per kind, for cooldowns. */
  readonly lastInteractionMs: Readonly<Record<InteractionKind, number | null>>;
}

/** Complete, JSON-serializable, authoritative state of one simulated world. */
export interface WorldState {
  readonly schemaVersion: typeof WORLD_STATE_SCHEMA_VERSION;
  readonly worldId: string;
  /** IANA time zone used to evaluate schedules, e.g. `Europe/Madrid`. */
  readonly timezone: string;
  /** UTC epoch milliseconds; every simulated time is `tickOriginMs + k * tickMs`. */
  readonly tickOriginMs: number;
  /** Current simulated time, UTC epoch milliseconds, always tick-aligned. */
  readonly simTimeMs: number;
  readonly tickMs: number;
  readonly rng: RngState;
  /** Sequence number that the next emitted event will carry. */
  readonly nextSeq: number;
  readonly room: Room;
  readonly activities: readonly ActivityDefinition[];
  readonly characters: readonly CharacterState[];
}
