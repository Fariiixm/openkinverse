import { describe, expect, it } from 'vitest';
import {
  type AccessGrant,
  DEFAULT_SHARING_SCOPE,
  GrantIdSchema,
  SharingScopeInputSchema,
  SharingScopeSchema,
  canAccess,
  newId,
} from './index.ts';

let counter = 0;
const id = <P extends 'chr' | 'mem' | 'usr' | 'grant'>(prefix: P) =>
  newId(prefix, { now: () => 1_700_000_000_000, random: () => new Uint8Array(10).fill(++counter) });

const owner = id('usr');
const friend = id('usr');
const stranger = id('usr');
const character = id('chr');
const memory = id('mem');

const friendGrant: AccessGrant = { id: id('grant'), resourceId: character, granteeId: friend };

describe('SharingScope', () => {
  it('defaults to private', () => {
    expect(DEFAULT_SHARING_SCOPE).toBe('private');
    expect(SharingScopeInputSchema.parse(undefined)).toBe('private');
  });

  it.each(['private', 'invited', 'public'])('accepts %s', (scope) => {
    expect(SharingScopeSchema.parse(scope)).toBe(scope);
  });

  it.each([undefined, null, '', 'Public', 'friends', 0, true])(
    'rejects %s in stored data',
    (scope) => {
      expect(SharingScopeSchema.safeParse(scope).success).toBe(false);
    },
  );

  it.each([null, '', 'friends'])('does not coerce %s on input', (scope) => {
    expect(SharingScopeInputSchema.safeParse(scope).success).toBe(false);
  });
});

describe('canAccess', () => {
  const resource = (scope: unknown, rid: string = character) => ({
    id: rid,
    ownerId: owner,
    scope,
  });

  it('allows the owner for every scope', () => {
    for (const scope of ['private', 'invited', 'public']) {
      expect(canAccess(resource(scope), [], owner)).toBe(true);
    }
  });

  it('denies everyone but the owner for private resources, even with a grant', () => {
    expect(canAccess(resource('private'), [friendGrant], friend)).toBe(false);
    expect(canAccess(resource('private'), [], null)).toBe(false);
  });

  it('allows invited users only with a matching grant', () => {
    expect(canAccess(resource('invited'), [friendGrant], friend)).toBe(true);
    expect(canAccess(resource('invited'), [friendGrant], stranger)).toBe(false);
    expect(canAccess(resource('invited'), [], friend)).toBe(false);
    expect(canAccess(resource('invited'), [friendGrant], null)).toBe(false);
  });

  it('does not transfer a character grant to its memories', () => {
    expect(canAccess(resource('invited', memory), [friendGrant], friend)).toBe(false);
  });

  it('allows anyone for public resources', () => {
    expect(canAccess(resource('public'), [], stranger)).toBe(true);
    expect(canAccess(resource('public'), [], null)).toBe(true);
  });

  it.each([undefined, null, '', 'shared', 'PUBLIC'])(
    'denies unknown or missing scope %s',
    (scope) => {
      expect(canAccess(resource(scope), [friendGrant], friend)).toBe(false);
      expect(canAccess(resource(scope), [], stranger)).toBe(false);
    },
  );

  it('denies when resource or owner IDs are invalid', () => {
    expect(canAccess({ id: 'not-an-id', ownerId: owner, scope: 'public' }, [], stranger)).toBe(
      false,
    );
    expect(canAccess({ id: character, ownerId: 'nobody', scope: 'public' }, [], stranger)).toBe(
      false,
    );
  });

  it('ignores malformed grants', () => {
    const bad = {
      id: 'grant_x',
      resourceId: character,
      granteeId: friend,
    } as unknown as AccessGrant;
    expect(GrantIdSchema.safeParse(bad.id).success).toBe(false);
    expect(canAccess(resource('invited'), [bad], friend)).toBe(false);
  });

  it('does not treat an invalid viewer string as the owner', () => {
    const r = { id: character, ownerId: 'usr_bad', scope: 'private' };
    expect(canAccess(r, [], 'usr_bad' as typeof owner)).toBe(false);
  });
});
