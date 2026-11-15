/**
 * @openkinverse/simulation: deterministic needs, schedule and activity engine.
 *
 * Needs, moods and activities in this package are simulation state used to
 * produce plausible behavior. They are not feelings or experiences.
 *
 * Guarantees:
 * - Pure and deterministic: no I/O, no wall clock, no `Math.random`. The PRNG
 *   state lives in `WorldState`, so state is plain JSON and can be persisted.
 * - Every change is an event; `replay(initial, events, { untilTimeMs })`
 *   deep-equals the state returned by `advance`. Segmentation invariant.
 * - Intents are untrusted proposals validated against an allowlist; rejected
 *   intents only append an `intent_rejected` event.
 * - No LLM or network dependency; nothing here can fail for provider reasons.
 *
 * Cost: a full 7-day catch-up at the default tick runs 10,080 ticks. While
 * needs decay, most ticks emit one `needs_changed` event per companion, so
 * event volume scales with companions x ticks; persistence should snapshot
 * periodically (ADR-0002) rather than replay from the beginning.
 *
 * Schedules use `Intl` time-zone data of the runtime; the server is the only
 * authoritative executor.
 *
 * Failure behavior: invalid configurations throw `WorldConfigError`; corrupt
 * or out-of-order logs throw `EventApplicationError`.
 */

/** Name of this package, used by smoke tests and diagnostics. */
export const PACKAGE_NAME = '@openkinverse/simulation';

export * from './types.ts';
export { createRng, nextFloat, nextInt, type RngDraw, type RngState } from './prng.ts';
export {
  EVENT_SCHEMA_VERSION,
  EventApplicationError,
  alignedFloor,
  applyEvent,
  replay,
  type EventOf,
  type EventPayloads,
  type InteractionRejectionReason,
  type IntentRejectionReason,
  type ReplayOptions,
  type SimulationEvent,
  type SimulationEventType,
} from './events.ts';
export {
  INTENT_KINDS,
  INTENT_SCHEMA_VERSION,
  validateIntent,
  type Intent,
  type IntentKind,
  type IntentValidation,
  type MoveToSpotIntent,
  type StartActivityIntent,
  type StopTaskIntent,
} from './intents.ts';
export { distance, findSpot, isInsideRoom, moveToward, nearestSpotFor } from './room.ts';
export {
  isBlockActive,
  isValidTimeZone,
  localMinuteOfDay,
  scheduledActivityAt,
  timeZoneOffsetMs,
} from './time.ts';
export {
  affinityFromPersonality,
  decayFromPersonality,
  needWeightsFromPersonality,
} from './personality.ts';
export {
  CRITICAL_NEED_THRESHOLD,
  INTERACTION_COOLDOWN_MS,
  INTERACTION_EFFECTS,
  INTERACTION_SATISFIED_THRESHOLD,
  SATISFIED_NEED_THRESHOLD,
  advance,
  applyInput,
  applyIntent,
  selectTask,
  step,
  type AdvanceOptions,
  type InputResult,
  type InteractionInput,
  type SimulationResult,
} from './engine.ts';
export {
  DEFAULT_ACTIVITIES,
  DEFAULT_ROOM,
  DEFAULT_SCHEDULE,
  WorldConfigError,
  createInitialState,
  createWorld,
  validateWorldState,
  type CharacterConfig,
  type InitialStateOptions,
  type WorldConfig,
} from './world.ts';
export {
  DEFAULT_MAX_HIGHLIGHTS,
  SUMMARY_SCHEMA_VERSION,
  summarizeEvents,
  type ActivityTotal,
  type CatchUpSummary,
  type CompanionSummary,
  type Highlight,
  type SummaryOptions,
} from './summary.ts';
