import { useEffect, useRef, useState } from 'react';
import { fetchStudySessions, cloudAddStudySession, cloudDeleteAllStudySessions } from '../lib/cloudData.js';

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
// used for note edits.
//
// A shrink only ever happens one way: "Reset my progress" clears sessions
// to [] in one shot (nothing else in the app removes sessions). Phase 5
// step 2 mirrors that specific shrink-to-empty as a full cloud delete,
// closing the gap the original Phase 3E step 2 write-up disclosed.
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
    const previousLength = lastBaseLength.current;
    const grew = baseSessions.length - previousLength;
    lastBaseLength.current = baseSessions.length;
    if (grew === 0) return; // unchanged

    if (grew < 0) {
      // The only shrink this app produces is Reset my progress clearing
      // sessions to [] in one shot -- nothing removes sessions one at a
      // time. A shrink that isn't all the way to zero can't happen today;
      // if it somehow did, this deliberately does nothing (same as before
      // this change) rather than guess at a partial cloud delete.
      if (baseSessions.length === 0 && previousLength > 0) {
        setSessions([]);
        cloudDeleteAllStudySessions(userId).catch(e => {
          setError(e?.message || 'Could not reset your study sessions.');
        });
      }
      return;
    }

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
