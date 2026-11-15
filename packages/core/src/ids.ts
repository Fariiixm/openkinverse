import { z } from 'zod';

/**
 * Prefixed, opaque, URL-safe identifiers (ADR-0003).
 *
 * Format: `<prefix>_<ULID body>` where the body is 26 Crockford base32
 * characters (48-bit millisecond timestamp + 80 bits of randomness).
 * IDs never encode personal data or location.
 */

export const ID_PREFIXES = [
  'chr',
  'wld',
  'room',
  'obj',
  'anc',
  'bind',
  'mem',
  'evt',
  'usr',
  'grant',
] as const;

export type IdPrefix = (typeof ID_PREFIXES)[number];

export const IdPrefixSchema = z.enum(ID_PREFIXES);

/** Crockford base32 alphabet (excludes I, L, O and U). */
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const ULID_BODY_LENGTH = 26;

/** Largest timestamp representable in the 48-bit ULID time component. */
export const MAX_ULID_TIME = 2 ** 48 - 1;

/**
 * Canonical ULID body: uppercase Crockford base32, 26 characters. The first
 * character is limited to 0-7 because a ULID holds exactly 128 bits.
 */
const ULID_BODY_PATTERN = '[0-7][0-9A-HJKMNP-TV-Z]{25}';
const ULID_BODY_REGEX = new RegExp(`^${ULID_BODY_PATTERN}$`);

export function isValidUlidBody(body: string): boolean {
  return ULID_BODY_REGEX.test(body);
}

const ANY_ID_REGEX = new RegExp(`^(${ID_PREFIXES.join('|')})_(${ULID_BODY_PATTERN})$`);

function prefixedIdSchema<P extends IdPrefix>(prefix: P) {
  const regex = new RegExp(`^${prefix}_${ULID_BODY_PATTERN}$`);
  return z
    .string()
    .regex(regex, { message: `Expected an ID of the form ${prefix}_<26 Crockford base32 chars>` })
    .brand<`${P}Id`>();
}

export const CharacterIdSchema = prefixedIdSchema('chr');
export const WorldIdSchema = prefixedIdSchema('wld');
export const RoomIdSchema = prefixedIdSchema('room');
export const ObjectIdSchema = prefixedIdSchema('obj');
export const AnchorIdSchema = prefixedIdSchema('anc');
export const BindingIdSchema = prefixedIdSchema('bind');
export const MemoryIdSchema = prefixedIdSchema('mem');
export const EventIdSchema = prefixedIdSchema('evt');
export const UserIdSchema = prefixedIdSchema('usr');
export const GrantIdSchema = prefixedIdSchema('grant');

export type CharacterId = z.infer<typeof CharacterIdSchema>;
export type WorldId = z.infer<typeof WorldIdSchema>;
export type RoomId = z.infer<typeof RoomIdSchema>;
export type ObjectId = z.infer<typeof ObjectIdSchema>;
export type AnchorId = z.infer<typeof AnchorIdSchema>;
export type BindingId = z.infer<typeof BindingIdSchema>;
export type MemoryId = z.infer<typeof MemoryIdSchema>;
export type EventId = z.infer<typeof EventIdSchema>;
export type UserId = z.infer<typeof UserIdSchema>;
export type GrantId = z.infer<typeof GrantIdSchema>;

/** Maps each prefix to its branded ID type. */
export interface IdByPrefix {
  chr: CharacterId;
  wld: WorldId;
  room: RoomId;
  obj: ObjectId;
  anc: AnchorId;
  bind: BindingId;
  mem: MemoryId;
  evt: EventId;
  usr: UserId;
  grant: GrantId;
}

export const ID_SCHEMAS = {
  chr: CharacterIdSchema,
  wld: WorldIdSchema,
  room: RoomIdSchema,
  obj: ObjectIdSchema,
  anc: AnchorIdSchema,
  bind: BindingIdSchema,
  mem: MemoryIdSchema,
  evt: EventIdSchema,
  usr: UserIdSchema,
  grant: GrantIdSchema,
} as const;

/** Any valid prefixed ID, regardless of prefix. */
export type AnyId = IdByPrefix[IdPrefix];

export const AnyIdSchema = z.custom<AnyId>(
  (value) => typeof value === 'string' && ANY_ID_REGEX.test(value),
  { message: 'Expected a prefixed OpenKinverse ID' },
);

/** Returns the prefix of a valid ID, or `undefined` if the value is not a valid ID. */
export function idPrefixOf(value: string): IdPrefix | undefined {
  const match = ANY_ID_REGEX.exec(value);
  return match ? (match[1] as IdPrefix) : undefined;
}

export function isId<P extends IdPrefix>(prefix: P, value: unknown): value is IdByPrefix[P] {
  return ID_SCHEMAS[prefix].safeParse(value).success;
}

export interface NewIdOptions {
  /** Milliseconds since the Unix epoch. Defaults to `Date.now`. */
  now?: () => number;
  /**
   * Returns `length` random bytes. Defaults to `globalThis.crypto.getRandomValues`.
   * Inject a deterministic source in tests.
   */
  random?: (length: number) => Uint8Array;
}

const RANDOM_BYTES = 10; // 80 bits

function defaultRandom(length: number): Uint8Array {
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } })
    .crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('No secure random source available; pass options.random explicitly');
  }
  return cryptoApi.getRandomValues(new Uint8Array(length));
}

function encodeTime(time: number): string {
  if (!Number.isInteger(time) || time < 0 || time > MAX_ULID_TIME) {
    throw new RangeError(
      `ULID time must be an integer in [0, ${String(MAX_ULID_TIME)}], got ${String(time)}`,
    );
  }
  let out = '';
  let remaining = time;
  for (let i = 0; i < 10; i++) {
    const mod = remaining % 32;
    out = CROCKFORD_ALPHABET.charAt(mod) + out;
    remaining = (remaining - mod) / 32;
  }
  return out;
}

function encodeRandom(bytes: Uint8Array): string {
  if (bytes.length !== RANDOM_BYTES) {
    throw new RangeError(
      `Random source must return ${String(RANDOM_BYTES)} bytes, got ${String(bytes.length)}`,
    );
  }
  // 80 bits -> 16 groups of 5 bits, most significant first.
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
      throw new RangeError('Random source returned a non-byte value');
    }
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += CROCKFORD_ALPHABET.charAt((buffer >> bits) & 31);
    }
    buffer &= (1 << bits) - 1;
  }
  return out;
}

/** Creates a ULID body from a timestamp and 10 random bytes. Pure. */
export function encodeUlidBody(time: number, randomBytes: Uint8Array): string {
  return encodeTime(time) + encodeRandom(randomBytes);
}

/**
 * Creates a new prefixed ID. Time and randomness are injectable so tests can
 * produce deterministic IDs.
 */
export function newId<P extends IdPrefix>(prefix: P, options: NewIdOptions = {}): IdByPrefix[P] {
  if (!IdPrefixSchema.safeParse(prefix).success) {
    throw new TypeError(`Unknown ID prefix: ${prefix}`);
  }
  const now = options.now ?? Date.now;
  const random = options.random ?? defaultRandom;
  const body = encodeUlidBody(now(), random(RANDOM_BYTES));
  return ID_SCHEMAS[prefix].parse(`${prefix}_${body}`) as IdByPrefix[P];
}
