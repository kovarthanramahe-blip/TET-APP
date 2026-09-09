import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchCustomCards, cloudAddCustomCard, cloudUpdateCustomCard, cloudDeleteCustomCard,
  cloudGradeCustomCard, fetchTopicKeyMaps
} from '../lib/cloudData.js';
import { applySrsGrade } from '../lib/logic.js';

// Phase 6, step 3. Shaped like useCloudTasksAndNotes.js (real per-row CRUD,
// an `actions` object AppContext.jsx spreads over base.actions when cloud
// sync is on) rather than useCloudFlashcardSrs.js (which only hydrates/
// mirrors base.state.cards for the fixed seeded deck and returns no
// actions at all) -- custom cards are genuine user-owned rows, not
// scheduling state layered onto fixed reference data.
//
// baseState/baseUpdate are useAppState.js's own values, passed in the same
// way useCloudTasksAndNotes.js takes them for tasks: addCustomCard() reads
// the customCardFront/Back/Category/TopicId draft fields Flashcards.jsx's
// create form writes to, and clears them via baseUpdate() on success --
// the same shape as addTask()'s relationship to taskDraft/taskPriority/
// taskDue. customCards also falls back to baseState.customCards when not
// loaded/active, the same fallback every other cloud-backed resource in
// this app uses (see useCloudTasksAndNotes.js's `tasks`/`notes`).
//
// gradeCustomCard(id, g) takes a raw SM-2 grade (0-3), matching the LOCAL
// fallback action's signature exactly (useAppState.js's gradeCustomCard
// calls gradeCustomCardState(s, id, g) directly) -- both paths compute the
// identical transition via logic.js's applySrsGrade(), the same pure
// function gradeState() uses for the seeded deck, so the actual math lives
// in exactly one place and can never drift between the cloud and local
// paths, and Flashcards.jsx can call actions.gradeCustomCard(id, g)
// without caring which path is active.
export function useCloudCustomCards({ active, userId, baseState, baseUpdate }) {
  const [customCards, setCustomCards] = useState(null); // null = not loaded yet
  const [error, setError] = useState('');
  // Reference data (level|module|topic <-> topic_id) for resolving each
  // card's optional topic link, fetched once per activation via the same
  // fetchTopicKeyMaps() notes/study_sessions/topic_confidence already share.
  const topicMapsRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setCustomCards(null);
      topicMapsRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const topicMaps = await fetchTopicKeyMaps();
        const rows = await fetchCustomCards(userId, topicMaps.topicIdToKey);
        if (!cancelled) {
          setCustomCards(rows);
          topicMapsRef.current = topicMaps;
          setError('');
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not load your custom flashcards.');
      }
    })();
    return () => { cancelled = true; };
  }, [active, userId]);

  const addCustomCard = useCallback(async () => {
    if (!baseState.customCardFront.trim() || !baseState.customCardBack.trim()) return;
    try {
      const keyToTopicId = topicMapsRef.current?.keyToTopicId || new Map();
      const row = await cloudAddCustomCard(userId, keyToTopicId, {
        front: baseState.customCardFront.trim(), back: baseState.customCardBack.trim(),
        category: baseState.customCardCategory.trim(), topicId: baseState.customCardTopicId
      });
      setCustomCards(prev => [row, ...(prev || [])]);
      baseUpdate({ customCardFront: '', customCardBack: '', customCardCategory: '', customCardTopicId: null });
    } catch (e) {
      setError(e?.message || 'Could not add the flashcard.');
    }
  }, [userId, baseState.customCardFront, baseState.customCardBack, baseState.customCardCategory, baseState.customCardTopicId, baseUpdate]);

  const updateCustomCard = useCallback(async (id, patch) => {
    try {
      const keyToTopicId = topicMapsRef.current?.keyToTopicId || new Map();
      await cloudUpdateCustomCard(userId, keyToTopicId, id, patch);
      setCustomCards(prev => (prev || []).map(c => (c.id === id ? { ...c, ...patch } : c)));
    } catch (e) {
      setError(e?.message || 'Could not update the flashcard.');
    }
  }, [userId]);

  const deleteCustomCard = useCallback(async (id) => {
    try {
      await cloudDeleteCustomCard(userId, id);
      setCustomCards(prev => (prev || []).filter(c => c.id !== id));
    } catch (e) {
      setError(e?.message || 'Could not delete the flashcard.');
    }
  }, [userId]);

  const gradeCustomCard = useCallback(async (id, g) => {
    const current = (customCards || []).find(c => c.id === id);
    if (!current) return;
    const graded = applySrsGrade(current, g);
    // Optimistic, like toggleTask/cloudUpdateTask -- grading is a single,
    // infrequent click, so update local state immediately and report a
    // failure without rolling back (same tradeoff every other action in
    // this app's cloud hooks makes).
    setCustomCards(prev => (prev || []).map(c => (c.id === id ? graded : c)));
    try {
      await cloudGradeCustomCard(userId, id, { ease: graded.ease, interval: graded.interval, reps: graded.reps, due: graded.due });
    } catch (e) {
      setError(e?.message || 'Could not save your review.');
    }
  }, [userId, customCards]);

  return {
    loaded: customCards !== null,
    error,
    clearError: () => setError(''),
    customCards: customCards !== null ? customCards : baseState.customCards,
    actions: { addCustomCard, updateCustomCard, deleteCustomCard, gradeCustomCard }
  };
}
