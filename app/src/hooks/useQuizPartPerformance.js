import { useEffect, useState } from 'react';
import { fetchQuizPerformanceByPart } from '../lib/cloudData.js';

// Phase 7: read-only, additive, analytics-only data source used directly by
// Dashboard.jsx -- deliberately NOT wired into AppContext.jsx. Nothing else
// in the app needs per-part historical quiz accuracy, and there is no
// local/offline equivalent to fall back to (a logged-out user's s.attempts
// never carries per-question detail, only attempt-level summaries -- see
// fetchQuizPerformanceByPart()'s own comment in cloudData.js), so this
// hook has no write path and nothing to merge into base state.
//
// Failures are swallowed on purpose: this only ever feeds one optional
// annotation on the "Strongest / weakest areas" card (a per-module quiz
// accuracy percentage). A failure here should never surface a global
// "couldn't sync" banner the way a failure loading tasks/notes/sessions
// does -- worst case the annotation just stays absent, identical to a user
// who has no quiz history at all.
export function useQuizPartPerformance({ active, userId }) {
  const [byPart, setByPart] = useState(null);

  useEffect(() => {
    if (!active) { setByPart(null); return; }
    let cancelled = false;
    fetchQuizPerformanceByPart(userId).then(result => {
      if (!cancelled) setByPart(result);
    }).catch(() => {
      if (!cancelled) setByPart(null);
    });
    return () => { cancelled = true; };
  }, [active, userId]);

  return byPart || {};
}
