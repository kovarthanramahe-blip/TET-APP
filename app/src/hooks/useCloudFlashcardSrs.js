import { useEffect, useRef, useState } from 'react';
import { fetchFlashcardSrs, cloudSetFlashcardSrs, cloudDeleteAllFlashcardSrs, fetchReviews, cloudSetReviews } from '../lib/cloudData.js';

// Phase 3E, step 4: once `active`, keeps flashcard SRS scheduling in sync
// with Supabase. This one is structurally different from tasks/notes/
// sessions/confidence: gradeState() in logic.js (the SM-2 scheduling math)
// runs entirely inside the untouched useAppState.js, and it computes each
// card's NEXT ease/interval/reps from that same card's CURRENT values in
// base.state.cards. There's no discrete "cloudGrade" action to intercept
// without reimplementing that math a second time here and risking it
// drifting from logic.js's version.
//
// So instead of layering cloud data on top as a parallel copy, this hook
// makes base.state.cards itself the thing that stays in sync: on
// activation it overwrites it with the cloud state via baseUpdate (cloud
// wins on load, per the already-agreed Cloud-primary strategy), then
// watches it afterward and mirrors any local change -- a grade via
// gradeState(), or a full clear via "Reset scheduling" (Flashcards.jsx) or
// "Reset my progress" (resetProgressState) -- back to Supabase in the
// background. Neither Syllabus-style action-override nor Notes-style
// state-override applies here; Flashcards.jsx keeps reading state.cards
// from base.state exactly as it always did.
//
// Known race: a grade made in the brief window between activation and the
// initial cloud fetch resolving is overwritten by that fetch's full
// baseUpdate(). This mirrors the same small loading-window tradeoff already
// accepted for tasks/notes/sessions; a full merge-on-load was considered
// and rejected as unnecessary complexity working against Cloud-primary.
//
// Phase 5, step 6: `reviews` (the flashcard grading counter, feeding the
// Card Shark badge) hydrates and syncs alongside `cards` here rather than
// in useCloudProfileSettings.js -- gradeState() changes both `cards` and
// `reviews` in the exact same state transition, and resetProgressState()
// clears both together too, so treating them as one unit keeps the two
// values from ever hydrating or resetting out of step with each other.
export function useCloudFlashcardSrs({ active, userId, baseCards, baseReviews, baseUpdate }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const lastSyncedCards = useRef(null);
  const lastSyncedReviews = useRef(null);
  const indexToIdRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setLoaded(false);
      lastSyncedCards.current = null;
      lastSyncedReviews.current = null;
      indexToIdRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [{ cards: cloudCards, indexToId }, cloudReviews] = await Promise.all([
          fetchFlashcardSrs(userId),
          fetchReviews(userId)
        ]);
        if (cancelled) return;
        baseUpdate({ cards: cloudCards, reviews: cloudReviews });
        indexToIdRef.current = indexToId;
        // Recorded as already-in-sync *before* the watch effect below can
        // ever see it, so this hydration is never mistaken for a local
        // change needing to be written back out.
        lastSyncedCards.current = cloudCards;
        lastSyncedReviews.current = cloudReviews;
        setError('');
        setLoaded(true);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not load your flashcard scheduling.');
      }
    })();
    return () => { cancelled = true; };
  }, [active, userId, baseUpdate]);

  useEffect(() => {
    if (!active || !loaded) return;
    const prevCards = lastSyncedCards.current || {};
    const nextCards = baseCards || {};
    lastSyncedCards.current = nextCards;

    const prevReviews = lastSyncedReviews.current;
    const nextReviews = baseReviews;
    lastSyncedReviews.current = nextReviews;

    const cardsCleared = Object.keys(nextCards).length === 0 && Object.keys(prevCards).length > 0;
    if (cardsCleared) {
      cloudDeleteAllFlashcardSrs(userId).catch(e => {
        setError(e?.message || 'Could not reset your flashcard scheduling.');
      });
    } else {
      const map = indexToIdRef.current;
      if (map) {
        Object.keys(nextCards).forEach(key => {
          if (nextCards[key] === prevCards[key]) return; // logic.js always produces a new object per changed key
          cloudSetFlashcardSrs(userId, map, Number(key), nextCards[key]).catch(e => {
            setError(e?.message || 'Could not save your flashcard scheduling.');
          });
        });
      }
    }

    // gradeState() increments this by 1 on every grade; resetProgressState()
    // (and Flashcards.jsx's "Reset scheduling", via resetSrs -- though that
    // one leaves reviews untouched, since it only clears cards/cardIndex/
    // cardRevealed) is the only other writer. Checked independently of the
    // cards branch above so a cloud write failure on one never blocks the
    // other.
    if (nextReviews !== prevReviews) {
      cloudSetReviews(userId, nextReviews).catch(e => {
        setError(e?.message || 'Could not save your review count.');
      });
    }
  }, [active, loaded, baseCards, baseReviews, userId]);

  return { loaded, error, clearError: () => setError('') };
}
