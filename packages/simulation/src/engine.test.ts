import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_CATCH_UP_MS,
  EventApplicationError,
  MS_PER_DAY,
  MS_PER_HOUR,
  NEED_KEYS,
  NEED_MAX,
  NEED_MIN,
  WorldConfigError,
  advance,
  applyEvent,
  createInitialState,
  createRng,
  isInsideRoom,
  nextFloat,
  nextInt,
  replay,
  step,
  type SimulationEvent,
  type WorldState,
} from './index.ts';
import {
  BALANCED,
  START,
  companion,
  deepFreeze,
  must,
  withCompanion,
  world,
} from './test-helpers.ts';

describe('prng', () => {
  it('is deterministic for a seed and serializable', () => {
    const a = nextFloat(createRng(42));
    const b = nextFloat(JSON.parse(JSON.stringify(createRng(42))) as ReturnType<typeof createRng>);
    expect(a).toEqual(b);
    expect(a.value).toBeGreaterThanOrEqual(0);
    expect(a.value).toBeLessThan(1);
  });

  it('produces integers within range', () => {
    let rng = createRng(7);
    for (let i = 0; i < 1000; i += 1) {
      const draw = nextInt(rng, 5);
      expect(Number.isInteger(draw.value)).toBe(true);
      expect(draw.value).toBeGreaterThanOrEqual(0);
      expect(draw.value).toBeLessThan(5);
      rng = draw.rng;
    }
  });

  it('rejects invalid seeds and ranges', () => {
    expect(() => createRng(Number.NaN)).toThrow(RangeError);
    expect(() => createRng(1.5)).toThrow(RangeError);
    expect(() => nextInt(createRng(1), 0)).toThrow(RangeError);
  });
});

describe('determinism', () => {
  it('produces identical events and state for the same seed', () => {
    const a = advance(world(1234), START + 3 * MS_PER_DAY);
    const b = advance(world(1234), START + 3 * MS_PER_DAY);
    expect(a.events.length).toBeGreaterThan(0);
    expect(a.events).toEqual(b.events);
    expect(a.state).toEqual(b.state);
  });

  it('diverges for different seeds', () => {
    const a = advance(world(1), START + 2 * MS_PER_DAY);
    const b = advance(world(2), START + 2 * MS_PER_DAY);
    expect(a.events).not.toEqual(b.events);
  });

  it('does not mutate its input state', () => {
    const initial = deepFreeze(world(99));
    const snapshot = JSON.parse(JSON.stringify(initial)) as WorldState;
    expect(() => advance(initial, START + MS_PER_DAY)).not.toThrow();
    expect(initial).toEqual(snapshot);
  });

  it('survives a JSON round trip of state and events', () => {
    const half = advance(world(5), START + MS_PER_DAY);
    const restored = JSON.parse(JSON.stringify(half.state)) as WorldState;
    expect(advance(restored, START + 2 * MS_PER_DAY)).toEqual(
      advance(half.state, START + 2 * MS_PER_DAY),
    );
  });

  it('is segmentation invariant over random splits (property test)', () => {
    let rng = createRng(2026);
    for (let trial = 0; trial < 12; trial += 1) {
      const seed = trial * 7919;
      const end = START + 2 * MS_PER_DAY + 12_345;
      const whole = advance(world(seed), end);
      let state = world(seed);
      const events: SimulationEvent[] = [];
      let t = START;
      while (t < end) {
        const draw = nextInt(rng, 3 * MS_PER_HOUR);
        rng = draw.rng;
        t = Math.min(end, t + draw.value);
        const part = advance(state, t);
        state = part.state;
        events.push(...part.events);
      }
      expect(state).toEqual(whole.state);
      expect(events).toEqual(whole.events);
    }
  }, 30_000);
});

describe('event log', () => {
  it('replay reproduces the final state of advance exactly', () => {
    for (const seed of [0, 1, 42, 0xffffffff]) {
      const initial = world(seed);
      const until = START + 4 * MS_PER_DAY + 30_000;
      const result = advance(initial, until);
      expect(replay(initial, result.events, { untilTimeMs: until })).toEqual(result.state);
      const serialized = JSON.parse(JSON.stringify(result.events)) as SimulationEvent[];
      expect(replay(initial, serialized, { untilTimeMs: until })).toEqual(result.state);
    }
  });

  it('has contiguous seq, schema version and non-decreasing, tick-aligned simTime', () => {
    const initial = world(8);
    const { events, state } = advance(initial, START + 2 * MS_PER_DAY);
    events.forEach((event, index) => {
      expect(event.seq).toBe(index);
      expect(event.schemaVersion).toBe(1);
      expect((event.simTime - initial.tickOriginMs) % initial.tickMs).toBe(0);
      if (index > 0) expect(event.simTime).toBeGreaterThanOrEqual(must(events[index - 1]).simTime);
    });
    expect(state.nextSeq).toBe(events.length);
  });

  it('rejects out-of-order events', () => {
    const initial = world(3);
    const { events } = step(initial);
    expect(events.length).toBeGreaterThan(1);
    expect(() => applyEvent(initial, must(events[1]))).toThrow(EventApplicationError);
  });

  it('emits no events for no-op ticks', () => {
    const base = world(1, { startTimeMs: START + 9 * MS_PER_HOUR });
    const frozen = withCompanion(base, {
      needs: { energy: 100, satiety: 100, social: 100, fun: 100 },
      decayPerHour: { energy: 0, satiety: 0, social: 0, fun: 0 },
    });
    const result = advance(frozen, frozen.simTimeMs + MS_PER_HOUR);
    expect(result.events).toEqual([]);
    expect(result.state.simTimeMs).toBe(frozen.simTimeMs + MS_PER_HOUR);
  });
});

describe('catch-up', () => {
  it('caps the simulated window and records the skip', () => {
    const initial = world(21);
    const until = START + 30 * MS_PER_DAY + 30_000;
    const { state, events } = advance(initial, until);
    const skips = events.flatMap((e) => (e.type === 'catch_up_skipped' ? [e] : []));
    expect(skips).toHaveLength(1);
    const skip = must(skips[0]);
    expect(skip.payload.fromMs).toBe(START);
    expect(skip.payload.maxCatchUpMs).toBe(DEFAULT_MAX_CATCH_UP_MS);
    expect(state.simTimeMs - skip.payload.toMs).toBe(DEFAULT_MAX_CATCH_UP_MS);
    expect(state.simTimeMs).toBe(START + 30 * MS_PER_DAY);
    expect(replay(initial, events, { untilTimeMs: until })).toEqual(state);
  });

  it('honors a custom cap and emits no skip within the window', () => {
    const initial = world(21);
    const within = advance(initial, START + MS_PER_HOUR, { maxCatchUpMs: MS_PER_HOUR });
    expect(within.events.some((e) => e.type === 'catch_up_skipped')).toBe(false);
    const beyond = advance(initial, START + 3 * MS_PER_HOUR, { maxCatchUpMs: MS_PER_HOUR });
    expect(beyond.events.filter((e) => e.type === 'catch_up_skipped')).toHaveLength(1);
    expect(beyond.state.simTimeMs).toBe(START + 3 * MS_PER_HOUR);
  });

  it('never simulates a partial tick or moves backwards', () => {
    const initial = world(1);
    expect(advance(initial, START + 59_999)).toEqual({ state: initial, events: [] });
    expect(advance(initial, START - MS_PER_DAY)).toEqual({ state: initial, events: [] });
    expect(() => advance(initial, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('invariants over many ticks', () => {
  it('keeps needs in bounds, positions in the room and tasks valid', () => {
    const violations: string[] = [];
    for (const seed of [1, 2, 3, 4]) {
      let state = world(seed);
      for (let i = 0; i < 2500; i += 1) {
        state = step(state).state;
        const c = companion(state);
        for (const key of NEED_KEYS) {
          if (c.needs[key] < NEED_MIN || c.needs[key] > NEED_MAX) violations.push(`need ${key}`);
        }
        if (!isInsideRoom(state.room, c.position)) violations.push('position');
        const task = c.task;
        if (task !== null) {
          const spot = state.room.spots.find((s) => s.id === task.spotId);
          if (spot === undefined) violations.push('spot');
          else if (task.type === 'activity' && !spot.activityIds.includes(task.activityId)) {
            violations.push('activity spot');
          }
        }
      }
    }
    expect(violations).toEqual([]);
  }, 30_000);

  it('clamps needs at zero when nothing can restore them', () => {
    const base = world(1);
    const state: WorldState = {
      ...withCompanion(base, {
        needs: { energy: 1, satiety: 1, social: 1, fun: 1 },
        decayPerHour: { energy: 50, satiety: 50, social: 50, fun: 50 },
      }),
      activities: [],
      room: { ...base.room, spots: [] },
    };
    const end = advance(state, START + 2 * MS_PER_HOUR).state;
    expect(companion(end).needs).toEqual({ energy: 0, satiety: 0, social: 0, fun: 0 });
  });

  it('restores needs while performing and moves at bounded speed', () => {
    const initial = world(1);
    const { events } = advance(initial, START + MS_PER_DAY);
    const start = companion(initial);
    const maxStep = (start.speedMps * initial.tickMs) / 1000;
    let previous = start.position;
    let lastNeeds = start.needs;
    let sawRestore = false;
    for (const event of events) {
      if (event.type === 'character_moved') {
        const dx = event.payload.position.x - previous.x;
        const dz = event.payload.position.z - previous.z;
        expect(Math.sqrt(dx * dx + dz * dz)).toBeLessThanOrEqual(maxStep + 1e-9);
        previous = event.payload.position;
      }
      if (event.type === 'needs_changed') {
        const now = event.payload.needs;
        if (NEED_KEYS.some((k) => now[k] > lastNeeds[k])) sawRestore = true;
        lastNeeds = now;
      }
    }
    expect(sawRestore).toBe(true);
    expect(events.some((e) => e.type === 'activity_completed')).toBe(true);
  });
});

describe('selection', () => {
  it('follows the schedule in the world time zone', () => {
    // 22:00 UTC is 23:00 in Europe/Madrid in January (CET, UTC+1): sleep block.
    const madrid = world(1, { timezone: 'Europe/Madrid', startTimeMs: START + 22 * MS_PER_HOUR });
    const utc = world(1, { timezone: 'UTC', startTimeMs: START + 22 * MS_PER_HOUR });
    const startedTask = (state: WorldState): unknown => {
      const event = step(state).events.find((e) => e.type === 'task_started');
      return event?.type === 'task_started' ? event.payload.task : null;
    };
    expect(startedTask(madrid)).toMatchObject({ activityId: 'sleep', reason: 'schedule' });
    expect(startedTask(utc)).not.toMatchObject({ reason: 'schedule' });
  });

  it('lets a critical need override the schedule', () => {
    const state = withCompanion(world(1, { startTimeMs: START + 23 * MS_PER_HOUR }), {
      needs: { energy: 90, satiety: 5, social: 90, fun: 90 },
    });
    const event = step(state).events.find((e) => e.type === 'task_started');
    expect(event?.type === 'task_started' ? event.payload.task : null).toMatchObject({
      activityId: 'eat',
      reason: 'critical_need',
    });
  });

  it('stays idle when all needs are satisfied and nothing is scheduled', () => {
    const state = withCompanion(world(1, { startTimeMs: START + 9 * MS_PER_HOUR }), {
      needs: { energy: 100, satiety: 100, social: 100, fun: 100 },
    });
    expect(step(state).events.some((e) => e.type === 'task_started')).toBe(false);
  });

  it('biases activity choice by personality deterministically', () => {
    const count = (personality: typeof BALANCED): Record<string, number> => {
      const counts: Record<string, number> = {};
      for (let seed = 0; seed < 300; seed += 1) {
        const base = world(seed, { personality, startTimeMs: START + 9 * MS_PER_HOUR });
        const state = withCompanion(base, {
          needs: { energy: 90, satiety: 90, social: 90, fun: 30 },
        });
        const event = step(state).events.find((e) => e.type === 'task_started');
        if (event?.type === 'task_started' && event.payload.task.type === 'activity') {
          const id = event.payload.task.activityId;
          counts[id] = (counts[id] ?? 0) + 1;
        }
      }
      return counts;
    };
    const tidy = count({ ...BALANCED, tidiness: 1, curiosity: 0 });
    const curious = count({ ...BALANCED, tidiness: 0, curiosity: 1 });
    expect(tidy['tidy_up'] ?? 0).toBeGreaterThan(curious['tidy_up'] ?? 0);
    expect(curious['read_book'] ?? 0).toBeGreaterThan(tidy['read_book'] ?? 0);
    expect(count({ ...BALANCED, tidiness: 1 })).toEqual(count({ ...BALANCED, tidiness: 1 }));
  });
});

describe('world validation', () => {
  const options = {
    companionId: 'chr_v',
    personality: BALANCED,
    timezone: 'UTC',
    startTimeMs: START,
    seed: 1,
  };

  it('rejects invalid configurations', () => {
    expect(() => createInitialState({ ...options, tickMs: 0 })).toThrow(WorldConfigError);
    expect(() => createInitialState({ ...options, timezone: 'Mars/Olympus' })).toThrow(/time zone/);
    expect(() =>
      createInitialState({ ...options, personality: { ...BALANCED, openness: 2 } }),
    ).toThrow(/trait/);
    expect(() => createInitialState({ ...options, seed: 0.5 })).toThrow(RangeError);
  });

  it('produces JSON-serializable state with a schema version', () => {
    const state = createInitialState(options);
    expect(state.schemaVersion).toBe(1);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
