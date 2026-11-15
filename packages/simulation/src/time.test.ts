import { describe, expect, it } from 'vitest';
import {
  MS_PER_HOUR,
  isBlockActive,
  isValidTimeZone,
  localMinuteOfDay,
  timeZoneOffsetMs,
} from './index.ts';

const NY = 'America/New_York';
const MINUTE = 60_000;

describe('time zones', () => {
  it('validates IANA names', () => {
    expect(isValidTimeZone('Europe/Madrid')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });

  it('computes offsets and local minutes', () => {
    const winter = Date.UTC(2026, 0, 15, 12, 0);
    expect(timeZoneOffsetMs(winter, 'Europe/Madrid')).toBe(MS_PER_HOUR);
    expect(localMinuteOfDay(winter, 'Europe/Madrid')).toBe(13 * 60);
    expect(localMinuteOfDay(winter, NY)).toBe(7 * 60);
  });

  it('starts blocks in skipped local time at the next valid minute', () => {
    // 2026-03-08: New York clocks jump from 02:00 EST to 03:00 EDT at 07:00 UTC.
    const block = { startMinute: 2 * 60 + 30, endMinute: 4 * 60, activityId: 'x' };
    expect(isBlockActive(block, Date.UTC(2026, 2, 8, 6, 59), NY)).toBe(false);
    expect(isBlockActive(block, Date.UTC(2026, 2, 8, 7, 0), NY)).toBe(true);
  });

  it('uses the first occurrence of repeated local time', () => {
    // 2026-11-01: New York clocks fall back from 02:00 EDT to 01:00 EST at 06:00 UTC.
    const inside = { startMinute: 60 + 30, endMinute: 60 + 45, activityId: 'x' };
    expect(isBlockActive(inside, Date.UTC(2026, 10, 1, 5, 35), NY)).toBe(true);
    expect(isBlockActive(inside, Date.UTC(2026, 10, 1, 6, 35), NY)).toBe(false);

    // A block spanning the whole repeated hour stays active through both passes.
    const spanning = { startMinute: 0, endMinute: 3 * 60, activityId: 'x' };
    for (let t = Date.UTC(2026, 10, 1, 4, 0); t < Date.UTC(2026, 10, 1, 8, 0); t += 15 * MINUTE) {
      expect(isBlockActive(spanning, t, NY)).toBe(true);
    }

    // A block that starts in the repeated hour does not restart in the second pass,
    // but stays active if it had not yet ended.
    const late = { startMinute: 60 + 50, endMinute: 2 * 60 + 30, activityId: 'x' };
    expect(isBlockActive(late, Date.UTC(2026, 10, 1, 5, 55), NY)).toBe(true);
    expect(isBlockActive(late, Date.UTC(2026, 10, 1, 6, 10), NY)).toBe(true);

    // A wrapping night block remains active across the repeated hour.
    const night = { startMinute: 23 * 60, endMinute: 7 * 60, activityId: 'x' };
    expect(isBlockActive(night, Date.UTC(2026, 10, 1, 6, 30), NY)).toBe(true);
  });
});
