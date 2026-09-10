import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { today, dayIndex, seedDay, offsetDateString, fmtShort, fmtWeekday } from './dates.js';

const FIXED_NOW = new Date('2026-06-15T12:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('today', () => {
  it('returns the current date as an ISO yyyy-mm-dd string', () => {
    expect(today()).toBe('2026-06-15');
  });
});

describe('dayIndex', () => {
  it('defaults to today when no date is given', () => {
    expect(dayIndex()).toBe(dayIndex(today()));
  });

  it('increases by exactly 1 per calendar day', () => {
    expect(dayIndex('2026-06-16') - dayIndex('2026-06-15')).toBe(1);
  });
});

describe('seedDay', () => {
  it('offsets from now by whole days', () => {
    expect(seedDay(0)).toBe('2026-06-15');
    expect(seedDay(1)).toBe('2026-06-16');
    expect(seedDay(-1)).toBe('2026-06-14');
  });
});

// Phase 36: today()/offsetDateString() used to derive their date string via
// toISOString(), which is ALWAYS UTC by spec -- so for a timezone ahead of
// UTC (like Asia/Kolkata / IST, this app's actual audience, at a constant
// UTC+5:30 with no DST) they'd report YESTERDAY's date for the first ~5.5
// hours of every local day. The sandbox running this suite defaults to UTC
// (confirmed: local offset 0), so the tests above alone can't distinguish
// "uses local components" from "uses UTC components" -- these do, by
// actually switching the process timezone to a UTC-ahead one and picking
// an instant inside that exact danger window.
describe('today / offsetDateString: use the local calendar date, not UTC', () => {
  const originalTZ = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = 'Asia/Kolkata';
  });

  afterEach(() => {
    process.env.TZ = originalTZ;
  });

  it('today() returns the local date even when it differs from the UTC date', () => {
    // 8pm UTC on the 15th = 1:30am IST on the 16th.
    vi.setSystemTime(new Date('2026-06-15T20:00:00.000Z'));
    expect(today()).toBe('2026-06-16');
  });

  it('offsetDateString(0) agrees with today() at that same instant', () => {
    vi.setSystemTime(new Date('2026-06-15T20:00:00.000Z'));
    expect(offsetDateString(0)).toBe('2026-06-16');
    expect(offsetDateString(0)).toBe(today());
  });

  it('offsetDateString offsets from the local date, not the UTC one', () => {
    vi.setSystemTime(new Date('2026-06-15T20:00:00.000Z')); // local: 2026-06-16, 1:30am
    expect(offsetDateString(-1)).toBe('2026-06-15');
    expect(offsetDateString(1)).toBe('2026-06-17');
  });

  it('seedDay is the same local-date-aware offset (used by seedState())', () => {
    vi.setSystemTime(new Date('2026-06-15T20:00:00.000Z'));
    expect(seedDay(0)).toBe('2026-06-16');
  });
});

describe('fmtShort / fmtWeekday', () => {
  it('formats an ISO date as "DD Mon"', () => {
    expect(fmtShort('2026-06-15')).toBe('15 Jun');
  });

  it('formats a Date object as a 3-letter weekday', () => {
    // 2026-06-15 is a Monday.
    expect(fmtWeekday(new Date('2026-06-15T00:00:00'))).toBe('Mon');
  });
});
