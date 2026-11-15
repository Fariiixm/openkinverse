/**
 * Seeded, serializable pseudo-random number generator (mulberry32).
 *
 * The generator state is a single unsigned 32-bit integer stored inside
 * `WorldState`, so a world can be persisted and resumed without losing its
 * random sequence. All functions are pure: they return the next state instead
 * of mutating anything.
 */

/** Serializable PRNG state. `algorithm` is recorded so the format can evolve. */
export interface RngState {
  readonly algorithm: 'mulberry32';
  /** Unsigned 32-bit integer. */
  readonly state: number;
}

/** Result of drawing a value from the generator. */
export interface RngDraw<T> {
  readonly value: T;
  readonly rng: RngState;
}

/** Creates a generator state from an integer seed. The seed is coerced to uint32. */
export function createRng(seed: number): RngState {
  if (!Number.isFinite(seed) || !Number.isInteger(seed)) {
    throw new RangeError(`seed must be a finite integer, received ${String(seed)}`);
  }
  return { algorithm: 'mulberry32', state: seed >>> 0 };
}

/** Draws a float in [0, 1). */
export function nextFloat(rng: RngState): RngDraw<number> {
  const next = (rng.state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, rng: { algorithm: 'mulberry32', state: next } };
}

/** Draws an integer in [0, exclusiveMax). */
export function nextInt(rng: RngState, exclusiveMax: number): RngDraw<number> {
  if (!Number.isInteger(exclusiveMax) || exclusiveMax <= 0) {
    throw new RangeError(
      `exclusiveMax must be a positive integer, received ${String(exclusiveMax)}`,
    );
  }
  const draw = nextFloat(rng);
  return { value: Math.floor(draw.value * exclusiveMax), rng: draw.rng };
}
