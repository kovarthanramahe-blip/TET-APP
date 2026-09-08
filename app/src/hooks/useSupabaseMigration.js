import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth.js';
import { migrateLocalStorageToSupabase } from '../lib/migrateToSupabase.js';

// Watches useAuth().user for the null -> authenticated transition and runs
// the one-time localStorage -> Supabase migration exactly once per login.
// This hook only *observes* auth state -- it never creates a second
// authentication mechanism, and it never touches localStorage itself
// (migrateLocalStorageToSupabase reads it; nothing here writes or clears
// it). migrateLocalStorageToSupabase's own profiles.migrated_at check
// remains the single source of truth for "has this account already been
// migrated" -- this hook only decides *when to ask*, never *whether it's
// allowed*.
export function useSupabaseMigration() {
  const { user } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | migrating | success | already_migrated | error
  const [error, setError] = useState('');

  // Guards against calling migrate more than once for the same login.
  // Reset to null on logout, so a later login -- even by the same user --
  // is treated as a fresh attempt. This is also what makes "log out, log
  // back in" work as a manual retry path if a previous attempt failed.
  const attemptedForUserId = useRef(null);

  const run = useCallback(async (activeUser) => {
    setStatus('migrating');
    setError('');
    try {
      const result = await migrateLocalStorageToSupabase(activeUser);
      setStatus(result.status === 'already_migrated' ? 'already_migrated' : 'success');
    } catch (e) {
      // Never swallow this -- surface it so the caller can display it.
      setStatus('error');
      setError(e?.message || 'Migration failed for an unknown reason.');
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      attemptedForUserId.current = null;
      return;
    }
    if (attemptedForUserId.current === user.id) return; // already attempted this login
    attemptedForUserId.current = user.id;
    run(user);
  }, [user?.id, run]);

  // Manual retry (e.g. from a "Retry" button) for when the automatic
  // attempt failed and the user doesn't want to log out and back in.
  const retry = useCallback(() => {
    if (!user?.id) return;
    attemptedForUserId.current = user.id;
    run(user);
  }, [user, run]);

  return { status, error, retry };
}
