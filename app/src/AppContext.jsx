import React, { createContext, useContext, useMemo } from 'react';
import { useAppState } from './hooks/useAppState.js';
import { useSupabaseMigration } from './hooks/useSupabaseMigration.js';
import { useCloudTasksAndNotes } from './hooks/useCloudTasksAndNotes.js';

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

  const value = useMemo(() => ({
    state: { ...base.state, tasks: cloud.tasks, notes: cloud.notes },
    update: base.update,
    actions: cloudActive
      ? { ...base.actions, ...cloud.actions }
      : base.actions,
    migration: { ...migration, cloudError: cloud.error, clearCloudError: cloud.clearError }
  }), [base.state, base.update, base.actions, cloud.tasks, cloud.notes, cloud.actions, cloud.error, cloud.clearError, cloudActive, migration]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
