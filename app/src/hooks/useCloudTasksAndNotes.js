import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchTasks, fetchNotes, cloudAddTask, cloudUpdateTask, cloudDeleteTask,
  cloudAddNote, cloudUpdateNote, cloudDeleteNote, cloudResetAllTasksDone,
  fetchTopicKeyMaps
} from '../lib/cloudData.js';

// Phase 3E, step 1: once `active`, this hook becomes the source of truth for
// tasks and notes, replacing the localStorage-backed versions from
// useAppState.js. It never touches localStorage itself. `baseState`/
// `baseUpdate`/`baseActions` are useAppState.js's own values, passed in so
// this hook can read the new-task draft fields (taskDraft/taskPriority/
// taskDue) and drive setActiveNote -- exactly the same fields the original
// local addTask()/addNote() actions read, so behavior matches exactly.
//
// Action design: addTask/toggleTask/removeTask/addNote/deleteNote are
// simple "await the write, then update the UI" -- each is a single,
// infrequent click, so a brief round-trip is unnoticeable. updateNote is
// the one deliberate exception: Notes.jsx calls it on every keystroke while
// typing (title/topic/body are controlled inputs), so awaiting a network
// round-trip per keystroke would visibly fight the user's typing. It
// updates local state immediately and debounces the actual write per note
// id, coalescing rapid edits into one request. A failed save is reported
// but never rolls back what the user typed.
//
// Phase 5, step 4: toggleTask/addTask/removeTask fully replace the base
// actions while active, so base.state.tasks is never touched by anything
// except "Reset my progress" (resetProgressState() marking every local
// task not done). That makes any change to baseState.tasks while active a
// reliable Reset signal, watched below and mirrored as a bulk
// done=false update -- not a delete, since Reset doesn't remove tasks --
// closing the gap the original Phase 3E step 1 write-up didn't cover
// (notes are untouched by Reset and need no equivalent).
export function useCloudTasksAndNotes({ active, userId, baseState, baseUpdate, baseActions }) {
  const [tasks, setTasks] = useState(null); // null = not loaded yet
  const [notes, setNotes] = useState(null);
  const [error, setError] = useState('');
  const pendingNoteWrites = useRef(new Map()); // noteId -> { timer, patch }
  const lastBaseTasksRef = useRef(null);
  // Phase 6, step 1: the "level|module|topic" <-> topic_id maps notes'
  // topic links need. Fetched once per activation (reference data, doesn't
  // change while the app is open) via the same fetchTopicKeyMaps()
  // useCloudTopicConfidence.js already uses, rather than duplicating that
  // lookup a third time.
  const topicMapsRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setTasks(null);
      setNotes(null);
      lastBaseTasksRef.current = null;
      topicMapsRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [t, topicMaps] = await Promise.all([fetchTasks(userId), fetchTopicKeyMaps()]);
        const n = await fetchNotes(userId, topicMaps.topicIdToKey);
        if (!cancelled) {
          setTasks(t);
          setNotes(n);
          topicMapsRef.current = topicMaps;
          // Baseline against the local tasks array *as of now* -- anything
          // already there (e.g. from the one-time migration) is not a
          // reset just because it doesn't match what was fetched. See the
          // reset-detection effect below.
          lastBaseTasksRef.current = baseState.tasks;
          setError('');
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not load your cloud data.');
      }
    })();
    return () => { cancelled = true; };
    // baseState is intentionally not a dependency here -- this effect
    // should only (re-)run the initial fetch when cloud sync turns on/off
    // or the user changes, not every time it's baselined below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, userId]);

  useEffect(() => {
    if (!active || tasks === null) return;
    if (baseState.tasks === lastBaseTasksRef.current) return; // unchanged
    lastBaseTasksRef.current = baseState.tasks;

    setTasks(prev => (prev || []).map(t => ({ ...t, done: false })));
    cloudResetAllTasksDone(userId).catch(e => {
      setError(e?.message || 'Could not reset your tasks.');
    });
  }, [active, tasks, baseState.tasks, userId]);

  // Flush any pending debounced note writes on unmount so an edit made
  // right before navigating away/logging out isn't silently dropped.
  useEffect(() => () => {
    const keyToTopicId = topicMapsRef.current?.keyToTopicId || new Map();
    for (const { timer, id, patch } of pendingNoteWrites.current.values()) {
      clearTimeout(timer);
      cloudUpdateNote(userId, keyToTopicId, id, patch).catch(() => { /* best-effort on unmount */ });
    }
    pendingNoteWrites.current.clear();
  }, [userId]);

  const addTask = useCallback(async () => {
    if (!baseState.taskDraft.trim()) return;
    try {
      const row = await cloudAddTask(userId, {
        title: baseState.taskDraft.trim(), priority: baseState.taskPriority, due: baseState.taskDue
      });
      setTasks(prev => [row, ...(prev || [])]);
      baseUpdate({ taskDraft: '', taskDue: '' });
    } catch (e) {
      setError(e?.message || 'Could not add the task.');
    }
  }, [userId, baseState.taskDraft, baseState.taskPriority, baseState.taskDue, baseUpdate]);

  const toggleTask = useCallback(async (id) => {
    const current = (tasks || []).find(t => t.id === id);
    if (!current) return;
    try {
      const updated = await cloudUpdateTask(userId, id, { done: !current.done });
      setTasks(prev => (prev || []).map(t => (t.id === id ? updated : t)));
    } catch (e) {
      setError(e?.message || 'Could not update the task.');
    }
  }, [userId, tasks]);

  const removeTask = useCallback(async (id) => {
    try {
      await cloudDeleteTask(userId, id);
      setTasks(prev => (prev || []).filter(t => t.id !== id));
    } catch (e) {
      setError(e?.message || 'Could not remove the task.');
    }
  }, [userId]);

  const addNote = useCallback(async () => {
    try {
      const keyToTopicId = topicMapsRef.current?.keyToTopicId || new Map();
      const row = await cloudAddNote(userId, keyToTopicId, { title: 'New note', topic: baseState.level, topicId: null, body: '# New note\n\n- point one\n' });
      setNotes(prev => [row, ...(prev || [])]);
      baseActions.setActiveNote(row.id);
    } catch (e) {
      setError(e?.message || 'Could not create the note.');
    }
  }, [userId, baseState.level, baseActions]);

  const updateNote = useCallback((id, patch) => {
    // Optimistic + debounced -- see the note-editing rationale above.
    setNotes(prev => (prev || []).map(n => (n.id === id ? { ...n, ...patch } : n)));

    const existing = pendingNoteWrites.current.get(id);
    if (existing) clearTimeout(existing.timer);
    const mergedPatch = { ...(existing?.patch || {}), ...patch };
    const timer = setTimeout(() => {
      pendingNoteWrites.current.delete(id);
      const keyToTopicId = topicMapsRef.current?.keyToTopicId || new Map();
      cloudUpdateNote(userId, keyToTopicId, id, mergedPatch).catch(e => {
        setError(e?.message || 'Could not save your note.');
      });
    }, 600);
    pendingNoteWrites.current.set(id, { timer, id, patch: mergedPatch });
  }, [userId]);

  const deleteNote = useCallback(async (id) => {
    const pending = pendingNoteWrites.current.get(id);
    if (pending) { clearTimeout(pending.timer); pendingNoteWrites.current.delete(id); }
    try {
      await cloudDeleteNote(userId, id);
      setNotes(prev => {
        const rest = (prev || []).filter(n => n.id !== id);
        baseActions.setActiveNote(rest.length ? rest[0].id : '');
        return rest;
      });
    } catch (e) {
      setError(e?.message || 'Could not delete the note.');
    }
  }, [userId, baseActions]);

  const loaded = tasks !== null && notes !== null;

  return {
    loaded,
    error,
    clearError: () => setError(''),
    tasks: loaded ? tasks : baseState.tasks,
    notes: loaded ? notes : baseState.notes,
    actions: { addTask, toggleTask, removeTask, addNote, updateNote, deleteNote }
  };
}
