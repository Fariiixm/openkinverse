import { z } from 'zod';
import { CharacterIdSchema, EventIdSchema } from './ids.ts';
import { SharingScopeSchema } from './sharing.ts';

/**
 * HTTP API v1 data transfer objects (`/v1`, ADR-0002).
 *
 * Shared by the companion server and its clients so request validation and
 * response types cannot drift. Request bodies are strict: unknown fields are
 * rejected. Personality traits and simulation state are simulation
 * configuration and state; they do not describe real feelings.
 */

export const API_VERSION = 'v1';

const Unit = z.number().min(0).max(1);
const IsoDateTime = z.iso.datetime({ offset: true });

// ---------------------------------------------------------------------------
// Errors

export const ApiErrorCodeSchema = z.enum([
  'bad_request',
  'validation_failed',
  'not_found',
  'conflict',
  'forbidden_host',
  'forbidden_origin',
  'gone',
  'internal',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: ApiErrorCodeSchema,
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ---------------------------------------------------------------------------
// Companion

export const COMPANION_TRAIT_KEYS = [
  'openness',
  'energy',
  'sociability',
  'curiosity',
  'tidiness',
] as const;

/** Bounded personality traits in [0, 1]. */
export const CompanionTraitsSchema = z.strictObject({
  openness: Unit,
  energy: Unit,
  sociability: Unit,
  curiosity: Unit,
  tidiness: Unit,
});
export type CompanionTraits = z.infer<typeof CompanionTraitsSchema>;

export const DEFAULT_COMPANION_TRAITS: CompanionTraits = {
  openness: 0.5,
  energy: 0.5,
  sociability: 0.5,
  curiosity: 0.5,
  tidiness: 0.5,
};

export const SchedulePresetSchema = z.enum(['day', 'night_owl', 'early_bird']);
export type SchedulePreset = z.infer<typeof SchedulePresetSchema>;

function isIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const TimeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(isIanaTimeZone, { message: 'Expected an IANA time zone such as "Europe/Madrid"' });

/** Tick length bounds in simulated milliseconds (ADR-0002 default: 60 s). */
export const MIN_TICK_MS = 1_000;
export const MAX_TICK_MS = 3_600_000;
export const DEFAULT_TICK_MS = 60_000;

export const CompanionConfigSchema = z.strictObject({
  tickMs: z.int().min(MIN_TICK_MS).max(MAX_TICK_MS),
  timezone: TimeZoneSchema,
  schedulePreset: SchedulePresetSchema,
});
export type CompanionConfig = z.infer<typeof CompanionConfigSchema>;

export const DEFAULT_COMPANION_CONFIG: CompanionConfig = {
  tickMs: DEFAULT_TICK_MS,
  timezone: 'UTC',
  schedulePreset: 'day',
};

/** `archived` companions do not advance. */
export const LifecycleStateSchema = z.enum(['active', 'dormant', 'archived']);
export type LifecycleState = z.infer<typeof LifecycleStateSchema>;

const CompanionName = z.string().trim().min(1).max(100);
const CompanionDescription = z.string().max(2000);

export const CompanionSchema = z.strictObject({
  id: CharacterIdSchema,
  name: CompanionName,
  description: CompanionDescription,
  personality: CompanionTraitsSchema,
  config: CompanionConfigSchema,
  lifecycle: LifecycleStateSchema,
  sharingScope: SharingScopeSchema,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type Companion = z.infer<typeof CompanionSchema>;

export const CompanionSummarySchema = CompanionSchema.pick({
  id: true,
  name: true,
  lifecycle: true,
  sharingScope: true,
  createdAt: true,
  updatedAt: true,
});
export type CompanionSummary = z.infer<typeof CompanionSummarySchema>;

/**
 * Simulation state as returned by the API. The `simulation` payload is owned
 * by `@openkinverse/simulation` and is opaque at this layer.
 */
export const CompanionStateSchema = z.strictObject({
  simulatedAt: IsoDateTime,
  lastEventSeq: z.int().min(0),
  simulation: z.record(z.string(), z.unknown()),
});
export type CompanionState = z.infer<typeof CompanionStateSchema>;

export const CompanionEventSchema = z.strictObject({
  id: EventIdSchema,
  companionId: CharacterIdSchema,
  seq: z.int().min(1),
  type: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/),
  simulatedAt: IsoDateTime,
  recordedAt: IsoDateTime,
  payload: z.record(z.string(), z.unknown()),
});
export type CompanionEvent = z.infer<typeof CompanionEventSchema>;

// ---------------------------------------------------------------------------
// Requests and responses

/** POST /v1/companions. Omitted fields take defaults; partial traits/config merge with defaults. */
export const CreateCompanionRequestSchema = z.strictObject({
  name: CompanionName,
  description: CompanionDescription.optional(),
  personality: CompanionTraitsSchema.partial().optional(),
  config: CompanionConfigSchema.partial().optional(),
});
export type CreateCompanionRequest = z.infer<typeof CreateCompanionRequestSchema>;

/** GET /v1/companions */
export const ListCompanionsResponseSchema = z.strictObject({
  items: z.array(CompanionSummarySchema),
});
export type ListCompanionsResponse = z.infer<typeof ListCompanionsResponseSchema>;

/** GET /v1/companions/:id */
export const GetCompanionResponseSchema = z.strictObject({
  companion: CompanionSchema,
  state: CompanionStateSchema,
});
export type GetCompanionResponse = z.infer<typeof GetCompanionResponseSchema>;

export const InteractionKindSchema = z.enum(['talk', 'play', 'feed', 'rest']);
export type InteractionKind = z.infer<typeof InteractionKindSchema>;

/** POST /v1/companions/:id/interactions */
export const InteractionRequestSchema = z.strictObject({
  kind: InteractionKindSchema,
  message: z.string().trim().min(1).max(2000).optional(),
});
export type InteractionRequest = z.infer<typeof InteractionRequestSchema>;

/** A reply produced by a responder. `source` labels how it was generated. */
export const CompanionReplySchema = z.strictObject({
  text: z.string(),
  source: z.enum(['rule_based']),
});
export type CompanionReply = z.infer<typeof CompanionReplySchema>;

export const InteractionResponseSchema = z.strictObject({
  accepted: z.boolean(),
  reason: z.string().optional(),
  reply: CompanionReplySchema.optional(),
  events: z.array(CompanionEventSchema),
  state: CompanionStateSchema,
});
export type InteractionResponse = z.infer<typeof InteractionResponseSchema>;

export const MAX_EVENTS_PAGE = 500;
export const DEFAULT_EVENTS_PAGE = 100;

/** Query string of GET /v1/companions/:id/events. */
export const ListEventsQuerySchema = z.strictObject({
  after: z.coerce.number().pipe(z.int().min(0)).default(0),
  limit: z.coerce.number().pipe(z.int().min(1).max(MAX_EVENTS_PAGE)).default(DEFAULT_EVENTS_PAGE),
});
export type ListEventsQuery = z.infer<typeof ListEventsQuerySchema>;

export const ListEventsResponseSchema = z.strictObject({
  items: z.array(CompanionEventSchema),
});
export type ListEventsResponse = z.infer<typeof ListEventsResponseSchema>;

/** POST /v1/companions/:id/lifecycle */
export const LifecycleRequestSchema = z.strictObject({
  state: LifecycleStateSchema,
});
export type LifecycleRequest = z.infer<typeof LifecycleRequestSchema>;

/** GET /v1/health */
export const HealthResponseSchema = z.strictObject({
  status: z.literal('ok'),
  version: z.literal(API_VERSION),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
