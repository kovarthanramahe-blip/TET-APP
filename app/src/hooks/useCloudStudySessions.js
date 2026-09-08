import { useEffect, useRef, useState } from 'react';
import { fetchStudySessions, cloudAddStudySession } from '../lib/cloudData.js';

// Phase 3E, step 2: once `active`, this hook becomes the source of truth for
// study sessions, replacing the localStorage-backed list from
// useAppState.js -- but unlike tasks/notes, it does this WITHOUT overriding
// any action. Sessions are append-only (no edit/delete UI, no local id) and
// created from three different places inside the untouched useAppState.js:
// the manual "Log a session by hand" button, the "Skip phase" button, and
// the 1-second timer tick completing a focus phase automatically. All three
// funnel through the same logSessionState(), which always prepends the new
// entry to `state.sessions`.
//
// Rather than reimplement or intercept those three call sites, this hook
// watches the base (localStorage-backed) sessions array baseSessions and
// diffs its length against what it saw last time. Any growth means new
// entries were prepended; it mirrors those into the cloud-backed list
// immediately (so the cloud-driven Dashboard/StudySessions stats update in
// lockstep with what the timer/log button just did) and fire-and-forgets
// the actual Supabase insert, the same optimistic-write tradeoff already
// used for note edits. A shrink (only "Reset my progress" does this today,
// clearing sessions to []) is not mirrored to the cloud -- see the Phase 3E
// step 2 write-up for why that's a known, disclosed gap rather than a bug.
export function useCloudStudySessions({ active, userId, baseSessions }) {
  const [sessions, setSessions] = useState(null); // null = not loaded yet
  const [error, setError] = useState('');
  const lastBaseLength = useRef(0);

  useEffect(() => {
    if (!active) {
      setSessions(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchStudySessions(userId);
        if (!cancelled) {
          setSessions(rows);
          setError('');
          // Baseline against the local array *as of now* -- anything
          // already in it (including sessions from before this login, e.g.
          // already handled by the one-time migration) is not "new".
          lastBaseLength.current = baseSessions.length;
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not load your study sessions.');
      }
    })();
    return () => { cancelled = true; };
    // baseSessions is intentionally not a dependency here -- this effect
    // should only (re-)run the initial fetch when cloud sync turns on/off
    // or the user changes, not every time a session is logged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, userId]);

  useEffect(() => {
    if (!active || sessions === null) return;
    const grew = baseSessions.length - lastBaseLength.current;
    lastBaseLength.current = baseSessions.length;
    if (grew <= 0) return; // unchanged, or shrank (e.g. Reset my progress)

    // logSessionState() always prepends, so the newly added entries are
    // exactly the first `grew` items, most-recently-added first.
    const added = baseSessions.slice(0, grew);
    setSessions(prev => [...added, ...(prev || [])]);

    // Persist oldest-of-the-batch first so created_at ordering in Supabase
    // matches the order they actually happened in.
    [...added].reverse().forEach(session => {
      cloudAddStudySession(userId, session).catch(e => {
        setError(e?.message || 'Could not save a study session.');
      });
    });
  }, [active, userId, baseSessions, sessions]);

  return {
    loaded: sessions !== null,
    error,
    clearError: () => setError(''),
    sessions: sessions !== null ? sessions : baseSessions
  };
}
