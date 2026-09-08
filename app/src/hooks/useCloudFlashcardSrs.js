import { useEffect, useRef, useState } from 'react';
import { fetchFlashcardSrs, cloudSetFlashcardSrs, cloudDeleteAllFlashcardSrs } from '../lib/cloudData.js';

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
export function useCloudFlashcardSrs({ active, userId, baseCards, baseUpdate }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const lastSyncedCards = useRef(null);
  const indexToIdRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setLoaded(false);
      lastSyncedCards.current = null;
      indexToIdRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { cards: cloudCards, indexToId } = await fetchFlashcardSrs(userId);
        if (cancelled) return;
        baseUpdate({ cards: cloudCards });
        indexToIdRef.current = indexToId;
        lastSyncedCards.current = cloudCards;
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
    const prev = lastSyncedCards.current || {};
    const next = baseCards || {};
    lastSyncedCards.current = next;

    if (Object.keys(next).length === 0 && Object.keys(prev).length > 0) {
      cloudDeleteAllFlashcardSrs(userId).catch(e => {
        setError(e?.message || 'Could not reset your flashcard scheduling.');
      });
      return;
    }

    const map = indexToIdRef.current;
    if (!map) return;
    Object.keys(next).forEach(key => {
      if (next[key] === prev[key]) return; // logic.js always produces a new object per changed key
      cloudSetFlashcardSrs(userId, map, Number(key), next[key]).catch(e => {
        setError(e?.message || 'Could not save your flashcard scheduling.');
      });
    });
  }, [active, loaded, baseCards, userId]);

  return { loaded, error, clearError: () => setError('') };
}
