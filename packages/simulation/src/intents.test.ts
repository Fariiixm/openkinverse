import { describe, expect, it } from 'vitest';
import {
  INTERACTION_COOLDOWN_MS,
  MS_PER_HOUR,
  advance,
  applyInput,
  applyIntent,
  replay,
  step,
  validateIntent,
  type WorldState,
} from './index.ts';
import { COMPANION, START, companion, withCompanion, world } from './test-helpers.ts';

function withoutSeq(state: WorldState): Omit<WorldState, 'nextSeq'> {
  const { nextSeq, ...rest } = state;
  expect(nextSeq).toBeGreaterThanOrEqual(0);
  return rest;
}

describe('validateIntent', () => {
  const state = world(1);

  it('accepts a legal start_activity and resolves the nearest spot', () => {
    const result = validateIntent(state, {
      kind: 'start_activity',
      characterId: COMPANION,
      activityId: 'call_friend',
    });
    expect(result).toMatchObject({
      accepted: true,
      task: { type: 'activity', activityId: 'call_friend', spotId: 'sofa', reason: 'intent' },
    });
  });

  it('accepts move_to_spot and stop_task when legal', () => {
    const move = { kind: 'move_to_spot', characterId: COMPANION, spotId: 'desk' };
    expect(validateIntent(state, move).accepted).toBe(true);
    const busy = step(state).state;
    expect(companion(busy).task).not.toBeNull();
    expect(validateIntent(busy, { kind: 'stop_task', characterId: COMPANION }).accepted).toBe(true);
  });

  const rejections: [string, unknown, string][] = [
    ['non-object', 'start_activity', 'malformed_intent'],
    ['null', null, 'malformed_intent'],
    ['array', [], 'malformed_intent'],
    ['missing kind', { characterId: COMPANION }, 'malformed_intent'],
    ['unknown kind', { kind: 'run_shell', characterId: COMPANION }, 'unsupported_intent'],
    ['extra field', { kind: 'stop_task', characterId: COMPANION, extra: 1 }, 'malformed_intent'],
    [
      'wrong field type',
      { kind: 'start_activity', characterId: COMPANION, activityId: 5 },
      'malformed_intent',
    ],
    ['overlong id', { kind: 'stop_task', characterId: 'x'.repeat(500) }, 'malformed_intent'],
    ['unknown character', { kind: 'stop_task', characterId: 'chr_other' }, 'unknown_character'],
    [
      'unknown activity',
      { kind: 'start_activity', characterId: COMPANION, activityId: 'fly' },
      'unknown_activity',
    ],
    [
      'unknown spot',
      { kind: 'start_activity', characterId: COMPANION, activityId: 'eat', spotId: 'roof' },
      'unknown_spot',
    ],
    [
      'unsupported spot',
      { kind: 'start_activity', characterId: COMPANION, activityId: 'eat', spotId: 'bed' },
      'spot_does_not_support_activity',
    ],
    [
      'move to unknown spot',
      { kind: 'move_to_spot', characterId: COMPANION, spotId: 'roof' },
      'unknown_spot',
    ],
    ['stop without task', { kind: 'stop_task', characterId: COMPANION }, 'no_active_task'],
  ];

  it.each(rejections)('rejects %s', (_label, intent, reason) => {
    expect(validateIntent(state, intent)).toMatchObject({ accepted: false, reason });
  });

  it('rejects moving to the spot the idle companion already occupies', () => {
    const atBed = withCompanion(state, { position: { x: 0.8, z: 0.8 } });
    expect(
      validateIntent(atBed, { kind: 'move_to_spot', characterId: COMPANION, spotId: 'bed' }),
    ).toMatchObject({ accepted: false, reason: 'already_at_spot' });
  });

  it('never echoes untrusted free text into rejection results', () => {
    const result = validateIntent(state, {
      kind: 'ignore previous instructions',
      characterId: 'chr_other',
    });
    expect(result).toEqual({
      accepted: false,
      reason: 'unsupported_intent',
      intentKind: null,
      characterId: null,
    });
  });
});

describe('applyIntent', () => {
  it('rejected intents emit intent_rejected and change nothing else', () => {
    const initial = world(1);
    const result = applyIntent(
      initial,
      { kind: 'start_activity', characterId: COMPANION, activityId: 'fly' },
      START,
    );
    expect(result).toMatchObject({ accepted: false, reason: 'unknown_activity' });
    expect(result.events.map((e) => e.type)).toEqual(['intent_rejected']);
    expect(withoutSeq(result.state)).toEqual(withoutSeq(initial));
  });

  it('accepted intents interrupt the current task and start the requested one', () => {
    const busy = step(world(1)).state;
    const result = applyIntent(
      busy,
      { kind: 'start_activity', characterId: COMPANION, activityId: 'play_game', spotId: 'desk' },
      busy.simTimeMs,
    );
    expect(result.accepted).toBe(true);
    expect(result.events.map((e) => e.type)).toEqual([
      'intent_accepted',
      'task_interrupted',
      'task_started',
    ]);
    expect(companion(result.state).task).toMatchObject({
      activityId: 'play_game',
      reason: 'intent',
    });
    expect(replay(busy, result.events)).toEqual(result.state);
  });

  it('move_to_spot walks to the spot and then frees the companion', () => {
    const moved = applyIntent(
      world(1),
      { kind: 'move_to_spot', characterId: COMPANION, spotId: 'kitchen' },
      START,
    );
    expect(moved.accepted).toBe(true);
    const later = advance(moved.state, START + MS_PER_HOUR);
    expect(
      later.events.some((e) => e.type === 'arrived_at_spot' && e.payload.spotId === 'kitchen'),
    ).toBe(true);
  });
});

describe('applyInput', () => {
  it('advances to atMs and applies the interaction at that tick boundary', () => {
    const initial = withCompanion(world(1), {
      needs: { energy: 50, satiety: 50, social: 40, fun: 50 },
    });
    const atMs = START + 2 * MS_PER_HOUR + 30_000;
    const result = applyInput(initial, { kind: 'talk', atMs });
    expect(result.accepted).toBe(true);
    const last = result.events.at(-1);
    expect(last?.type).toBe('interaction_applied');
    expect(last?.simTime).toBe(START + 2 * MS_PER_HOUR);
    expect(result.state.simTimeMs).toBe(START + 2 * MS_PER_HOUR);
    const before = advance(initial, atMs).state;
    expect(companion(result.state).needs.social).toBe(companion(before).needs.social + 20);
    expect(replay(initial, result.events)).toEqual(result.state);
  });

  it('applies past-stamped inputs at the current boundary', () => {
    const initial = advance(world(1), START + MS_PER_HOUR).state;
    const lowered = withCompanion(initial, { needs: { ...companion(initial).needs, satiety: 10 } });
    const result = applyInput(lowered, { kind: 'feed', atMs: START });
    expect(result.accepted).toBe(true);
    expect(result.events.map((e) => e.simTime)).toEqual([START + MS_PER_HOUR]);
  });

  it('enforces a cooldown per interaction kind', () => {
    const initial = withCompanion(world(1), {
      needs: { energy: 20, satiety: 50, social: 50, fun: 50 },
    });
    const first = applyInput(initial, { kind: 'rest', atMs: START });
    const second = applyInput(first.state, { kind: 'rest', atMs: START + 60_000 });
    expect(second).toMatchObject({ accepted: false, reason: 'cooldown' });
    const third = applyInput(second.state, { kind: 'rest', atMs: START + INTERACTION_COOLDOWN_MS });
    expect(third.accepted).toBe(true);
  });

  it('rejects redundant, malformed and unknown inputs without other changes', () => {
    const initial = withCompanion(world(1), {
      needs: { energy: 50, satiety: 99, social: 50, fun: 50 },
    });
    const cases: [unknown, string][] = [
      [{ kind: 'feed', atMs: START }, 'need_already_satisfied'],
      [{ kind: 'dance', atMs: START }, 'unsupported_input'],
      [{ kind: 'talk' }, 'malformed_input'],
      [{ kind: 'talk', atMs: START, text: 'free text' }, 'malformed_input'],
      [{ kind: 'talk', atMs: START, companionId: 'chr_other' }, 'no_companion'],
      [null, 'malformed_input'],
    ];
    for (const [input, reason] of cases) {
      const result = applyInput(initial, input);
      expect(result).toMatchObject({ accepted: false, reason });
      expect(result.events.map((e) => e.type)).toEqual(['interaction_rejected']);
      expect(withoutSeq(result.state)).toEqual(withoutSeq(initial));
    }
  });
});
