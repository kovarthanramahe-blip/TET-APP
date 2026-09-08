import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useAppState } from './hooks/useAppState.js';
import { useSupabaseMigration } from './hooks/useSupabaseMigration.js';
import { useCloudTasksAndNotes } from './hooks/useCloudTasksAndNotes.js';
import { useCloudStudySessions } from './hooks/useCloudStudySessions.js';
import { useCloudTopicConfidence } from './hooks/useCloudTopicConfidence.js';
import { useCloudFlashcardSrs } from './hooks/useCloudFlashcardSrs.js';
import { useCloudQuizAttempts } from './hooks/useCloudQuizAttempts.js';
import { useCloudProfileSettings } from './hooks/useCloudProfileSettings.js';
import { clearStoredState } from './lib/dataStore.js';
import { seedState } from './lib/logic.js';

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

  // Cross-user localStorage contamination fix: on a shared device, an
  // explicit logout previously left this device's single global
  // localStorage entry (and the in-memory base.state built from it)
  // populated with the just-logged-out user's real data. If a different
  // user then logged in on the same page without a refresh, the one-time
  // migration engine would read that leftover data via readStoredState()
  // and migrate it into the new user's own Supabase account.
  //
  // previousUserId only ever transitions real-id -> null on an actual
  // logout (it starts at null on a fresh load, and stays null through
  // useAuth's initial session check and for any anonymous session, so
  // this never fires just because no one is logged in yet). Only that
  // specific transition clears storage and resets state -- a same user
  // staying logged in, or the app merely loading, never matches.
  const previousUserId = useRef(null);
  useEffect(() => {
    const currentUserId = migration.userId;
    if (previousUserId.current && !currentUserId) {
      // Clear localStorage FIRST, synchronously. useAppState.js's
      // persistence effect saves on every state change, including the
      // 1-second timer tick -- if the reset below landed first, an
      // active timer could re-save the old user's still-in-memory state
      // back into storage before this clear ever ran.
      clearStoredState();
      base.update(() => seedState());
    }
    previousUserId.current = currentUserId;
  }, [migration.userId, base.update]);

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

  // No state/actions override for this one -- see useCloudFlashcardSrs.js
  // for why: it keeps base.state.cards itself in sync with Supabase instead
  // of layering cloud data on top, so Flashcards.jsx's grading action stays
  // completely untouched and state.cards flows through from base.state as
  // it always has (below).
  const cloudFlashcards = useCloudFlashcardSrs({
    active: cloudActive,
    userId: migration.userId,
    baseCards: base.state.cards,
    baseReviews: base.state.reviews,
    baseUpdate: base.update
  });

  const cloudQuizAttempts = useCloudQuizAttempts({
    active: cloudActive,
    userId: migration.userId,
    baseAttempts: base.state.attempts,
    baseQuiz: base.state.quiz,
    baseAnswers: base.state.answers
  });

  // No state/actions override for this one either, same reasoning as
  // flashcard scheduling above: it hydrates/mirrors base.state's five
  // settings fields directly, so toggleTheme/setLevel/setPomodoroMinutes/
  // setBreakMinutes/setShowQuotes in useAppState.js stay untouched and
  // these fields flow through from base.state as they always have.
  const cloudProfileSettings = useCloudProfileSettings({
    active: cloudActive,
    userId: migration.userId,
    baseSettings: {
      theme: base.state.theme,
      level: base.state.level,
      pomodoroMinutes: base.state.pomodoroMinutes,
      breakMinutes: base.state.breakMinutes,
      showQuotes: base.state.showQuotes
    },
    baseUpdate: base.update
  });

  // All cloud hooks report errors into this one slot -- MigrationBanner.jsx
  // shows a single generic "couldn't sync" banner rather than one per
  // resource, so simultaneous failures across tasks/notes, sessions,
  // confidence marks, flashcard scheduling, quiz attempts and profile
  // settings collapse to whichever is present first in this list;
  // dismissing clears all of them. Failures on multiple unrelated resources
  // at once is rare enough that this is a deliberate simplification, not an
  // oversight.
  const cloudError = cloud.error || cloudSessions.error || cloudConfidence.error || cloudFlashcards.error
    || cloudQuizAttempts.error || cloudProfileSettings.error;
  const clearCloudError = () => {
    cloud.clearError(); cloudSessions.clearError(); cloudConfidence.clearError();
    cloudFlashcards.clearError(); cloudQuizAttempts.clearError(); cloudProfileSettings.clearError();
  };

  const value = useMemo(() => ({
    state: {
      ...base.state, tasks: cloud.tasks, notes: cloud.notes, sessions: cloudSessions.sessions,
      confidence: cloudConfidence.confidence, attempts: cloudQuizAttempts.attempts
    },
    update: base.update,
    actions: cloudActive
      ? { ...base.actions, ...cloud.actions, ...cloudConfidence.actions }
      : base.actions,
    migration: { ...migration, cloudError, clearCloudError }
  }), [base.state, base.update, base.actions, cloud.tasks, cloud.notes, cloud.actions, cloudSessions.sessions, cloudConfidence.confidence, cloudConfidence.actions, cloudQuizAttempts.attempts, cloudActive, migration, cloudError]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
