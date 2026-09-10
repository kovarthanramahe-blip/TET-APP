import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { today, dayIndex, seedDay, fmtShort, fmtWeekday } from './dates.js';

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

describe('fmtShort / fmtWeekday', () => {
  it('formats an ISO date as "DD Mon"', () => {
    expect(fmtShort('2026-06-15')).toBe('15 Jun');
  });

  it('formats a Date object as a 3-letter weekday', () => {
    // 2026-06-15 is a Monday.
    expect(fmtWeekday(new Date('2026-06-15T00:00:00'))).toBe('Mon');
  });
});
