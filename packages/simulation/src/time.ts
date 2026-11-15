/**
 * Time-zone aware schedule evaluation.
 *
 * Simulated time is UTC epoch milliseconds. Schedules are written in the
 * world's local time (IANA time zone) and evaluated with `Intl`, so results
 * depend on the tz database shipped with the runtime; the server is the only
 * authoritative executor (ADR-0002).
 *
 * DST rules (ADR-0002):
 * - Skipped local times start at the next valid minute: a block starting at
 *   02:30 on a day where 02:00-03:00 does not exist becomes active at 03:00.
 * - Repeated local times use the first occurrence: during the second pass
 *   through a repeated hour, a block is active only if it was still active
 *   at the end of the first pass.
 */
import { MS_PER_HOUR, MS_PER_MINUTE, type ScheduleBlock } from './types.ts';

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timezone: string): Intl.DateTimeFormat {
  let cached = formatters.get(timezone);
  if (cached === undefined) {
    cached = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(timezone, cached);
  }
  return cached;
}

/** Returns true if the runtime recognizes `timezone` as an IANA time zone. */
export function isValidTimeZone(timezone: string): boolean {
  if (timezone.length === 0) return false;
  try {
    formatter(timezone);
    return true;
  } catch {
    return false;
  }
}

/** Offset of local time from UTC at `utcMs`, in milliseconds (whole seconds). */
export function timeZoneOffsetMs(utcMs: number, timezone: string): number {
  const parts: Record<string, number> = {};
  for (const part of formatter(timezone).formatToParts(utcMs)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  const get = (key: string): number => parts[key] ?? 0;
  const hour = get('hour') === 24 ? 0 : get('hour');
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

function minuteOf(localMs: number): number {
  const msOfDay = ((localMs % 86_400_000) + 86_400_000) % 86_400_000;
  return Math.floor(msOfDay / MS_PER_MINUTE);
}

/** Local minute of the day in [0, 1440) at `utcMs`. */
export function localMinuteOfDay(utcMs: number, timezone: string): number {
  return minuteOf(utcMs + timeZoneOffsetMs(utcMs, timezone));
}

/**
 * If `utcMs` lies in the second occurrence of a repeated local period
 * (clocks set back), returns the local minute at which that period ends;
 * otherwise `null`.
 */
export function repeatedPeriodEndMinute(utcMs: number, timezone: string): number | null {
  const now = timeZoneOffsetMs(utcMs, timezone);
  const earlier = timeZoneOffsetMs(utcMs - 6 * MS_PER_HOUR, timezone);
  if (earlier <= now) return null;
  const shift = earlier - now;
  if (timeZoneOffsetMs(utcMs - shift, timezone) !== earlier) return null;
  // Binary search the transition instant in (utcMs - shift, utcMs] at minute resolution.
  let lo = utcMs - shift;
  let hi = utcMs;
  while (hi - lo > MS_PER_MINUTE) {
    const mid = lo + Math.floor((hi - lo) / 2 / MS_PER_MINUTE) * MS_PER_MINUTE;
    if (mid <= lo) break;
    if (timeZoneOffsetMs(mid, timezone) === earlier) lo = mid;
    else hi = mid;
  }
  return minuteOf(hi + earlier);
}

interface LocalClock {
  readonly minute: number;
  readonly repeatEnd: number | null;
}

function localClock(utcMs: number, timezone: string): LocalClock {
  return {
    minute: localMinuteOfDay(utcMs, timezone),
    repeatEnd: repeatedPeriodEndMinute(utcMs, timezone),
  };
}

function blockActiveAt(block: ScheduleBlock, clock: LocalClock): boolean {
  const { startMinute: s, endMinute: e } = block;
  const { minute, repeatEnd } = clock;
  if (repeatEnd === null) {
    return s <= e ? minute >= s && minute < e : minute >= s || minute < e;
  }
  // Second pass through a repeated period: every local minute before
  // `repeatEnd` has already occurred today; minutes from `repeatEnd` on have not.
  return s <= e ? s < repeatEnd && e >= repeatEnd : s < repeatEnd || e >= repeatEnd;
}

/** Whether `block` is active at `utcMs` in `timezone`, applying the DST rules above. */
export function isBlockActive(block: ScheduleBlock, utcMs: number, timezone: string): boolean {
  return blockActiveAt(block, localClock(utcMs, timezone));
}

/** Activity ID of the first schedule block active at `utcMs`, if any. */
export function scheduledActivityAt(
  schedule: readonly ScheduleBlock[],
  utcMs: number,
  timezone: string,
): string | null {
  if (schedule.length === 0) return null;
  const clock = localClock(utcMs, timezone);
  for (const block of schedule) {
    if (blockActiveAt(block, clock)) return block.activityId;
  }
  return null;
}
