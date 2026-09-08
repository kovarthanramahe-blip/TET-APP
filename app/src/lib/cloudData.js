// Supabase CRUD for cloud-backed tasks and notes (Phase 3E, step 1).
// Deliberately separate from dataStore.js, which stays the localStorage-only
// module per its own documented single responsibility. Every function here
// maps between the local app shape (the exact shape TasksView.jsx/Notes.jsx
// already expect from useAppState.js) and the real Supabase column names, so
// nothing above this file needs to know the two shapes differ.

import { supabase } from './supabaseClient.js';
import { CARDS } from '../data/flashcards.js';
import { today, dayIndex } from './dates.js';

function assertNoError(context, error) {
  if (error) throw new Error(`[cloudData] ${context} failed: ${error.message}`);
}

function taskFromRow(row) {
  return { id: row.id, title: row.title, priority: row.priority, due: row.due_date || '', done: row.done };
}
function noteFromRow(row) {
  return { id: row.id, title: row.title, topic: row.topic_label || '', body: row.body_md || '' };
}
function sessionFromRow(row) {
  // Sessions have no id/edit/delete UI in the app (StudySessions.jsx keys
  // its rows by array index) -- match the local shape exactly and drop the
  // rest of the row rather than inventing a field nothing consumes.
  return { label: row.label, mins: row.minutes, date: row.local_date };
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

export async function fetchStudySessions(userId) {
  const { data, error } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  assertNoError('fetching study sessions', error);
  return (data || []).map(sessionFromRow);
}

// Sessions are append-only in this app (no edit/delete UI, no local id) --
// there is no cloudUpdateStudySession/cloudDeleteStudySession to match.
export async function cloudAddStudySession(userId, { label, mins, date }) {
  const { error } = await supabase.from('study_sessions').insert({
    user_id: userId,
    label,
    minutes: mins,
    local_date: date,
    topic_id: null,
    // Same best-effort inference migrateToSupabase.js uses: the Pomodoro
    // timer is the only thing that produces this exact label prefix
    // (finishPhaseState() in logic.js); everything else -- including
    // "Skip phase", which also logs a partial Pomodoro session under the
    // same label -- is otherwise indistinguishable from a manual entry.
    source: typeof label === 'string' && label.startsWith('Pomodoro —') ? 'pomodoro' : 'manual'
  });
  assertNoError('adding study session', error);
}

// Local topic_confidence keys look like
// "Level 1 (PRT)|Child Development & Pedagogy|Theories of learning" --
// built by topicKey() in logic.js as level|moduleName|topicName. The
// topic_confidence table stores a topic_id (uuid) instead, so every read/
// write needs this key <-> id mapping. migrateToSupabase.js already
// resolves the identical mapping the same way (a `topics` select joining
// modules/courses) for the one-time migration; that file is reviewed,
// tested and left alone per Phase 3D, so this is a deliberate, small
// duplication of that lookup rather than a shared import.
async function fetchTopicKeyMaps() {
  const { data, error } = await supabase
    .from('topics')
    .select('id, name, modules ( name, courses ( title ) )');
  assertNoError('fetching topics for confidence mapping', error);

  const keyToTopicId = new Map();
  const topicIdToKey = new Map();
  for (const row of data ?? []) {
    const courseTitle = row.modules?.courses?.title;
    const moduleName = row.modules?.name;
    if (!courseTitle || !moduleName) continue;
    const key = `${courseTitle}|${moduleName}|${row.name}`;
    keyToTopicId.set(key, row.id);
    topicIdToKey.set(row.id, key);
  }
  return { keyToTopicId, topicIdToKey };
}

// Returns both the local-shape confidence object (for merging into app
// state) and the keyToTopicId map the caller needs to hold onto for any
// later cloudSetTopicConfidence() calls -- reference data that doesn't
// change while the app is open, so it's fetched once per activation
// rather than on every mark.
export async function fetchTopicConfidence(userId) {
  const { keyToTopicId, topicIdToKey } = await fetchTopicKeyMaps();
  const { data, error } = await supabase
    .from('topic_confidence')
    .select('topic_id, level')
    .eq('user_id', userId);
  assertNoError('fetching topic confidence', error);

  const confidence = {};
  for (const row of data ?? []) {
    const key = topicIdToKey.get(row.topic_id);
    // A row whose topic_id isn't in the current reference-data map would
    // mean the seeded topics changed since this mark was saved -- silently
    // dropping it would make a real mark disappear without explanation, so
    // surface it the same way migrateToSupabase.js treats an unresolvable
    // key: loudly, not silently.
    if (!key) throw new Error(`[cloudData] topic confidence row references an unknown topic_id "${row.topic_id}"`);
    confidence[key] = row.level;
  }
  return { confidence, keyToTopicId };
}

export async function cloudSetTopicConfidence(userId, keyToTopicId, key, level) {
  const topicId = keyToTopicId.get(key);
  if (!topicId) throw new Error(`[cloudData] unknown topic for confidence key "${key}"`);
  const { error } = await supabase
    .from('topic_confidence')
    .upsert({ user_id: userId, topic_id: topicId, level }, { onConflict: 'user_id,topic_id' });
  assertNoError('updating topic confidence', error);
}

// Local flashcard SRS keys are stringified indexes ("0".."9") into CARDS
// (data/flashcards.js); flashcard_srs_state keys on card_id (uuid). Same
// front-text matching migrateToSupabase.js uses for the one-time migration
// (the `flashcards` table has no position/created_at to order by, and per
// that file's own rule we never assume UUID ordering either) -- duplicated
// here rather than touching that reviewed, tested, left-alone file.
async function fetchFlashcardIndexMaps() {
  const { data, error } = await supabase.from('flashcards').select('id, front');
  assertNoError('fetching flashcards for SRS index mapping', error);
  if (!data || data.length !== CARDS.length) {
    throw new Error(`[cloudData] expected ${CARDS.length} seeded flashcards, found ${data?.length ?? 0}`);
  }
  const idByFront = new Map(data.map(r => [r.front, r.id]));
  const indexToId = CARDS.map(([front]) => {
    const id = idByFront.get(front);
    if (!id) throw new Error(`[cloudData] seeded flashcards is missing expected card: "${front}"`);
    return id;
  });
  const idToIndex = new Map(indexToId.map((id, i) => [id, i]));
  return { indexToId, idToIndex };
}

// Same local-midnight differencing approach as migrateToSupabase.js's
// dateStringFromDayIndex() -- naive `new Date(due*86400000).toISOString()`
// epoch math loses a day for positive-UTC-offset timezones (India/IST
// specifically), since due_date is a Postgres `date`, not a timestamp.
function dateStringFromDayIndex(targetIndex) {
  const diff = targetIndex - dayIndex();
  const anchor = new Date(today() + 'T00:00:00');
  anchor.setDate(anchor.getDate() + diff);
  const yyyy = anchor.getFullYear();
  const mm = String(anchor.getMonth() + 1).padStart(2, '0');
  const dd = String(anchor.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Returns both the local-shape `cards` object (for hydrating base state --
// see useCloudFlashcardSrs.js for why this resource is hydrated rather than
// overridden) and the indexToId map needed by later cloudSetFlashcardSrs()
// calls.
export async function fetchFlashcardSrs(userId) {
  const { indexToId, idToIndex } = await fetchFlashcardIndexMaps();
  const { data, error } = await supabase
    .from('flashcard_srs_state')
    .select('card_id, ease, interval_days, reps, due_date')
    .eq('user_id', userId);
  assertNoError('fetching flashcard SRS state', error);

  const cards = {};
  for (const row of data ?? []) {
    const index = idToIndex.get(row.card_id);
    if (index === undefined) throw new Error(`[cloudData] flashcard SRS row references an unknown card_id "${row.card_id}"`);
    cards[String(index)] = {
      ease: Number(row.ease),
      interval: row.interval_days,
      reps: row.reps,
      due: dayIndex(row.due_date)
    };
  }
  return { cards, indexToId };
}

export async function cloudSetFlashcardSrs(userId, indexToId, index, entry) {
  const cardId = indexToId.get(index);
  if (!cardId) throw new Error(`[cloudData] unknown flashcard for index ${index}`);
  const { error } = await supabase.from('flashcard_srs_state').upsert({
    user_id: userId,
    card_id: cardId,
    ease: entry.ease,
    interval_days: entry.interval,
    reps: entry.reps,
    due_date: dateStringFromDayIndex(entry.due)
  }, { onConflict: 'user_id,card_id' });
  assertNoError('updating flashcard SRS state', error);
}

// Mirrors a full local clear -- either the Flashcards view's "Reset
// scheduling" button or the sidebar's "Reset my progress" both set
// state.cards to {} -- as deleting all of this user's rows, matching
// cardState()'s local semantics where an absent entry means "never
// reviewed, default ease/interval/reps, due now."
export async function cloudDeleteAllFlashcardSrs(userId) {
  const { error } = await supabase.from('flashcard_srs_state').delete().eq('user_id', userId);
  assertNoError('resetting flashcard SRS state', error);
}
