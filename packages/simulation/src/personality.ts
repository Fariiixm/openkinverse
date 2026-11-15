/**
 * Deterministic mapping from personality traits to simulation parameters.
 *
 * Traits are configuration numbers in [0, 1]. They only change rates and
 * weights used by the deterministic engine; they do not model feelings.
 */
import type { NeedRecord, Personality } from './types.ts';

/** Need decay per simulated hour derived from traits. */
export function decayFromPersonality(p: Personality): NeedRecord {
  return {
    energy: 5 - 2 * p.energy,
    satiety: 6,
    social: 2 + 3 * p.sociability,
    fun: 3 + 1.5 * (p.openness + p.curiosity),
  };
}

/** Urgency multipliers per need derived from traits. */
export function needWeightsFromPersonality(p: Personality): NeedRecord {
  return {
    energy: 1.25 - 0.5 * p.energy,
    satiety: 1,
    social: 0.75 + 0.5 * p.sociability,
    fun: 0.75 + 0.25 * (p.openness + p.curiosity),
  };
}

/** Activity preference weights for the default activity catalog. */
export function affinityFromPersonality(p: Personality): Readonly<Record<string, number>> {
  return {
    sleep: 1,
    eat: 1,
    call_friend: 0.25 + p.sociability,
    watch_tv: 1.25 - 0.5 * p.energy,
    play_game: 0.25 + p.openness,
    read_book: 0.25 + p.curiosity,
    tidy_up: 0.1 + p.tidiness,
  };
}
