/**
 * Structured catch-up summary of what happened in a span of simulation.
 *
 * `summarizeEvents` is a pure fold over events, so a returning user sees a
 * summary derived only from the authoritative event log. The summary holds
 * IDs, counts, times and need values only; it contains no free text, and a
 * client or dialogue provider can render it in any language. It describes
 * simulation state, not feelings.
 */
import type { SimulationEvent } from './events.ts';
import {
  NEED_KEYS,
  type InteractionKind,
  type NeedRecord,
  type Task,
  type WorldState,
} from './types.ts';

export const SUMMARY_SCHEMA_VERSION = 1;
/** Default maximum number of highlights listed per companion. */
export const DEFAULT_MAX_HIGHLIGHTS = 20;

export interface ActivityTotal {
  readonly activityId: string;
  /** Completed performances. */
  readonly completed: number;
  /** Simulated milliseconds spent performing completed activities. */
  readonly performedMs: number;
}

export interface Highlight {
  readonly simTime: number;
  readonly type: 'activity_completed' | 'interaction_applied' | 'critical_need_started';
  /** Activity ID, interaction kind, or the activity chosen for a critical need. */
  readonly subject: string;
}

export interface CompanionSummary {
  readonly companionId: string;
  /** Needs before the span if a `before` state was given, else at the first need update. */
  readonly needsAtStart: NeedRecord | null;
  readonly needsAtEnd: NeedRecord | null;
  /** Lowest value observed per need during the span. */
  readonly lowestNeeds: NeedRecord | null;
  /** Sorted by `completed` descending, then `activityId`. */
  readonly activities: readonly ActivityTotal[];
  readonly interactions: Readonly<Record<InteractionKind, number>>;
  readonly criticalNeedEpisodes: number;
  readonly distanceWalkedM: number;
  /** Task in progress at the end of the span, if known from the events or `before`. */
  readonly taskAtEnd: Task | null;
  /** The most recent `maxHighlights`, chronological; `highlightsTruncated` reports dropped older ones. */
  readonly highlights: readonly Highlight[];
  readonly highlightsTruncated: boolean;
}

export interface CatchUpSummary {
  readonly schemaVersion: typeof SUMMARY_SCHEMA_VERSION;
  /** Span covered, UTC epoch ms; `null` if there are no events and no `before` state. */
  readonly fromMs: number | null;
  readonly toMs: number | null;
  /** Simulated time skipped by the catch-up cap. */
  readonly skippedMs: number;
  readonly eventCount: number;
  readonly intents: { readonly accepted: number; readonly rejected: number };
  readonly rejectedInteractions: number;
  /** Sorted by `companionId`. */
  readonly companions: readonly CompanionSummary[];
}

export interface SummaryOptions {
  /** State before the first event; gives exact starting needs, tasks and span start. */
  readonly before?: WorldState;
  /** End of the span (for example the `untilTimeMs` given to `advance`). */
  readonly untilTimeMs?: number;
  readonly maxHighlights?: number;
}

interface MutableCompanion {
  needsAtStart: NeedRecord | null;
  needsAtEnd: NeedRecord | null;
  lowest: Record<string, number> | null;
  activities: Map<string, { completed: number; performedMs: number }>;
  performingSince: { activityId: string; startedAt: number } | null;
  interactions: Record<InteractionKind, number>;
  criticalNeedEpisodes: number;
  distanceWalkedM: number;
  lastPosition: { x: number; z: number } | null;
  taskAtEnd: Task | null;
  highlights: Highlight[];
  highlightsTruncated: boolean;
}

function emptyCompanion(): MutableCompanion {
  return {
    needsAtStart: null,
    needsAtEnd: null,
    lowest: null,
    activities: new Map(),
    performingSince: null,
    interactions: { talk: 0, play: 0, feed: 0, rest: 0 },
    criticalNeedEpisodes: 0,
    distanceWalkedM: 0,
    lastPosition: null,
    taskAtEnd: null,
    highlights: [],
    highlightsTruncated: false,
  };
}

function observeNeeds(c: MutableCompanion, needs: NeedRecord): void {
  c.needsAtStart ??= needs;
  c.needsAtEnd = needs;
  const lowest = c.lowest ?? { ...needs };
  for (const key of NEED_KEYS) lowest[key] = Math.min(lowest[key] ?? needs[key], needs[key]);
  c.lowest = lowest;
}

/** Summarizes a span of events. Pure and deterministic. */
export function summarizeEvents(
  events: readonly SimulationEvent[],
  options: SummaryOptions = {},
): CatchUpSummary {
  const maxHighlights = Math.max(0, Math.floor(options.maxHighlights ?? DEFAULT_MAX_HIGHLIGHTS));
  const companions = new Map<string, MutableCompanion>();
  const get = (id: string): MutableCompanion => {
    let c = companions.get(id);
    if (c === undefined) {
      c = emptyCompanion();
      companions.set(id, c);
    }
    return c;
  };
  const highlight = (c: MutableCompanion, h: Highlight): void => {
    c.highlights.push(h);
    if (c.highlights.length > maxHighlights) {
      c.highlights.shift();
      c.highlightsTruncated = true;
    }
  };

  const before = options.before;
  for (const character of before?.characters ?? []) {
    const c = get(character.id);
    observeNeeds(c, character.needs);
    c.lastPosition = character.position;
    c.taskAtEnd = character.task;
    const task = character.task;
    if (task?.type === 'activity' && task.endsAtMs !== null) {
      const duration = before?.activities.find((a) => a.id === task.activityId)?.durationMs;
      if (duration !== undefined) {
        c.performingSince = { activityId: task.activityId, startedAt: task.endsAtMs - duration };
      }
    }
  }

  let skippedMs = 0;
  let accepted = 0;
  let rejected = 0;
  let rejectedInteractions = 0;

  for (const event of events) {
    switch (event.type) {
      case 'catch_up_skipped':
        skippedMs += event.payload.skippedMs;
        break;
      case 'task_started': {
        const c = get(event.payload.characterId);
        c.taskAtEnd = event.payload.task;
        c.performingSince = null;
        if (event.payload.task.reason === 'critical_need') {
          c.criticalNeedEpisodes += 1;
          if (event.payload.task.type === 'activity') {
            highlight(c, {
              simTime: event.simTime,
              type: 'critical_need_started',
              subject: event.payload.task.activityId,
            });
          }
        }
        break;
      }
      case 'character_moved': {
        const c = get(event.payload.characterId);
        const to = event.payload.position;
        if (c.lastPosition !== null) {
          const dx = to.x - c.lastPosition.x;
          const dz = to.z - c.lastPosition.z;
          c.distanceWalkedM += Math.sqrt(dx * dx + dz * dz);
        }
        c.lastPosition = to;
        break;
      }
      case 'arrived_at_spot': {
        const c = get(event.payload.characterId);
        const task = c.taskAtEnd;
        if (task?.type === 'activity') {
          c.taskAtEnd = { ...task, phase: 'performing', endsAtMs: event.payload.endsAtMs };
          c.performingSince = { activityId: task.activityId, startedAt: event.simTime };
        } else {
          c.taskAtEnd = null;
        }
        break;
      }
      case 'needs_changed':
        observeNeeds(get(event.payload.characterId), event.payload.needs);
        break;
      case 'activity_completed': {
        const c = get(event.payload.characterId);
        const totals = c.activities.get(event.payload.activityId) ?? {
          completed: 0,
          performedMs: 0,
        };
        totals.completed += 1;
        if (c.performingSince?.activityId === event.payload.activityId) {
          totals.performedMs += event.simTime - c.performingSince.startedAt;
        }
        c.activities.set(event.payload.activityId, totals);
        c.performingSince = null;
        c.taskAtEnd = null;
        highlight(c, {
          simTime: event.simTime,
          type: 'activity_completed',
          subject: event.payload.activityId,
        });
        break;
      }
      case 'task_interrupted': {
        const c = get(event.payload.characterId);
        c.taskAtEnd = null;
        c.performingSince = null;
        break;
      }
      case 'interaction_applied': {
        const c = get(event.payload.characterId);
        c.interactions[event.payload.kind] += 1;
        observeNeeds(c, event.payload.needs);
        highlight(c, {
          simTime: event.simTime,
          type: 'interaction_applied',
          subject: event.payload.kind,
        });
        break;
      }
      case 'interaction_rejected':
        rejectedInteractions += 1;
        break;
      case 'intent_accepted':
        accepted += 1;
        break;
      case 'intent_rejected':
        rejected += 1;
        break;
    }
  }

  const first = events[0];
  const last = events.at(-1);
  const fromMs = options.before?.simTimeMs ?? first?.simTime ?? null;
  const toMs = options.untilTimeMs ?? last?.simTime ?? fromMs;

  return {
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    fromMs,
    toMs,
    skippedMs,
    eventCount: events.length,
    intents: { accepted, rejected },
    rejectedInteractions,
    companions: [...companions.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([companionId, c]) => ({
        companionId,
        needsAtStart: c.needsAtStart,
        needsAtEnd: c.needsAtEnd,
        lowestNeeds: c.lowest === null ? null : toNeedRecord(c.lowest),
        activities: [...c.activities.entries()]
          .map(([activityId, t]) => ({ activityId, ...t }))
          .sort((a, b) =>
            b.completed !== a.completed
              ? b.completed - a.completed
              : a.activityId < b.activityId
                ? -1
                : 1,
          ),
        interactions: { ...c.interactions },
        criticalNeedEpisodes: c.criticalNeedEpisodes,
        distanceWalkedM: Math.round(c.distanceWalkedM * 1000) / 1000,
        taskAtEnd: c.taskAtEnd,
        highlights: c.highlights,
        highlightsTruncated: c.highlightsTruncated,
      })),
  };
}

function toNeedRecord(values: Record<string, number>): NeedRecord {
  const record = {} as Record<(typeof NEED_KEYS)[number], number>;
  for (const key of NEED_KEYS) record[key] = values[key] ?? 0;
  return record;
}
