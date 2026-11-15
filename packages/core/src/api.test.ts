import { describe, expect, it } from 'vitest';
import {
  ApiErrorSchema,
  CompanionEventSchema,
  CompanionSchema,
  CreateCompanionRequestSchema,
  InteractionRequestSchema,
  LifecycleRequestSchema,
  ListEventsQuerySchema,
  UpdateCompanionRequestSchema,
} from './index.ts';

const definition = {
  name: 'Pip',
  description: '',
  personality: { traits: { openness: 0.5, energy: 0.7, curiosity: 1, tidiness: 0 } },
  appearance: { preset: 'default.round-01', parameters: {} },
  schedule: {
    blocks: [{ activity: 'sleep', days: ['mon'], startMinute: 0, endMinute: 420 }],
  },
  needs: [{ key: 'energy', initial: 0.8, decayPerHour: 0.05 }],
};

const companion = {
  id: 'chr_01ARYZ6S41TSV4RRFFQ69G5FAV',
  definition,
  lifecycle: 'active',
  sharingScope: 'private',
  createdAt: '2026-11-15T10:00:00Z',
  updatedAt: '2026-11-15T10:00:00Z',
};

describe('API v1 DTOs', () => {
  it('accepts a valid companion whose definition is a bundle character definition', () => {
    expect(CompanionSchema.parse(companion).definition.name).toBe('Pip');
  });

  it.each([
    ['trait above 1', { definition: { ...definition, personality: { traits: { energy: 1.5 } } } }],
    ['id inside the definition', { definition: { ...definition, id: companion.id } }],
    ['unknown scope', { sharingScope: 'friends' }],
    ['missing scope', { sharingScope: undefined }],
    ['dormant lifecycle (not stored)', { lifecycle: 'dormant' }],
    ['unknown lifecycle', { lifecycle: 'deleted' }],
    ['unknown field', { extra: 1 }],
  ])('rejects a companion with %s', (_label, patch) => {
    expect(CompanionSchema.safeParse({ ...companion, ...patch }).success).toBe(false);
  });

  it('validates create requests strictly', () => {
    expect(CreateCompanionRequestSchema.parse({ name: ' Pip ' }).name).toBe('Pip');
    expect(
      CreateCompanionRequestSchema.safeParse({
        name: 'Pip',
        personality: { traits: { energy: 0.2 } },
      }).success,
    ).toBe(true);
    expect(CreateCompanionRequestSchema.safeParse({}).success).toBe(false);
    expect(CreateCompanionRequestSchema.safeParse({ name: '' }).success).toBe(false);
    expect(
      CreateCompanionRequestSchema.safeParse({ name: 'Pip', sharingScope: 'public' }).success,
    ).toBe(false);
    expect(CreateCompanionRequestSchema.safeParse({ name: 'Pip', id: companion.id }).success).toBe(
      false,
    );
  });

  it('validates update requests', () => {
    expect(UpdateCompanionRequestSchema.safeParse({ description: 'x' }).success).toBe(true);
    expect(UpdateCompanionRequestSchema.safeParse({}).success).toBe(false);
    expect(UpdateCompanionRequestSchema.safeParse({ lifecycle: 'paused' }).success).toBe(false);
  });

  it('identifies events by companion and sequence, without random IDs', () => {
    const event = {
      companionId: companion.id,
      seq: 1,
      type: 'character.created',
      simulatedAt: '2026-11-15T10:00:00Z',
      recordedAt: '2026-11-15T10:00:00Z',
      payload: {},
    };
    expect(CompanionEventSchema.safeParse(event).success).toBe(true);
    expect(
      CompanionEventSchema.safeParse({ ...event, id: 'evt_01ARYZ6S41TSV4RRFFQ69G5FAV' }).success,
    ).toBe(false);
    expect(CompanionEventSchema.safeParse({ ...event, seq: 0 }).success).toBe(false);
  });

  it('validates interactions and lifecycle requests', () => {
    expect(InteractionRequestSchema.parse({ kind: 'talk', message: 'hi' }).kind).toBe('talk');
    expect(InteractionRequestSchema.safeParse({ kind: 'shell', message: 'rm -rf /' }).success).toBe(
      false,
    );
    expect(LifecycleRequestSchema.safeParse({ state: 'paused' }).success).toBe(true);
    expect(LifecycleRequestSchema.safeParse({ state: 'archived' }).success).toBe(true);
    expect(LifecycleRequestSchema.safeParse({ state: 'dormant' }).success).toBe(false);
  });

  it('coerces and bounds event pagination query values', () => {
    expect(ListEventsQuerySchema.parse({})).toEqual({ after: 0, limit: 100 });
    expect(ListEventsQuerySchema.parse({ after: '5', limit: '10' })).toEqual({
      after: 5,
      limit: 10,
    });
    expect(ListEventsQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(ListEventsQuerySchema.safeParse({ limit: '501' }).success).toBe(false);
    expect(ListEventsQuerySchema.safeParse({ after: '-1' }).success).toBe(false);
    expect(ListEventsQuerySchema.safeParse({ after: 'abc' }).success).toBe(false);
  });

  it('describes errors as {error:{code,message}}', () => {
    expect(ApiErrorSchema.safeParse({ error: { code: 'not_found', message: 'x' } }).success).toBe(
      true,
    );
    expect(ApiErrorSchema.safeParse({ error: { code: 'teapot', message: 'x' } }).success).toBe(
      false,
    );
  });
});
