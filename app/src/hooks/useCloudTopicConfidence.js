import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTopicConfidence, cloudSetTopicConfidence, cloudDeleteAllTopicConfidence } from '../lib/cloudData.js';

// Phase 3E, step 3: once `active`, this hook becomes the source of truth for
// topic confidence marks, replacing the localStorage-backed `confidence`
// object from useAppState.js. Syllabus.jsx's only interaction is a single
// click that cycles a mark through 0/1/2/3 (cycleConfidence) -- a discrete,
// infrequent action like addTask/toggleTask, so it follows the same
// await-then-update pattern: send the write, then reflect it once Supabase
// confirms. (Same accepted race as toggleTask: a rapid double-click on one
// dot before the first write resolves reads a stale `current` value for the
// second click -- unchanged behavior from the tasks precedent, not a new
// risk introduced here.)
//
// Phase 5, step 3: cycleConfidence fully replaces the base action while
// active, so base.state.confidence is never touched by anything except
// "Reset my progress" (resetProgressState() clearing it to {}) -- the only
// other write path is intercepted entirely. That makes any change to
// baseConfidence while active a reliable Reset signal, watched below and
// mirrored as a full cloud delete, closing the gap the original Phase 3E
// step 3 write-up disclosed.
export function useCloudTopicConfidence({ active, userId, baseConfidence }) {
  const [confidence, setConfidence] = useState(null); // null = not loaded yet
  const [error, setError] = useState('');
  const keyToTopicIdRef = useRef(null);
  const lastBaseConfidenceRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setConfidence(null);
      keyToTopicIdRef.current = null;
      lastBaseConfidenceRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { confidence: loadedConfidence, keyToTopicId } = await fetchTopicConfidence(userId);
        if (!cancelled) {
          setConfidence(loadedConfidence);
          keyToTopicIdRef.current = keyToTopicId;
          // Baseline against the local object *as of now* -- anything
          // already in it (e.g. from the one-time migration) is not a
          // reset just because it doesn't match what was fetched.
          lastBaseConfidenceRef.current = baseConfidence;
          setError('');
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not load your topic confidence marks.');
      }
    })();
    return () => { cancelled = true; };
    // baseConfidence is intentionally not a dependency here -- this effect
    // should only (re-)run the initial fetch when cloud sync turns on/off
    // or the user changes, not every time it's baselined below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, userId]);

  useEffect(() => {
    if (!active || confidence === null) return;
    const prev = lastBaseConfidenceRef.current || {};
    lastBaseConfidenceRef.current = baseConfidence;

    // The only way baseConfidence can change while active is Reset my
    // progress clearing it to {} in one shot (cycleConfidence is fully
    // intercepted above). A non-empty -> empty transition is exactly that.
    const hadMarks = Object.keys(prev).length > 0;
    const nowEmpty = Object.keys(baseConfidence || {}).length === 0;
    if (hadMarks && nowEmpty) {
      setConfidence({});
      cloudDeleteAllTopicConfidence(userId).catch(e => {
        setError(e?.message || 'Could not reset your topic confidence marks.');
      });
    }
  }, [active, confidence, baseConfidence, userId]);

  const cycleConfidence = useCallback(async (key, current) => {
    const map = keyToTopicIdRef.current;
    if (!map) return; // reference data hasn't loaded yet -- ignore rather than write against nothing
    const next = (current + 1) % 4;
    try {
      await cloudSetTopicConfidence(userId, map, key, next);
      setConfidence(prev => ({ ...(prev || {}), [key]: next }));
    } catch (e) {
      setError(e?.message || 'Could not save that confidence mark.');
    }
  }, [userId]);

  const loaded = confidence !== null;

  return {
    loaded,
    error,
    clearError: () => setError(''),
    confidence: loaded ? confidence : baseConfidence,
    actions: { cycleConfidence }
  };
}
