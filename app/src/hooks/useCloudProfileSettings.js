import { useEffect, useRef, useState } from 'react';
import { fetchProfileSettings, cloudUpdateProfileSettings } from '../lib/cloudData.js';
import { phaseLength } from '../lib/logic.js';

const SETTINGS_KEYS = ['theme', 'level', 'pomodoroMinutes', 'breakMinutes', 'showQuotes'];
const DEBOUNCED_KEYS = new Set(['pomodoroMinutes', 'breakMinutes']);
const DEBOUNCE_MS = 600; // matches the debounce already used for note edits (Step 1)

// Phase 3E, step 6: once `active`, keeps the five profile/settings fields
// (theme, level, pomodoroMinutes, breakMinutes, showQuotes) in sync with
// profiles. No state/actions override -- like flashcard SRS state in step
// 4, this hook hydrates base.state directly (cloud wins on load, per the
// already-agreed Cloud-primary strategy) and then watches it for local
// changes to mirror back, so none of the existing setLevel/toggleTheme/
// setPomodoroMinutes/setBreakMinutes/setShowQuotes actions in
// useAppState.js need to change, and every other field on state flows
// through untouched.
//
// pomodoroMinutes/breakMinutes are driven by per-keystroke number-input
// onChange (StudySessions.jsx), so -- exactly like Notes text edits in step
// 1 -- writing through on every change would fire a request per digit
// typed; those two are debounced per key. theme/level/showQuotes are
// discrete clicks and sync immediately, matching toggleTask/cycleConfidence
// elsewhere in this phase.
export function useCloudProfileSettings({ active, userId, baseSettings, baseUpdate }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const lastSynced = useRef(null);
  const pendingTimers = useRef({});

  useEffect(() => {
    if (!active) {
      setLoaded(false);
      lastSynced.current = null;
      Object.values(pendingTimers.current).forEach(clearTimeout);
      pendingTimers.current = {};
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const cloudSettings = await fetchProfileSettings(userId);
        if (cancelled) return;

        // Cloud is authoritative for the five settings fields on load.
        // Nothing else on state is touched here -- s is spread first, and
        // only remaining (a local-only timer field, never cloud-synced) is
        // conditionally recomputed, using the exact same guard
        // setPomodoroMinutes()/setBreakMinutes() already use: only when
        // that phase is the current one and not actively running. This is
        // not new timer behavior, just that same guard applied to a
        // hydration write instead of a user click.
        baseUpdate(s => {
          const next = { ...s, ...cloudSettings };
          if (s.phase === 'focus' && !s.running) return { ...next, remaining: phaseLength(next, 'focus') };
          if (s.phase === 'break' && !s.running) return { ...next, remaining: phaseLength(next, 'break') };
          return next;
        });

        // Recorded as already-in-sync *before* the watch effect below can
        // ever see it, so the values this hydration just wrote are never
        // mistaken for a local change needing to be written back out.
        lastSynced.current = cloudSettings;
        setError('');
        setLoaded(true);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not load your settings.');
      }
    })();
    return () => { cancelled = true; };
  }, [active, userId, baseUpdate]);

  useEffect(() => {
    if (!active || !loaded) return;
    const prev = lastSynced.current || {};
    // Snapshot immediately (before any async write resolves) so a second
    // rapid change is diffed against this one, not against a value that's
    // still in flight -- the same immediate-tracking approach used for
    // sessions/flashcards in earlier steps.
    lastSynced.current = SETTINGS_KEYS.reduce((acc, key) => ({ ...acc, [key]: baseSettings[key] }), {});

    for (const key of SETTINGS_KEYS) {
      if (baseSettings[key] === prev[key]) continue;
      const value = baseSettings[key];

      if (DEBOUNCED_KEYS.has(key)) {
        if (pendingTimers.current[key]) clearTimeout(pendingTimers.current[key]);
        pendingTimers.current[key] = setTimeout(() => {
          delete pendingTimers.current[key];
          cloudUpdateProfileSettings(userId, { [key]: value }).catch(e => {
            setError(e?.message || 'Could not save your settings.');
          });
        }, DEBOUNCE_MS);
      } else {
        cloudUpdateProfileSettings(userId, { [key]: value }).catch(e => {
          setError(e?.message || 'Could not save your settings.');
        });
      }
    }
  }, [active, loaded, baseSettings, userId]);

  return { loaded, error, clearError: () => setError('') };
}
