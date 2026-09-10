import { useCallback, useEffect, useState } from 'react';
import { fetchCustomTopics, cloudAddCustomTopic, cloudDeleteCustomTopic } from '../lib/cloudData.js';

// Phase 23. Shaped like useCloudCustomCards.js: real per-row CRUD, an
// `actions` object AppContext.jsx spreads over base.actions when cloud
// sync is on. addCustomTopic() reads the customTopicModule/Name/Desc draft
// fields Syllabus.jsx's create form writes to (always against the CURRENT
// s.level, same as the local fallback in logic.js), and clears them via
// baseUpdate() on success -- the same shape as addCustomCard()'s
// relationship to customCardFront/Back/Category.
//
// No topic-linking here at all (unlike customCards' topicId) -- custom
// topics don't have anywhere to link TO; they're the thing other things
// link to, and per the Phase 23 design note, that linking was deliberately
// left out of scope. useCloudTopicConfidence.js is what actually makes a
// custom topic's confidence marks sync -- this hook only owns the topics
// themselves (add/delete), not their confidence rows.
export function useCloudCustomTopics({ active, userId, baseState, baseUpdate }) {
  const [customTopics, setCustomTopics] = useState(null); // null = not loaded yet
  const [error, setError] = useState('');

  useEffect(() => {
    if (!active) {
      setCustomTopics(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchCustomTopics(userId);
        if (!cancelled) {
          setCustomTopics(rows);
          setError('');
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not load your custom topics.');
      }
    })();
    return () => { cancelled = true; };
  }, [active, userId]);

  const addCustomTopic = useCallback(async () => {
    const moduleName = baseState.customTopicModule.trim();
    const name = baseState.customTopicName.trim();
    if (!moduleName || !name) return;
    try {
      const row = await cloudAddCustomTopic(userId, {
        level: baseState.level, moduleName, name, desc: baseState.customTopicDesc.trim()
      });
      setCustomTopics(prev => [row, ...(prev || [])]);
      baseUpdate({ customTopicModule: '', customTopicName: '', customTopicDesc: '' });
    } catch (e) {
      setError(e?.message || 'Could not add the topic.');
    }
  }, [userId, baseState.level, baseState.customTopicModule, baseState.customTopicName, baseState.customTopicDesc, baseUpdate]);

  const deleteCustomTopic = useCallback(async (id) => {
    try {
      await cloudDeleteCustomTopic(userId, id);
      setCustomTopics(prev => (prev || []).filter(t => t.id !== id));
    } catch (e) {
      setError(e?.message || 'Could not delete the topic.');
    }
  }, [userId]);

  return {
    loaded: customTopics !== null,
    error,
    clearError: () => setError(''),
    customTopics: customTopics !== null ? customTopics : baseState.customTopics,
    actions: { addCustomTopic, deleteCustomTopic }
  };
}
