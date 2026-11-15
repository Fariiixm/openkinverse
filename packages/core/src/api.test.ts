import { describe, expect, it } from 'vitest';
import {
  ApiErrorSchema,
  CompanionSchema,
  CreateCompanionRequestSchema,
  DEFAULT_COMPANION_CONFIG,
  InteractionRequestSchema,
  LifecycleRequestSchema,
  ListEventsQuerySchema,
} from './index.ts';

const companion = {
  id: 'chr_01ARYZ6S41TSV4RRFFQ69G5FAV',
  name: 'Pip',
  description: '',
  personality: { openness: 0.5, energy: 0.7, sociability: 0.4, curiosity: 1, tidiness: 0 },
  config: DEFAULT_COMPANION_CONFIG,
  lifecycle: 'active',
  sharingScope: 'private',
  createdAt: '2026-11-15T10:00:00Z',
  updatedAt: '2026-11-15T10:00:00Z',
};

describe('API v1 DTOs', () => {
  it('accepts a valid companion', () => {
    expect(CompanionSchema.parse(companion).name).toBe('Pip');
  });

  it.each([
    ['trait above 1', { personality: { ...companion.personality, energy: 1.5 } }],
    ['unknown trait', { personality: { ...companion.personality, mood: 0.5 } }],
    ['unknown scope', { sharingScope: 'friends' }],
    ['missing scope', { sharingScope: undefined }],
    ['unknown lifecycle', { lifecycle: 'deleted' }],
    ['invalid timezone', { config: { ...DEFAULT_COMPANION_CONFIG, timezone: 'Mars/Base' } }],
    ['tick too small', { config: { ...DEFAULT_COMPANION_CONFIG, tickMs: 10 } }],
    ['unknown field', { extra: 1 }],
  ])('rejects a companion with %s', (_label, patch) => {
    expect(CompanionSchema.safeParse({ ...companion, ...patch }).success).toBe(false);
  });

  it('validates create requests strictly', () => {
    expect(CreateCompanionRequestSchema.parse({ name: ' Pip ' }).name).toBe('Pip');
    expect(
      CreateCompanionRequestSchema.safeParse({ name: 'Pip', personality: { energy: 0.2 } }).success,
    ).toBe(true);
    expect(CreateCompanionRequestSchema.safeParse({ name: '' }).success).toBe(false);
    expect(
      CreateCompanionRequestSchema.safeParse({ name: 'Pip', sharingScope: 'public' }).success,
    ).toBe(false);
  });

  it('validates interactions and lifecycle requests', () => {
    expect(InteractionRequestSchema.parse({ kind: 'talk', message: 'hi' }).kind).toBe('talk');
    expect(InteractionRequestSchema.safeParse({ kind: 'shell', message: 'rm -rf /' }).success).toBe(
      false,
    );
    expect(LifecycleRequestSchema.safeParse({ state: 'archived' }).success).toBe(true);
    expect(LifecycleRequestSchema.safeParse({ state: 'gone' }).success).toBe(false);
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
