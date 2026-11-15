/**
 * Structured intents and their deterministic validator.
 *
 * Intents are proposals, for example from a dialogue provider or a user
 * interface. They are untrusted input: `validateIntent` accepts `unknown`,
 * checks the shape against an allowlist of intent kinds and checks legality
 * against the current state. Only accepted intents change simulation state.
 * Rejections are recorded as `intent_rejected` events whose payload contains
 * only allowlisted values (never free text copied from the proposal).
 */
import type { IntentRejectionReason } from './events.ts';
import { distance, findSpot, nearestSpotFor } from './room.ts';
import type { ActivitySpot, CharacterState, Task, WorldState } from './types.ts';

/** Version of the intent layout accepted by `validateIntent`. */
export const INTENT_SCHEMA_VERSION = 1 as const;

export const INTENT_KINDS = ['start_activity', 'move_to_spot', 'stop_task'] as const;
export type IntentKind = (typeof INTENT_KINDS)[number];

/** Start a defined activity, optionally at a specific spot (nearest supporting spot otherwise). */
export interface StartActivityIntent {
  readonly kind: 'start_activity';
  readonly characterId: string;
  readonly activityId: string;
  readonly spotId?: string;
}

/** Walk to a spot without performing an activity there. */
export interface MoveToSpotIntent {
  readonly kind: 'move_to_spot';
  readonly characterId: string;
  readonly spotId: string;
}

/** Stop the character's current task. */
export interface StopTaskIntent {
  readonly kind: 'stop_task';
  readonly characterId: string;
}

export type Intent = StartActivityIntent | MoveToSpotIntent | StopTaskIntent;

export type IntentValidation =
  | {
      readonly accepted: true;
      readonly intent: Intent;
      /** Task to start; `null` for `stop_task`. */
      readonly task: Task | null;
      /** Whether the character's current task must be interrupted first. */
      readonly interruptsCurrentTask: boolean;
    }
  | {
      readonly accepted: false;
      readonly reason: IntentRejectionReason;
      /** Intent kind if it is allowlisted, otherwise `null`. */
      readonly intentKind: IntentKind | null;
      /** Character ID if it refers to an existing character, otherwise `null`. */
      readonly characterId: string | null;
    };

const MAX_ID_LENGTH = 128;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

function isIntentKind(value: unknown): value is IntentKind {
  return typeof value === 'string' && (INTENT_KINDS as readonly string[]).includes(value);
}

const ALLOWED_KEYS: Readonly<Record<IntentKind, readonly string[]>> = {
  start_activity: ['kind', 'characterId', 'activityId', 'spotId'],
  move_to_spot: ['kind', 'characterId', 'spotId'],
  stop_task: ['kind', 'characterId'],
};

/** Parses untrusted input into an `Intent`, or returns `null` if malformed. */
function parseIntent(kind: IntentKind, raw: Record<string, unknown>): Intent | null {
  if (Object.keys(raw).some((key) => !ALLOWED_KEYS[kind].includes(key))) return null;
  if (!isId(raw['characterId'])) return null;
  const characterId = raw['characterId'];
  switch (kind) {
    case 'start_activity': {
      const activityId = raw['activityId'];
      const spotId = raw['spotId'];
      if (!isId(activityId)) return null;
      if (spotId === undefined) return { kind, characterId, activityId };
      if (!isId(spotId)) return null;
      return { kind, characterId, activityId, spotId };
    }
    case 'move_to_spot':
      if (!isId(raw['spotId'])) return null;
      return { kind, characterId, spotId: raw['spotId'] };
    case 'stop_task':
      return { kind, characterId };
  }
}

function reject(
  reason: IntentRejectionReason,
  intentKind: IntentKind | null,
  characterId: string | null,
): IntentValidation {
  return { accepted: false, reason, intentKind, characterId };
}

/**
 * Deterministically validates an untrusted intent against the current state.
 * Pure: does not modify `state`.
 */
export function validateIntent(state: WorldState, input: unknown): IntentValidation {
  if (!isRecord(input)) return reject('malformed_intent', null, null);
  const kind = input['kind'];
  if (!isIntentKind(kind)) {
    return reject(typeof kind === 'string' ? 'unsupported_intent' : 'malformed_intent', null, null);
  }
  const intent = parseIntent(kind, input);
  if (intent === null) return reject('malformed_intent', kind, null);

  const character: CharacterState | undefined = state.characters.find(
    (c) => c.id === intent.characterId,
  );
  if (character === undefined) return reject('unknown_character', kind, null);

  switch (intent.kind) {
    case 'start_activity': {
      if (!state.activities.some((a) => a.id === intent.activityId)) {
        return reject('unknown_activity', kind, character.id);
      }
      let spot: ActivitySpot | undefined;
      if (intent.spotId !== undefined) {
        spot = findSpot(state.room, intent.spotId);
        if (spot === undefined) return reject('unknown_spot', kind, character.id);
        if (!spot.activityIds.includes(intent.activityId)) {
          return reject('spot_does_not_support_activity', kind, character.id);
        }
      } else {
        spot = nearestSpotFor(state.room, intent.activityId, character.position);
        if (spot === undefined) return reject('no_spot_for_activity', kind, character.id);
      }
      const current = character.task;
      if (
        current?.type === 'activity' &&
        current.activityId === intent.activityId &&
        current.spotId === spot.id
      ) {
        return reject('already_performing_activity', kind, character.id);
      }
      return {
        accepted: true,
        intent,
        task: {
          type: 'activity',
          activityId: intent.activityId,
          spotId: spot.id,
          reason: 'intent',
          phase: 'moving',
          endsAtMs: null,
        },
        interruptsCurrentTask: current !== null,
      };
    }
    case 'move_to_spot': {
      const spot = findSpot(state.room, intent.spotId);
      if (spot === undefined) return reject('unknown_spot', kind, character.id);
      if (character.task === null && distance(character.position, spot.position) === 0) {
        return reject('already_at_spot', kind, character.id);
      }
      return {
        accepted: true,
        intent,
        task: { type: 'move', spotId: spot.id, reason: 'intent' },
        interruptsCurrentTask: character.task !== null,
      };
    }
    case 'stop_task':
      if (character.task === null) return reject('no_active_task', kind, character.id);
      return { accepted: true, intent, task: null, interruptsCurrentTask: true };
  }
}
