import { useEffect, useRef, useState } from 'react';
import { fetchQuizAttempts, cloudAddQuizAttempt } from '../lib/cloudData.js';

// Phase 3E, step 5: once `active`, this hook becomes the source of truth for
// quiz attempt history, replacing the localStorage-backed list from
// useAppState.js -- the same "watch the local array for growth, mirror new
// entries in the background" shape as useCloudStudySessions.js, for the
// same reason: attempts are created from submitQuizState() inside the
// untouched useAppState.js (both an explicit "Submit test" click and the
// mock-exam timer's automatic auto-submit on timeout), always prepended,
// with no dedicated action to intercept.
//
// The one extra wrinkle: state.attempts itself only ever holds
// {when,mode,correct,total,pct} -- it never carried per-question data. The
// actual questions and answers for the attempt just submitted are still
// sitting in state.quiz/state.answers (Quiz.jsx's own "Answer review" screen
// depends on that staying true through the 'result' stage), so this hook
// reads those at the moment it detects a new attempt to build the
// quiz_attempt_answers rows migrateToSupabase.js deliberately left empty.
//
// Known gap, same category as sessions/confidence: "Reset my progress"
// clears local attempts to [], but that's a shrink, and shrinks are
// ignored here -- unlike flashcard scheduling, there's no "absence means
// default" reading for a historical test result, so clearing cloud history
// on a local reset would be a more destructive, not obviously correct,
// mirror. Deferred along with the others.
export function useCloudQuizAttempts({ active, userId, baseAttempts, baseQuiz, baseAnswers }) {
  const [attempts, setAttempts] = useState(null); // null = not loaded yet
  const [error, setError] = useState('');
  const lastBaseLength = useRef(0);

  useEffect(() => {
    if (!active) {
      setAttempts(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchQuizAttempts(userId);
        if (!cancelled) {
          setAttempts(rows);
          setError('');
          lastBaseLength.current = baseAttempts.length;
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not load your test history.');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, userId]);

  useEffect(() => {
    if (!active || attempts === null) return;
    const grew = baseAttempts.length - lastBaseLength.current;
    lastBaseLength.current = baseAttempts.length;
    if (grew <= 0) return; // unchanged, or shrank (e.g. Reset my progress)

    // Only one quiz can ever be in flight at a time, so grew is always 1 in
    // practice; state.quiz/state.answers reflect only the newest attempt
    // (baseAttempts[0]) regardless. If grew were ever > 1, the older
    // entries in the batch would have no recoverable per-question data --
    // surfaced as an error rather than silently dropped.
    const newest = baseAttempts[0];
    setAttempts(prev => [{ ...newest }, ...(prev || [])]);

    cloudAddQuizAttempt(userId, {
      mode: newest.mode, correct: newest.correct, total: newest.total, pct: newest.pct,
      quiz: baseQuiz || [], answers: baseAnswers || {}
    }).catch(e => {
      setError(e?.message || 'Could not save your test result.');
    });

    if (grew > 1) {
      setError('More than one test result appeared at once -- only the most recent could be saved with its answers.');
    }
  }, [active, attempts, baseAttempts, baseQuiz, baseAnswers, userId]);

  return {
    loaded: attempts !== null,
    error,
    clearError: () => setError(''),
    attempts: attempts !== null ? attempts : baseAttempts
  };
}
