import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_CATCH_UP_MS,
  MS_PER_DAY,
  MS_PER_HOUR,
  NEED_KEYS,
  advance,
  applyInput,
  applyIntent,
  summarizeEvents,
} from './index.ts';
import { COMPANION, START, companion, must, withCompanion, world } from './test-helpers.ts';

describe('summarizeEvents', () => {
  it('summarizes an empty span', () => {
    expect(summarizeEvents([])).toEqual({
      schemaVersion: 1,
      fromMs: null,
      toMs: null,
      skippedMs: 0,
      eventCount: 0,
      intents: { accepted: 0, rejected: 0 },
      rejectedInteractions: 0,
      companions: [],
    });
  });

  it('is deterministic and consistent with the final state', () => {
    const before = world(7);
    const until = START + 2 * MS_PER_DAY;
    const { state, events } = advance(before, until);
    const summary = summarizeEvents(events, { before, untilTimeMs: until });
    expect(summarizeEvents(events, { before, untilTimeMs: until })).toEqual(summary);
    expect(summary.fromMs).toBe(START);
    expect(summary.toMs).toBe(until);
    expect(summary.eventCount).toBe(events.length);

    const c = must(summary.companions[0]);
    expect(c.companionId).toBe(COMPANION);
    expect(c.needsAtStart).toEqual(companion(before).needs);
    expect(c.needsAtEnd).toEqual(companion(state).needs);
    expect(c.taskAtEnd).toEqual(companion(state).task);
    const completed = events.filter((e) => e.type === 'activity_completed').length;
    expect(c.activities.reduce((sum, a) => sum + a.completed, 0)).toBe(completed);
    expect(c.activities.find((a) => a.activityId === 'sleep')?.performedMs).toBeGreaterThan(0);
    expect(c.distanceWalkedM).toBeGreaterThan(0);
    for (const key of NEED_KEYS) {
      expect(must(c.lowestNeeds)[key]).toBeLessThanOrEqual(must(c.needsAtEnd)[key]);
    }
    expect(JSON.parse(JSON.stringify(summary))).toEqual(summary);
  });

  it('caps highlights and reports truncation', () => {
    const before = world(3);
    const { events } = advance(before, START + 3 * MS_PER_DAY);
    const c = must(summarizeEvents(events, { before, maxHighlights: 5 }).companions[0]);
    expect(c.highlights).toHaveLength(5);
    expect(c.highlightsTruncated).toBe(true);
    const times = c.highlights.map((h) => h.simTime);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    const lastCompleted = must(events.filter((e) => e.type === 'activity_completed').at(-1));
    expect(must(c.highlights.at(-1)).simTime).toBeGreaterThanOrEqual(lastCompleted.simTime);
  });

  it('reports skipped catch-up time, interactions and intents', () => {
    const before = withCompanion(world(1), {
      needs: { energy: 50, satiety: 50, social: 30, fun: 50 },
    });
    const talk = applyInput(before, { kind: 'talk', atMs: START + 10 * MS_PER_DAY });
    const repeat = applyInput(talk.state, { kind: 'talk', atMs: START + 10 * MS_PER_DAY });
    const intent = applyIntent(
      repeat.state,
      { kind: 'start_activity', characterId: COMPANION, activityId: 'fly' },
      START + 10 * MS_PER_DAY,
    );
    const events = [...talk.events, ...repeat.events, ...intent.events];
    const summary = summarizeEvents(events, { before });
    expect(summary.skippedMs).toBe(10 * MS_PER_DAY - DEFAULT_MAX_CATCH_UP_MS);
    expect(summary.rejectedInteractions).toBe(1);
    expect(summary.intents).toEqual({ accepted: 0, rejected: 1 });
    const c = must(summary.companions[0]);
    expect(c.interactions).toEqual({ talk: 1, play: 0, feed: 0, rest: 0 });
    expect(c.highlights.some((h) => h.type === 'interaction_applied' && h.subject === 'talk')).toBe(
      true,
    );
  });

  it('counts critical need episodes', () => {
    const before = withCompanion(world(1, { startTimeMs: START + 9 * MS_PER_HOUR }), {
      needs: { energy: 90, satiety: 5, social: 90, fun: 90 },
    });
    const { events } = advance(before, before.simTimeMs + MS_PER_HOUR);
    const c = must(summarizeEvents(events, { before }).companions[0]);
    expect(c.criticalNeedEpisodes).toBe(1);
    expect(c.highlights[0]).toMatchObject({ type: 'critical_need_started', subject: 'eat' });
  });
});
