import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import * as cloudData from '../lib/cloudData.js';
import { useCloudPlanItems } from './useCloudPlanItems.js';
import { offsetDateString } from '../lib/dates.js';

vi.mock('../lib/cloudData.js', () => ({
  fetchPlanItems: vi.fn(),
  cloudGenerateWeekPlan: vi.fn(),
  cloudUpdatePlanItem: vi.fn(),
  cloudDeletePlanItem: vi.fn()
}));

function setup(baseStateOverrides = {}) {
  const baseState = { planItems: [], dailyGoalMinutes: 60, ...baseStateOverrides };
  const utils = renderHook(() => useCloudPlanItems({ active: true, userId: 'user-1', baseState }));
  return { ...utils, baseState };
}

beforeEach(() => {
  vi.clearAllMocks();
  // A stale item outside the 7-day window generateWeekPlan regenerates --
  // it should survive untouched, unlike an item inside that window.
  cloudData.fetchPlanItems.mockResolvedValue([{ id: 'p1', date: '2020-01-01', moduleName: 'General Studies', minutesGoal: 60, done: false }]);
});

describe('useCloudPlanItems: generateWeekPlan', () => {
  it('rotates through weakestAreas across 7 upcoming days using dailyGoalMinutes, and prepends the returned rows', async () => {
    const { result } = setup({ dailyGoalMinutes: 45 });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    const returnedRows = Array.from({ length: 7 }, (_, i) => ({
      id: 'new' + i, date: offsetDateString(i), moduleName: 'Child Development & Pedagogy', minutesGoal: 45, done: false
    }));
    cloudData.cloudGenerateWeekPlan.mockResolvedValue(returnedRows);

    await act(async () => {
      await result.current.actions.generateWeekPlan([{ name: 'Child Development & Pedagogy' }]);
    });

    expect(cloudData.cloudGenerateWeekPlan).toHaveBeenCalledTimes(1);
    const [userId, dates, items] = cloudData.cloudGenerateWeekPlan.mock.calls[0];
    expect(userId).toBe('user-1');
    expect(dates).toHaveLength(7);
    expect(items.every(it => it.moduleName === 'Child Development & Pedagogy' && it.minutesGoal === 45)).toBe(true);
    expect(result.current.planItems.map(p => p.id)).toEqual(['new0', 'new1', 'new2', 'new3', 'new4', 'new5', 'new6', 'p1']);
  });

  it('is a no-op when there are no weakest areas', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      await result.current.actions.generateWeekPlan([]);
    });

    expect(cloudData.cloudGenerateWeekPlan).not.toHaveBeenCalled();
  });

  it('surfaces a failure without losing existing plan items', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    cloudData.cloudGenerateWeekPlan.mockRejectedValue(new Error('network error'));

    await act(async () => {
      await result.current.actions.generateWeekPlan([{ name: 'General Studies' }]);
    });

    expect(result.current.error).toMatch(/network error/);
    expect(result.current.planItems.map(p => p.id)).toEqual(['p1']);
  });
});

describe('useCloudPlanItems: togglePlanItem / deletePlanItem', () => {
  it('togglePlanItem flips only the matching item and applies the server response', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    cloudData.cloudUpdatePlanItem.mockResolvedValue({ id: 'p1', date: offsetDateString(0), moduleName: 'General Studies', minutesGoal: 60, done: true });

    await act(async () => {
      await result.current.actions.togglePlanItem('p1');
    });

    expect(cloudData.cloudUpdatePlanItem).toHaveBeenCalledWith('user-1', 'p1', { done: true });
    expect(result.current.planItems.find(p => p.id === 'p1').done).toBe(true);
  });

  it('deletePlanItem removes the item on success', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    cloudData.cloudDeletePlanItem.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.actions.deletePlanItem('p1');
    });

    expect(result.current.planItems).toEqual([]);
  });

  it('surfaces a failure and keeps the item when delete fails', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    cloudData.cloudDeletePlanItem.mockRejectedValue(new Error('network error'));

    await act(async () => {
      await result.current.actions.deletePlanItem('p1');
    });

    expect(result.current.error).toMatch(/network error/);
    expect(result.current.planItems.map(p => p.id)).toEqual(['p1']);
  });
});

describe('useCloudPlanItems: local fallback', () => {
  it('falls back to baseState.planItems when not active', () => {
    const baseState = { planItems: [{ id: 'local1' }], dailyGoalMinutes: 60 };
    const { result } = renderHook(() => useCloudPlanItems({ active: false, userId: null, baseState }));
    expect(result.current.loaded).toBe(false);
    expect(result.current.planItems).toEqual([{ id: 'local1' }]);
  });
});
