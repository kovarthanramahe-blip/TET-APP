import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppState } from './useAppState.js';

// Phase 32: the 1s tick used to decrement remaining/mockLeft by a flat 1
// second per firing. Browsers throttle (or fully suspend) setInterval in a
// backgrounded tab or a locked phone screen -- exactly where a 25-minute
// focus timer or a timed mock exam is likely to be left running -- so a
// fixed decrement silently fell behind real elapsed time whenever a tick
// was delayed or skipped. Real-browser testing can't reliably reproduce
// browser throttling on demand, but Date.now() can be controlled directly:
// fake only setInterval/clearInterval (not Date) and drive Date.now() via
// a spy, so a single interval firing can be made to observe a large real
// time jump -- simulating exactly what a throttled tab looks like from
// this effect's point of view.
describe('useAppState: timer tick accounts for real elapsed time, not a fixed 1 second', () => {
  let nowValue;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    nowValue = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => nowValue);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('decrements remaining by the real elapsed time per tick, not a fixed 1 second', () => {
    const { result } = renderHook(() => useAppState());
    act(() => {
      result.current.update({ running: true, remaining: 100 });
    });

    // Simulates a throttled/backgrounded tab: 42 real seconds pass before
    // the interval's next (single) firing, instead of the normal ~1.
    nowValue += 42_000;
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.state.remaining).toBe(58); // 100 - 42, not 100 - 1
  });

  it('a jump large enough to cross zero still completes the phase exactly once', () => {
    const { result } = renderHook(() => useAppState());
    act(() => {
      result.current.update({ running: true, remaining: 10, phase: 'focus', cycles: 0 });
    });

    nowValue += 40_000; // far more than the 10 seconds remaining
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const s = result.current.state;
    expect(s.phase).toBe('break'); // finishPhaseState(): focus -> break
    expect(s.cycles).toBe(1);
    expect(s.running).toBe(true); // finishPhaseState() starts the break running
  });

  it('the mock exam clock also accounts for real elapsed time and submits once it crosses zero', () => {
    const { result } = renderHook(() => useAppState());
    act(() => {
      result.current.update({ quizStage: 'active', quizMode: 'Mock exam', mockLeft: 10, quiz: [] });
    });

    nowValue += 40_000;
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.state.quizStage).toBe('result');
    expect(result.current.state.mockLeft).toBe(0);
  });

  it('does not decrement remaining while paused', () => {
    const { result } = renderHook(() => useAppState());
    act(() => {
      result.current.update({ running: false, remaining: 50 });
    });

    nowValue += 5000;
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.state.remaining).toBe(50);
  });

  it('under normal (unthrottled) ticking, still decrements by 1 second per tick', () => {
    const { result } = renderHook(() => useAppState());
    act(() => {
      result.current.update({ running: true, remaining: 10 });
    });

    for (let i = 0; i < 3; i++) {
      nowValue += 1000;
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }

    expect(result.current.state.remaining).toBe(7);
  });
});

// Phase 35: saveState() (and the localStorage write underneath it) can
// fail -- quota exceeded, private-browsing storage restrictions, etc. --
// and used to fail completely silently, with nothing telling the user
// their edits had stopped being persisted. `saveFailed` is the hook's own
// signal for "did the last save actually work", read by StorageWarning.jsx.
describe('useAppState: reports whether persistence is actually working', () => {
  let originalSetItem;

  beforeEach(() => {
    localStorage.clear();
    originalSetItem = Storage.prototype.setItem;
  });

  afterEach(() => {
    Storage.prototype.setItem = originalSetItem;
  });

  it('stays false under normal conditions', () => {
    const { result } = renderHook(() => useAppState());
    expect(result.current.saveFailed).toBe(false);
  });

  it('becomes true when localStorage.setItem throws (e.g. quota exceeded)', () => {
    Storage.prototype.setItem = () => { throw new DOMException('QuotaExceededError'); };
    const { result } = renderHook(() => useAppState());
    expect(result.current.saveFailed).toBe(true);
  });

  it('recovers to false once a subsequent save succeeds', () => {
    Storage.prototype.setItem = () => { throw new DOMException('QuotaExceededError'); };
    const { result } = renderHook(() => useAppState());
    expect(result.current.saveFailed).toBe(true);

    Storage.prototype.setItem = originalSetItem;
    act(() => {
      result.current.update({ theme: 'dark' });
    });
    expect(result.current.saveFailed).toBe(false);
  });
});
