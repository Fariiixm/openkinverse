import { z } from 'zod';
import { CharacterDefinitionSchema } from './bundle.ts';
import { CharacterIdSchema } from './ids.ts';
import { SharingScopeSchema } from './sharing.ts';

/**
 * HTTP API v1 data transfer objects (`/v1`, ADR-0002).
 *
 * Shared by the companion server and its clients so request validation and
 * response types cannot drift. Request bodies are strict: unknown fields are
 * rejected. Personality, needs and simulation state are simulation
 * configuration and state; they do not describe real feelings.
 */

export const API_VERSION = 'v1';

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

/**
 * The canonical companion definition: the CharacterBundle v0 character
 * definition without its ID (the ID lives on the companion). Export and
 * import (#18) map this 1:1 to `manifest.character`.
 */
export const CompanionDefinitionSchema = CharacterDefinitionSchema.omit({ id: true });
export type CompanionDefinition = z.infer<typeof CompanionDefinitionSchema>;

/**
 * Stored lifecycle states. `paused` and `archived` companions do not advance.
 * "Dormant" is not a stored state (an active companion that nobody observes
 * catches up on its next access). Deletion is an operation, not a state.
 */
export const LifecycleStateSchema = z.enum(['active', 'paused', 'archived']);
export type LifecycleState = z.infer<typeof LifecycleStateSchema>;

export const CompanionSchema = z.strictObject({
  id: CharacterIdSchema,
  definition: CompanionDefinitionSchema,
  lifecycle: LifecycleStateSchema,
  sharingScope: SharingScopeSchema,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type Companion = z.infer<typeof CompanionSchema>;

export const CompanionSummarySchema = z.strictObject({
  id: CharacterIdSchema,
  name: z.string(),
  lifecycle: LifecycleStateSchema,
  sharingScope: SharingScopeSchema,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
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

/** Events are identified by `(companionId, seq)`; `seq` is monotonic per companion. */
export const CompanionEventSchema = z.strictObject({
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

/**
 * POST /v1/companions. A subset of the definition; omitted fields take server
 * defaults (empty description, default personality, schedule and needs).
 */
export const CreateCompanionRequestSchema = CompanionDefinitionSchema.partial().required({
  name: true,
});
export type CreateCompanionRequest = z.infer<typeof CreateCompanionRequestSchema>;

/** PATCH /v1/companions/:id. Replaces the given top-level definition fields. */
export const UpdateCompanionRequestSchema = CompanionDefinitionSchema.partial().refine(
  (body) => Object.keys(body).length > 0,
  { message: 'At least one field is required' },
);
export type UpdateCompanionRequest = z.infer<typeof UpdateCompanionRequestSchema>;

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
