import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchCustomCards, cloudAddCustomCard, cloudUpdateCustomCard, cloudDeleteCustomCard,
  cloudGradeCustomCard, fetchTopicKeyMaps
} from '../lib/cloudData.js';

// Phase 6, step 3 (cloud layer only -- this file is not wired into
// AppContext.jsx yet, and there is no local/offline fallback for custom
// cards yet either; both are later steps). Once active, this hook owns the
// full custom-flashcards resource: unlike useCloudFlashcardSrs.js (which
// only hydrates/mirrors base.state.cards for the fixed seeded deck, with no
// actions of its own), custom cards are genuine per-user rows with real
// CRUD, so this hook is shaped like useCloudTasksAndNotes.js instead --
// it owns the array and returns an `actions` object.
//
// Grading: gradeCustomCard(id, srsPatch) takes the ALREADY-COMPUTED new
// {ease, interval, reps, due} values rather than a raw grade 0-3. The SM-2
// transition math itself belongs in exactly one place (logic.js) -- a
// parallel function to gradeState() for custom cards is added in a later
// step, once logic.js is in scope. This hook only ever persists whatever
// numbers it's handed and mirrors them into local state optimistically,
// the same "trust the caller's math" shape cloudSetFlashcardSrs() +
// useCloudFlashcardSrs.js already use for the seeded deck.
export function useCloudCustomCards({ active, userId }) {
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

  const addCustomCard = useCallback(async ({ front, back, category, topicId }) => {
    if (!front?.trim() || !back?.trim()) return;
    try {
      const keyToTopicId = topicMapsRef.current?.keyToTopicId || new Map();
      const row = await cloudAddCustomCard(userId, keyToTopicId, {
        front: front.trim(), back: back.trim(), category: (category || '').trim(), topicId: topicId || null
      });
      setCustomCards(prev => [row, ...(prev || [])]);
    } catch (e) {
      setError(e?.message || 'Could not add the flashcard.');
    }
  }, [userId]);

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

  const gradeCustomCard = useCallback(async (id, srsPatch) => {
    // Optimistic, like toggleTask/cloudUpdateTask -- grading is a single,
    // infrequent click, so update local state immediately and report a
    // failure without rolling back (same tradeoff every other action in
    // this app's cloud hooks makes).
    setCustomCards(prev => (prev || []).map(c => (c.id === id ? { ...c, ...srsPatch } : c)));
    try {
      await cloudGradeCustomCard(userId, id, srsPatch);
    } catch (e) {
      setError(e?.message || 'Could not save your review.');
    }
  }, [userId]);

  return {
    loaded: customCards !== null,
    error,
    clearError: () => setError(''),
    customCards: customCards || [],
    actions: { addCustomCard, updateCustomCard, deleteCustomCard, gradeCustomCard }
  };
}
