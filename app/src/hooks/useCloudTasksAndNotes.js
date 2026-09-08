import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchTasks, fetchNotes, cloudAddTask, cloudUpdateTask, cloudDeleteTask,
  cloudAddNote, cloudUpdateNote, cloudDeleteNote
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
export function useCloudTasksAndNotes({ active, userId, baseState, baseUpdate, baseActions }) {
  const [tasks, setTasks] = useState(null); // null = not loaded yet
  const [notes, setNotes] = useState(null);
  const [error, setError] = useState('');
  const pendingNoteWrites = useRef(new Map()); // noteId -> { timer, patch }

  useEffect(() => {
    if (!active) {
      setTasks(null);
      setNotes(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [t, n] = await Promise.all([fetchTasks(userId), fetchNotes(userId)]);
        if (!cancelled) {
          setTasks(t);
          setNotes(n);
          setError('');
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not load your cloud data.');
      }
    })();
    return () => { cancelled = true; };
  }, [active, userId]);

  // Flush any pending debounced note writes on unmount so an edit made
  // right before navigating away/logging out isn't silently dropped.
  useEffect(() => () => {
    for (const { timer, id, patch } of pendingNoteWrites.current.values()) {
      clearTimeout(timer);
      cloudUpdateNote(userId, id, patch).catch(() => { /* best-effort on unmount */ });
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
      const row = await cloudAddNote(userId, { title: 'New note', topic: baseState.level, body: '# New note\n\n- point one\n' });
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
      cloudUpdateNote(userId, id, mergedPatch).catch(e => {
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
