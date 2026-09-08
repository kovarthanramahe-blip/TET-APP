// Supabase CRUD for cloud-backed tasks and notes (Phase 3E, step 1).
// Deliberately separate from dataStore.js, which stays the localStorage-only
// module per its own documented single responsibility. Every function here
// maps between the local app shape (the exact shape TasksView.jsx/Notes.jsx
// already expect from useAppState.js) and the real Supabase column names, so
// nothing above this file needs to know the two shapes differ.

import { supabase } from './supabaseClient.js';

function assertNoError(context, error) {
  if (error) throw new Error(`[cloudData] ${context} failed: ${error.message}`);
}

function taskFromRow(row) {
  return { id: row.id, title: row.title, priority: row.priority, due: row.due_date || '', done: row.done };
}
function noteFromRow(row) {
  return { id: row.id, title: row.title, topic: row.topic_label || '', body: row.body_md || '' };
}

export async function fetchTasks(userId) {
  const { data, error } = await supabase.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  assertNoError('fetching tasks', error);
  return (data || []).map(taskFromRow);
}

export async function fetchNotes(userId) {
  const { data, error } = await supabase.from('notes').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
  assertNoError('fetching notes', error);
  return (data || []).map(noteFromRow);
}

export async function cloudAddTask(userId, { title, priority, due }) {
  const { data, error } = await supabase
    .from('tasks')
    .insert({ user_id: userId, title, priority, due_date: due ? due : null, done: false })
    .select()
    .single();
  assertNoError('adding task', error);
  return taskFromRow(data);
}

export async function cloudUpdateTask(userId, id, patch) {
  const dbPatch = {};
  if ('title' in patch) dbPatch.title = patch.title;
  if ('priority' in patch) dbPatch.priority = patch.priority;
  if ('due' in patch) dbPatch.due_date = patch.due ? patch.due : null;
  if ('done' in patch) dbPatch.done = patch.done;
  const { data, error } = await supabase
    .from('tasks')
    .update(dbPatch)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  assertNoError('updating task', error);
  return taskFromRow(data);
}

export async function cloudDeleteTask(userId, id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId);
  assertNoError('deleting task', error);
}

export async function cloudAddNote(userId, { title, topic, body }) {
  const { data, error } = await supabase
    .from('notes')
    .insert({ user_id: userId, title, topic_label: topic || null, topic_id: null, body_md: body || '' })
    .select()
    .single();
  assertNoError('adding note', error);
  return noteFromRow(data);
}

export async function cloudUpdateNote(userId, id, patch) {
  const dbPatch = { updated_at: new Date().toISOString() };
  if ('title' in patch) dbPatch.title = patch.title;
  if ('topic' in patch) dbPatch.topic_label = patch.topic || null;
  if ('body' in patch) dbPatch.body_md = patch.body ?? '';
  const { data, error } = await supabase
    .from('notes')
    .update(dbPatch)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  assertNoError('updating note', error);
  return noteFromRow(data);
}

export async function cloudDeleteNote(userId, id) {
  const { error } = await supabase.from('notes').delete().eq('id', id).eq('user_id', userId);
  assertNoError('deleting note', error);
}
