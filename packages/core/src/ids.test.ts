import { describe, expect, it } from 'vitest';
import {
  AnyIdSchema,
  CharacterIdSchema,
  ID_PREFIXES,
  ID_SCHEMAS,
  MAX_ULID_TIME,
  UserIdSchema,
  encodeUlidBody,
  idPrefixOf,
  isId,
  isValidUlidBody,
  newId,
} from './index.ts';

const zeros = () => new Uint8Array(10);
const ones = () => new Uint8Array(10).fill(0xff);
const fixed = (time: number) => () => time;

describe('newId', () => {
  it('encodes the ULID spec time vector', () => {
    // Reference: ulid spec, ulid(1469918176385) starts with 01ARYZ6S41.
    const id = newId('chr', { now: fixed(1469918176385), random: zeros });
    expect(id).toBe('chr_01ARYZ6S410000000000000000');
  });

  it('is deterministic for the same injected time and randomness', () => {
    const opts = {
      now: fixed(1_700_000_000_000),
      random: () => Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    };
    expect(newId('mem', opts)).toBe(newId('mem', opts));
  });

  it('encodes randomness bits most-significant first', () => {
    expect(encodeUlidBody(0, ones())).toBe('0000000000ZZZZZZZZZZZZZZZZ');
    expect(encodeUlidBody(0, Uint8Array.from([0x08, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(
      '00000000001000000000000000',
    );
  });

  it('encodes the maximum timestamp', () => {
    expect(encodeUlidBody(MAX_ULID_TIME, ones())).toBe('7ZZZZZZZZZZZZZZZZZZZZZZZZZ');
  });

  it('produces IDs that validate for every prefix', () => {
    for (const prefix of ID_PREFIXES) {
      const id = newId(prefix, { now: fixed(1_700_000_000_000), random: ones });
      expect(id.startsWith(`${prefix}_`)).toBe(true);
      expect(ID_SCHEMAS[prefix].safeParse(id).success).toBe(true);
      expect(idPrefixOf(id)).toBe(prefix);
    }
  });

  it('sorts lexicographically by time', () => {
    const a = newId('evt', { now: fixed(1000), random: ones });
    const b = newId('evt', { now: fixed(1001), random: zeros });
    expect(a < b).toBe(true);
  });

  it('uses the platform secure random source by default', () => {
    const a = newId('usr');
    const b = newId('usr');
    expect(UserIdSchema.safeParse(a).success).toBe(true);
    expect(a).not.toBe(b);
  });

  it.each([-1, 1.5, MAX_ULID_TIME + 1, Number.NaN])('rejects invalid time %s', (time) => {
    expect(() => newId('chr', { now: fixed(time), random: zeros })).toThrow(RangeError);
  });

  it('rejects a random source returning the wrong length', () => {
    expect(() => newId('chr', { now: fixed(0), random: () => new Uint8Array(9) })).toThrow(
      RangeError,
    );
  });

  it('rejects unknown prefixes at runtime', () => {
    expect(() => newId('nope' as 'chr', { now: fixed(0), random: zeros })).toThrow(TypeError);
  });
});

describe('ID schemas', () => {
  const body = '01ARYZ6S41TSV4RRFFQ69G5FAV';

  it('accepts canonical IDs', () => {
    expect(CharacterIdSchema.parse(`chr_${body}`)).toBe(`chr_${body}`);
    expect(isId('chr', `chr_${body}`)).toBe(true);
    expect(AnyIdSchema.safeParse(`grant_${body}`).success).toBe(true);
  });

  it.each([
    ['wrong prefix', `usr_${body}`],
    ['no separator', `chr${body}`],
    ['lowercase body', `chr_${body.toLowerCase()}`],
    ['too short', `chr_${body.slice(1)}`],
    ['too long', `chr_${body}0`],
    ['excluded letter I', `chr_01ARYZ6S41TSV4RRFFQ69G5FAI`],
    ['excluded letter L', `chr_01ARYZ6S41TSV4RRFFQ69G5FAL`],
    ['excluded letter O', `chr_01ARYZ6S41TSV4RRFFQ69G5FAO`],
    ['excluded letter U', `chr_01ARYZ6S41TSV4RRFFQ69G5FAU`],
    ['overflowing first char', `chr_8${body.slice(1)}`],
    ['whitespace', ` chr_${body}`],
  ])('rejects %s', (_label, value) => {
    expect(CharacterIdSchema.safeParse(value).success).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(CharacterIdSchema.safeParse(42).success).toBe(false);
    expect(isId('chr', null)).toBe(false);
  });

  it('validates bare ULID bodies', () => {
    expect(isValidUlidBody(body)).toBe(true);
    expect(isValidUlidBody('8ZZZZZZZZZZZZZZZZZZZZZZZZZ')).toBe(false);
  });

  it('rejects unknown prefixes in AnyIdSchema and idPrefixOf', () => {
    expect(AnyIdSchema.safeParse(`foo_${body}`).success).toBe(false);
    expect(idPrefixOf(`foo_${body}`)).toBeUndefined();
  });
});
