import React, { createContext, useContext, useMemo } from 'react';
import { useAppState } from './hooks/useAppState.js';
import { useSupabaseMigration } from './hooks/useSupabaseMigration.js';
import { useCloudTasksAndNotes } from './hooks/useCloudTasksAndNotes.js';
import { useCloudStudySessions } from './hooks/useCloudStudySessions.js';
import { useCloudTopicConfidence } from './hooks/useCloudTopicConfidence.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const base = useAppState();

  // Called exactly once, here -- MigrationBanner.jsx reads its result via
  // context (below) instead of calling this hook itself. Two independent
  // instances of this hook for the same user could both pass the
  // migrated_at idempotency check before either finished, and both start
  // migrating concurrently -- calling it from a single place is what
  // prevents that.
  const migration = useSupabaseMigration();

  const cloudActive = (migration.status === 'success' || migration.status === 'already_migrated') && !!migration.userId;

  const cloud = useCloudTasksAndNotes({
    active: cloudActive,
    userId: migration.userId,
    baseState: base.state,
    baseUpdate: base.update,
    baseActions: base.actions
  });

  const cloudSessions = useCloudStudySessions({
    active: cloudActive,
    userId: migration.userId,
    baseSessions: base.state.sessions
  });

  const cloudConfidence = useCloudTopicConfidence({
    active: cloudActive,
    userId: migration.userId,
    baseConfidence: base.state.confidence
  });

  // All cloud hooks report errors into this one slot -- MigrationBanner.jsx
  // shows a single generic "couldn't sync" banner rather than one per
  // resource, so simultaneous failures across tasks/notes, sessions and
  // confidence marks collapse to whichever is present first in this list;
  // dismissing clears all of them. Failures on multiple unrelated resources
  // at once is rare enough that this is a deliberate simplification, not an
  // oversight.
  const cloudError = cloud.error || cloudSessions.error || cloudConfidence.error;
  const clearCloudError = () => { cloud.clearError(); cloudSessions.clearError(); cloudConfidence.clearError(); };

  const value = useMemo(() => ({
    state: { ...base.state, tasks: cloud.tasks, notes: cloud.notes, sessions: cloudSessions.sessions, confidence: cloudConfidence.confidence },
    update: base.update,
    actions: cloudActive
      ? { ...base.actions, ...cloud.actions, ...cloudConfidence.actions }
      : base.actions,
    migration: { ...migration, cloudError, clearCloudError }
  }), [base.state, base.update, base.actions, cloud.tasks, cloud.notes, cloud.actions, cloudSessions.sessions, cloudConfidence.confidence, cloudConfidence.actions, cloudActive, migration, cloudError]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
