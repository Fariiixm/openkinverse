/**
 * Deterministic tick engine.
 *
 * `step`, `advance`, `applyInput` and `applyIntent` are pure functions: no
 * I/O, no wall clock, no `Math.random`, no transcendental `Math` functions.
 * Every state change is emitted as an event and folded with `applyEvent`, so
 * `replay(initial, events, { untilTimeMs })` reproduces the result exactly.
 *
 * Segmentation invariance (ADR-0002): only whole ticks aligned to
 * `tickOriginMs` are simulated and the partial-tick remainder is never
 * simulated, so `advance(s, t2)` equals `advance(advance(s, t1).state, t2)`
 * for every `t1 <= t2` whose gaps stay within the catch-up window.
 */
import {
  alignedFloor,
  applyEvent,
  makeEvent,
  type EventPayloads,
  type InteractionRejectionReason,
  type IntentRejectionReason,
  type SimulationEvent,
  type SimulationEventType,
} from './events.ts';
import { validateIntent } from './intents.ts';
import { nextFloat, type RngState } from './prng.ts';
import { findSpot, moveToward, nearestSpotFor } from './room.ts';
import { scheduledActivityAt } from './time.ts';
import {
  DEFAULT_MAX_CATCH_UP_MS,
  INTERACTION_KINDS,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  NEED_KEYS,
  NEED_MAX,
  NEED_MIN,
  type ActivityDefinition,
  type CharacterState,
  type InteractionKind,
  type NeedKey,
  type NeedRecord,
  type Task,
  type TaskReason,
  type WorldState,
} from './types.ts';

/** Below this value a need overrides the schedule. */
export const CRITICAL_NEED_THRESHOLD = 20;
/** At or above this value for every need, an unscheduled companion stays idle. */
export const SATISFIED_NEED_THRESHOLD = 70;
/** Minimum simulated time between two accepted interactions of the same kind. */
export const INTERACTION_COOLDOWN_MS = 10 * MS_PER_MINUTE;

export interface SimulationResult {
  readonly state: WorldState;
  readonly events: readonly SimulationEvent[];
}

export interface AdvanceOptions {
  /** Maximum simulated span to catch up; older time is skipped. Default 7 days. */
  readonly maxCatchUpMs?: number;
}

/** Accumulates events while folding them into the state. */
class EventSink {
  state: WorldState;
  readonly events: SimulationEvent[] = [];

  constructor(state: WorldState) {
    this.state = state;
  }

  emit<K extends SimulationEventType>(type: K, simTime: number, payload: EventPayloads[K]): void {
    const event = makeEvent(this.state, type, simTime, payload);
    this.state = applyEvent(this.state, event);
    this.events.push(event);
  }

  character(characterId: string): CharacterState {
    const character = this.state.characters.find((c) => c.id === characterId);
    if (character === undefined) throw new Error(`unknown character ${characterId}`);
    return character;
  }

  result(): SimulationResult {
    return { state: this.state, events: this.events };
  }
}

interface Selection {
  readonly task: Task;
  readonly rng: RngState | null;
}

function activityTask(activityId: string, spotId: string, reason: TaskReason): Task {
  return { type: 'activity', activityId, spotId, reason, phase: 'moving', endsAtMs: null };
}

/** Needs with the highest weighted urgency `(NEED_MAX - value) * weight`. */
function mostUrgentNeeds(character: CharacterState): NeedKey[] {
  let best = Number.NEGATIVE_INFINITY;
  let keys: NeedKey[] = [];
  for (const key of NEED_KEYS) {
    const urgency = (NEED_MAX - character.needs[key]) * character.needWeights[key];
    if (urgency > best) {
      best = urgency;
      keys = [key];
    } else if (urgency === best) {
      keys.push(key);
    }
  }
  return keys;
}

function minNeed(needs: NeedRecord): number {
  let value = NEED_MAX;
  for (const key of NEED_KEYS) value = Math.min(value, needs[key]);
  return value;
}

/**
 * Chooses the next task for an idle companion.
 * Order: critical need, then schedule, then most urgent need, else idle.
 * Need-based choices draw from the seeded PRNG, weighted by personality
 * affinity, among the activities that restore the most urgent need.
 */
export function selectTask(state: WorldState, character: CharacterState): Selection | null {
  const needBased = (reason: TaskReason): Selection | null => {
    const urgent = mostUrgentNeeds(character);
    const candidates: { activity: ActivityDefinition; weight: number }[] = [];
    for (const activity of state.activities) {
      const restores = urgent.some((key) => (activity.restoresPerHour[key] ?? 0) > 0);
      if (!restores) continue;
      if (nearestSpotFor(state.room, activity.id, character.position) === undefined) continue;
      candidates.push({ activity, weight: character.activityAffinity[activity.id] ?? 1 });
    }
    const first = candidates[0];
    if (first === undefined) return null;
    let chosen = first.activity;
    let rng: RngState | null = null;
    if (candidates.length > 1) {
      const total = candidates.reduce((sum, c) => sum + c.weight, 0);
      const draw = nextFloat(state.rng);
      rng = draw.rng;
      let threshold = draw.value * total;
      for (const candidate of candidates) {
        chosen = candidate.activity;
        threshold -= candidate.weight;
        if (threshold < 0) break;
      }
    }
    const spot = nearestSpotFor(state.room, chosen.id, character.position);
    if (spot === undefined) return null;
    return { task: activityTask(chosen.id, spot.id, reason), rng };
  };

  const lowest = minNeed(character.needs);
  if (lowest < CRITICAL_NEED_THRESHOLD) {
    const selection = needBased('critical_need');
    if (selection !== null) return selection;
  }
  const scheduled = scheduledActivityAt(character.schedule, state.simTimeMs, state.timezone);
  if (scheduled !== null) {
    const spot = nearestSpotFor(state.room, scheduled, character.position);
    if (spot !== undefined) {
      return { task: activityTask(scheduled, spot.id, 'schedule'), rng: null };
    }
  }
  if (lowest < SATISFIED_NEED_THRESHOLD) return needBased('need');
  return null;
}

/** Clamps to the need bounds and rounds to 6 decimals to keep the log free of float drift. */
function clampNeed(value: number): number {
  return Math.round(Math.min(NEED_MAX, Math.max(NEED_MIN, value)) * 1e6) / 1e6;
}

function needsAfterTick(
  character: CharacterState,
  elapsedMs: number,
  activity: ActivityDefinition | undefined,
  performMs: number,
): NeedRecord {
  const next = { ...character.needs };
  for (const key of NEED_KEYS) {
    const decay = (character.decayPerHour[key] * elapsedMs) / MS_PER_HOUR;
    const rate = activity?.restoresPerHour[key] ?? 0;
    next[key] = clampNeed(character.needs[key] - decay + (rate * performMs) / MS_PER_HOUR);
  }
  return next;
}

function needsEqual(a: NeedRecord, b: NeedRecord): boolean {
  return NEED_KEYS.every((key) => a[key] === b[key]);
}

/** Advances the world by exactly one tick. Ticks without changes emit no events. */
export function step(state: WorldState): SimulationResult {
  const sink = new EventSink(state);
  const characterIds = state.characters.map((c) => c.id);
  const fromMs = state.simTimeMs;
  const toMs = fromMs + state.tickMs;

  for (const id of characterIds) {
    const character = sink.character(id);
    if (character.task !== null) continue;
    const selection = selectTask(sink.state, character);
    if (selection !== null) {
      sink.emit('task_started', fromMs, {
        characterId: id,
        task: selection.task,
        rng: selection.rng,
      });
    }
  }

  for (const id of characterIds) {
    const atStart = sink.character(id);
    const task = atStart.task;
    const performing = task?.type === 'activity' && task.phase === 'performing' ? task : null;
    const activity =
      performing === null
        ? undefined
        : sink.state.activities.find((a) => a.id === performing.activityId);

    if (task !== null && performing === null) {
      const spot = findSpot(sink.state.room, task.spotId);
      if (spot === undefined) throw new Error(`unknown spot ${task.spotId}`);
      const maxDistance = (atStart.speedMps * sink.state.tickMs) / 1000;
      const move = moveToward(atStart.position, spot.position, maxDistance);
      if (move.position.x !== atStart.position.x || move.position.z !== atStart.position.z) {
        sink.emit('character_moved', toMs, { characterId: id, position: move.position });
      }
      if (move.arrived) {
        let endsAtMs: number | null = null;
        if (task.type === 'activity') {
          const definition = sink.state.activities.find((a) => a.id === task.activityId);
          if (definition === undefined) throw new Error(`unknown activity ${task.activityId}`);
          endsAtMs = toMs + definition.durationMs;
        }
        sink.emit('arrived_at_spot', toMs, { characterId: id, spotId: spot.id, endsAtMs });
      }
    }

    const endsAtMs = performing?.endsAtMs ?? null;
    const performMs = endsAtMs === null ? 0 : Math.max(0, Math.min(toMs, endsAtMs) - fromMs);
    const current = sink.character(id);
    const needs = needsAfterTick(current, toMs - fromMs, activity, performMs);
    if (!needsEqual(needs, current.needs)) {
      sink.emit('needs_changed', toMs, { characterId: id, needs });
    }

    if (performing !== null && endsAtMs !== null && endsAtMs <= toMs) {
      sink.emit('activity_completed', toMs, {
        characterId: id,
        activityId: performing.activityId,
        spotId: performing.spotId,
      });
    }
  }

  return { state: { ...sink.state, simTimeMs: toMs }, events: sink.events };
}

/**
 * Advances the world in whole ticks up to `untilTimeMs` (lazy catch-up).
 *
 * If more than `maxCatchUpMs` would be simulated, the oldest part is skipped
 * in whole ticks and recorded by one `catch_up_skipped` event; needs and
 * tasks are frozen across the skipped span. A trailing partial tick is not
 * simulated: `simTimeMs` stays at the last tick boundary at or before
 * `untilTimeMs`. Targets in the past are a no-op (time never moves back).
 */
export function advance(
  state: WorldState,
  untilTimeMs: number,
  options: AdvanceOptions = {},
): SimulationResult {
  const maxCatchUpMs = options.maxCatchUpMs ?? DEFAULT_MAX_CATCH_UP_MS;
  if (!Number.isFinite(untilTimeMs)) throw new RangeError('untilTimeMs must be finite');
  if (!Number.isFinite(maxCatchUpMs) || maxCatchUpMs < 0) {
    throw new RangeError('maxCatchUpMs must be a finite, non-negative number');
  }

  const target = alignedFloor(state, untilTimeMs);
  const events: SimulationEvent[] = [];
  let current = state;

  const gap = target - current.simTimeMs;
  if (gap > maxCatchUpMs) {
    const skippedMs = Math.ceil((gap - maxCatchUpMs) / current.tickMs) * current.tickMs;
    const sink = new EventSink(current);
    const fromMs = current.simTimeMs;
    sink.emit('catch_up_skipped', fromMs + skippedMs, {
      fromMs,
      toMs: fromMs + skippedMs,
      skippedMs,
      maxCatchUpMs,
    });
    current = sink.state;
    events.push(...sink.events);
  }

  while (current.simTimeMs < target) {
    const result = step(current);
    current = result.state;
    for (const event of result.events) events.push(event);
  }

  return { state: current, events };
}

/** Result of applying a direct interaction or a structured intent. */
export interface InputResult extends SimulationResult {
  readonly accepted: boolean;
  readonly reason?: InteractionRejectionReason | IntentRejectionReason;
}

/** A direct user interaction stamped with the time it happened (UTC epoch ms). */
export interface InteractionInput {
  readonly kind: InteractionKind;
  readonly atMs: number;
  /** Defaults to the first companion in the world. */
  readonly companionId?: string;
}

interface InteractionEffect {
  readonly primary: NeedKey;
  readonly deltas: Readonly<Partial<Record<NeedKey, number>>>;
}

/** Deterministic need changes per interaction kind. */
export const INTERACTION_EFFECTS: Readonly<Record<InteractionKind, InteractionEffect>> = {
  talk: { primary: 'social', deltas: { social: 20, fun: 5 } },
  play: { primary: 'fun', deltas: { fun: 20, energy: -5 } },
  feed: { primary: 'satiety', deltas: { satiety: 30 } },
  rest: { primary: 'energy', deltas: { energy: 15 } },
};

/** Primary need at or above this value makes an interaction redundant. */
export const INTERACTION_SATISFIED_THRESHOLD = 95;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteractionKind(value: unknown): value is InteractionKind {
  return typeof value === 'string' && (INTERACTION_KINDS as readonly string[]).includes(value);
}

function readAtMs(input: unknown): number | null {
  if (!isRecord(input)) return null;
  const atMs = input['atMs'];
  return typeof atMs === 'number' && Number.isSafeInteger(atMs) ? atMs : null;
}

/**
 * Applies a direct user interaction (`talk`, `play`, `feed`, `rest`).
 *
 * The world is first advanced to `atMs` (same rules as `advance`); the input
 * then applies at the resulting tick boundary, after any events of that tick,
 * in call order. Inputs stamped in the past apply at the current boundary.
 * Input is untrusted: malformed or illegal inputs are rejected and only an
 * `interaction_rejected` event is appended.
 */
export function applyInput(
  state: WorldState,
  input: unknown,
  options: AdvanceOptions = {},
): InputResult {
  const atMs = readAtMs(input);
  const advanced = atMs === null ? { state, events: [] } : advance(state, atMs, options);
  const sink = new EventSink(advanced.state);
  const now = sink.state.simTimeMs;
  const finish = (accepted: boolean, reason?: InteractionRejectionReason): InputResult => ({
    accepted,
    ...(reason === undefined ? {} : { reason }),
    state: sink.state,
    events: [...advanced.events, ...sink.events],
  });
  const rejectWith = (
    reason: InteractionRejectionReason,
    kind: InteractionKind | null,
  ): InputResult => {
    sink.emit('interaction_rejected', now, { kind, reason });
    return finish(false, reason);
  };

  if (!isRecord(input) || atMs === null) return rejectWith('malformed_input', null);
  const kind = input['kind'];
  if (!isInteractionKind(kind)) {
    return rejectWith(typeof kind === 'string' ? 'unsupported_input' : 'malformed_input', null);
  }
  const allowed = new Set(['kind', 'atMs', 'companionId']);
  if (Object.keys(input).some((key) => !allowed.has(key)))
    return rejectWith('malformed_input', kind);
  const companionId = input['companionId'];
  if (companionId !== undefined && typeof companionId !== 'string') {
    return rejectWith('malformed_input', kind);
  }
  const character =
    companionId === undefined
      ? sink.state.characters[0]
      : sink.state.characters.find((c) => c.id === companionId);
  if (character === undefined) return rejectWith('no_companion', kind);

  const last = character.lastInteractionMs[kind];
  if (last !== null && now - last < INTERACTION_COOLDOWN_MS) return rejectWith('cooldown', kind);
  const effect = INTERACTION_EFFECTS[kind];
  if (character.needs[effect.primary] >= INTERACTION_SATISFIED_THRESHOLD) {
    return rejectWith('need_already_satisfied', kind);
  }

  const needs = { ...character.needs };
  for (const key of NEED_KEYS) needs[key] = clampNeed(needs[key] + (effect.deltas[key] ?? 0));
  sink.emit('interaction_applied', now, { characterId: character.id, kind, needs });
  return finish(true);
}

/**
 * Validates and applies a structured intent (for example a dialogue
 * provider's `IntentProposal`) at `atMs`, with the same time rules as
 * `applyInput`. Rejected intents only append an `intent_rejected` event.
 */
export function applyIntent(
  state: WorldState,
  intent: unknown,
  atMs: number,
  options: AdvanceOptions = {},
): InputResult {
  const advanced = advance(state, atMs, options);
  const sink = new EventSink(advanced.state);
  const now = sink.state.simTimeMs;
  const result = validateIntent(sink.state, intent);
  const events = (): SimulationEvent[] => [...advanced.events, ...sink.events];
  if (!result.accepted) {
    sink.emit('intent_rejected', now, {
      intentKind: result.intentKind,
      characterId: result.characterId,
      reason: result.reason,
    });
    return { accepted: false, reason: result.reason, state: sink.state, events: events() };
  }
  const { characterId } = result.intent;
  sink.emit('intent_accepted', now, { intentKind: result.intent.kind, characterId });
  if (result.interruptsCurrentTask) {
    sink.emit('task_interrupted', now, { characterId, cause: 'intent' });
  }
  if (result.task !== null) {
    sink.emit('task_started', now, { characterId, task: result.task, rng: null });
  }
  return { accepted: true, state: sink.state, events: events() };
}
