import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTopicConfidence, cloudSetTopicConfidence } from '../lib/cloudData.js';

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
export function useCloudTopicConfidence({ active, userId, baseConfidence }) {
  const [confidence, setConfidence] = useState(null); // null = not loaded yet
  const [error, setError] = useState('');
  const keyToTopicIdRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setConfidence(null);
      keyToTopicIdRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { confidence: loadedConfidence, keyToTopicId } = await fetchTopicConfidence(userId);
        if (!cancelled) {
          setConfidence(loadedConfidence);
          keyToTopicIdRef.current = keyToTopicId;
          setError('');
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not load your topic confidence marks.');
      }
    })();
    return () => { cancelled = true; };
  }, [active, userId]);

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
