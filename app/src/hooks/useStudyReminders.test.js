import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStudyReminders } from './useStudyReminders.js';
import * as notifications from '../lib/notifications.js';

vi.mock('../lib/notifications.js', () => ({
  notificationPermission: vi.fn(() => 'granted'),
  sendNotification: vi.fn()
}));

function baseState(overrides = {}) {
  return {
    remindersEnabled: true,
    reminderTime: '18:00',
    reminderDays: [0, 1, 2, 3, 4, 5, 6],
    endOfDayNudgeEnabled: false,
    endOfDayNudgeTime: '21:00',
    dailyGoalMinutes: 60,
    sessions: [],
    tasks: [],
    cards: {},
    customCards: [],
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// 2026-06-15 is a Monday, included in the default all-week reminderDays.
describe('useStudyReminders: general reminder respects reminderTime', () => {
  it('does not fire before the scheduled time', () => {
    vi.setSystemTime(new Date('2026-06-15T10:00:00'));
    renderHook(({ state }) => useStudyReminders(state), { initialProps: { state: baseState() } });
    expect(notifications.sendNotification).not.toHaveBeenCalled();
  });

  it('fires once the scheduled time has passed, given a real reason', () => {
    vi.setSystemTime(new Date('2026-06-15T19:00:00'));
    renderHook(({ state }) => useStudyReminders(state), { initialProps: { state: baseState() } });
    expect(notifications.sendNotification).toHaveBeenCalledTimes(1);
  });

  it('does not fire a second time later the same day', () => {
    vi.setSystemTime(new Date('2026-06-15T19:00:00'));
    const { rerender } = renderHook(({ state }) => useStudyReminders(state), { initialProps: { state: baseState() } });
    expect(notifications.sendNotification).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5 * 60 * 1000);
    rerender({ state: baseState() });
    expect(notifications.sendNotification).toHaveBeenCalledTimes(1);
  });
});

describe('useStudyReminders: end-of-day nudge is independent of the general reminder', () => {
  function nudgeCalls() {
    return notifications.sendNotification.mock.calls.filter(([, body]) => body.includes("haven't logged"));
  }

  it('does nothing when not enabled', () => {
    vi.setSystemTime(new Date('2026-06-15T22:00:00'));
    renderHook(({ state }) => useStudyReminders(state), { initialProps: { state: baseState({ endOfDayNudgeEnabled: false }) } });
    expect(nudgeCalls()).toHaveLength(0);
  });

  it('does not fire before its own scheduled time even if the general reminder time has passed', () => {
    vi.setSystemTime(new Date('2026-06-15T19:00:00')); // past 18:00 general time, before 21:00 nudge time
    renderHook(({ state }) => useStudyReminders(state), { initialProps: { state: baseState({ endOfDayNudgeEnabled: true }) } });
    expect(nudgeCalls()).toHaveLength(0);
  });

  it('fires once its scheduled time has passed and no minutes are logged today', () => {
    vi.setSystemTime(new Date('2026-06-15T22:00:00'));
    renderHook(({ state }) => useStudyReminders(state), { initialProps: { state: baseState({ endOfDayNudgeEnabled: true }) } });
    expect(nudgeCalls()).toHaveLength(1);
  });

  it('does not fire if the user already logged study time today', () => {
    vi.setSystemTime(new Date('2026-06-15T22:00:00'));
    renderHook(({ state }) => useStudyReminders(state), {
      initialProps: { state: baseState({ endOfDayNudgeEnabled: true, sessions: [{ mins: 10, date: '2026-06-15' }] }) }
    });
    expect(nudgeCalls()).toHaveLength(0);
  });
});
