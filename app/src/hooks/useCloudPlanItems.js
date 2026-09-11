import { useCallback, useEffect, useState } from 'react';
import { fetchPlanItems, cloudGenerateWeekPlan, cloudUpdatePlanItem, cloudDeletePlanItem } from '../lib/cloudData.js';
import { offsetDateString } from '../lib/dates.js';

// Phase 37. Shaped like useCloudCustomTopics.js: real per-row CRUD, an
// `actions` object AppContext.jsx spreads over base.actions when cloud
// sync is on, and a local-only fallback (baseState.planItems, written by
// generatePlanState()/togglePlanItemState()/deletePlanItemState() in
// logic.js) for a logged-out user. Not touched by "Reset my progress" --
// see the migration's own comment for why.
export function useCloudPlanItems({ active, userId, baseState }) {
  const [planItems, setPlanItems] = useState(null); // null = not loaded yet
  const [error, setError] = useState('');

  useEffect(() => {
    if (!active) {
      setPlanItems(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchPlanItems(userId);
        if (!cancelled) {
          setPlanItems(rows);
          setError('');
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not load your weekly plan.');
      }
    })();
    return () => { cancelled = true; };
  }, [active, userId]);

  const generateWeekPlan = useCallback(async (weakestAreas) => {
    if (!weakestAreas || !weakestAreas.length) return;
    const minutesGoal = Math.max(1, Number(baseState.dailyGoalMinutes) || 60);
    const dates = Array.from({ length: 7 }, (_, i) => offsetDateString(i));
    const items = dates.map((date, i) => ({ date, moduleName: weakestAreas[i % weakestAreas.length].name, minutesGoal }));
    try {
      const rows = await cloudGenerateWeekPlan(userId, dates, items);
      setPlanItems(prev => [...rows, ...(prev || []).filter(p => !dates.includes(p.date))]);
    } catch (e) {
      setError(e?.message || 'Could not generate your weekly plan.');
    }
  }, [userId, baseState.dailyGoalMinutes]);

  const togglePlanItem = useCallback(async (id) => {
    const current = (planItems || []).find(p => p.id === id);
    if (!current) return;
    try {
      const updated = await cloudUpdatePlanItem(userId, id, { done: !current.done });
      setPlanItems(prev => (prev || []).map(p => (p.id === id ? updated : p)));
    } catch (e) {
      setError(e?.message || 'Could not update the plan item.');
    }
  }, [userId, planItems]);

  const deletePlanItem = useCallback(async (id) => {
    try {
      await cloudDeletePlanItem(userId, id);
      setPlanItems(prev => (prev || []).filter(p => p.id !== id));
    } catch (e) {
      setError(e?.message || 'Could not delete the plan item.');
    }
  }, [userId]);

  return {
    loaded: planItems !== null,
    error,
    clearError: () => setError(''),
    planItems: planItems !== null ? planItems : baseState.planItems,
    actions: { generateWeekPlan, togglePlanItem, deletePlanItem }
  };
}
