// Supabase CRUD for cloud-backed tasks and notes (Phase 3E, step 1).
// Deliberately separate from dataStore.js, which stays the localStorage-only
// module per its own documented single responsibility. Every function here
// maps between the local app shape (the exact shape TasksView.jsx/Notes.jsx
// already expect from useAppState.js) and the real Supabase column names, so
// nothing above this file needs to know the two shapes differ.

import { supabase } from './supabaseClient.js';
import { CARDS } from '../data/flashcards.js';
import { today, dayIndex } from './dates.js';
import { isCorrect } from './logic.js';

function assertNoError(context, error) {
  if (error) throw new Error(`[cloudData] ${context} failed: ${error.message}`);
}

function taskFromRow(row) {
  return { id: row.id, title: row.title, priority: row.priority, due: row.due_date || '', done: row.done };
}
function noteFromRow(row, topicIdToKey) {
  return {
    id: row.id, title: row.title, topic: row.topic_label || '', body: row.body_md || '',
    // Phase 6, step 1: unlike topic_confidence/flashcards, an unresolvable
    // topic_id here degrades to null rather than throwing -- the note's own
    // title/body/topic_label are never at risk, only this optional
    // structured link, so silently dropping just that link is preferable to
    // blocking the whole notes list from loading over stale reference data.
    topicId: (row.topic_id && topicIdToKey.get(row.topic_id)) || null
  };
}
function sessionFromRow(row, topicIdToKey) {
  // Sessions have no id/edit/delete UI in the app (StudySessions.jsx keys
  // its rows by array index) -- match the local shape exactly and drop the
  // rest of the row rather than inventing a field nothing consumes.
  // Phase 6, step 2: topic_id resolution degrades to null on a stale/
  // unresolvable id, same rationale as noteFromRow() above -- a session's
  // own label/minutes/date are never at risk, only the optional link.
  return { label: row.label, mins: row.minutes, date: row.local_date, topicId: (row.topic_id && topicIdToKey.get(row.topic_id)) || null };
}

export async function fetchTasks(userId) {
  const { data, error } = await supabase.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  assertNoError('fetching tasks', error);
  return (data || []).map(taskFromRow);
}

// topicIdToKey is the caller's responsibility to fetch (via
// fetchTopicKeyMaps() below) and pass in -- the caller (useCloudTasksAndNotes.js)
// also needs the other half of that pair (keyToTopicId) for
// cloudAddNote/cloudUpdateNote, so it fetches both once per activation
// rather than this function re-fetching reference data on its own.
export async function fetchNotes(userId, topicIdToKey) {
  const { data, error } = await supabase.from('notes').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
  assertNoError('fetching notes', error);
  return (data || []).map(row => noteFromRow(row, topicIdToKey));
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

// Phase 5, step 4: mirrors "Reset my progress" marking every local task not
// done -- a bulk update, not a delete (tasks keep existing, only their
// done flag changes), unlike the delete-all treatment used for
// sessions/attempts/confidence in steps 2-3.
export async function cloudResetAllTasksDone(userId) {
  const { error } = await supabase.from('tasks').update({ done: false }).eq('user_id', userId);
  assertNoError('resetting task done flags', error);
}

// keyToTopicId resolves the "level|module|topic" string Notes.jsx's topic
// picker produces into a real topic_id. Unlike the read path in
// noteFromRow(), an unresolvable key here throws -- the picker only ever
// offers keys built from the live syllabus data the same map was built
// from, so a miss here means something is actually wrong, not just stale
// reference data on an old row.
export async function cloudAddNote(userId, keyToTopicId, { title, topic, topicId, body }) {
  const resolvedTopicId = topicId ? keyToTopicId.get(topicId) : null;
  if (topicId && !resolvedTopicId) throw new Error(`[cloudData] unknown topic for note link "${topicId}"`);
  const { data, error } = await supabase
    .from('notes')
    .insert({ user_id: userId, title, topic_label: topic || null, topic_id: resolvedTopicId, body_md: body || '' })
    .select()
    .single();
  assertNoError('adding note', error);
  return { id: data.id, title: data.title, topic: data.topic_label || '', body: data.body_md || '', topicId: topicId || null };
}

export async function cloudUpdateNote(userId, keyToTopicId, id, patch) {
  const dbPatch = { updated_at: new Date().toISOString() };
  if ('title' in patch) dbPatch.title = patch.title;
  if ('topic' in patch) dbPatch.topic_label = patch.topic || null;
  if ('body' in patch) dbPatch.body_md = patch.body ?? '';
  if ('topicId' in patch) {
    if (patch.topicId) {
      const resolvedTopicId = keyToTopicId.get(patch.topicId);
      if (!resolvedTopicId) throw new Error(`[cloudData] unknown topic for note link "${patch.topicId}"`);
      dbPatch.topic_id = resolvedTopicId;
    } else {
      dbPatch.topic_id = null;
    }
  }
  const { error } = await supabase
    .from('notes')
    .update(dbPatch)
    .eq('id', id)
    .eq('user_id', userId);
  assertNoError('updating note', error);
}

export async function cloudDeleteNote(userId, id) {
  const { error } = await supabase.from('notes').delete().eq('id', id).eq('user_id', userId);
  assertNoError('deleting note', error);
}

// topicIdToKey is the caller's responsibility to fetch (via
// fetchTopicKeyMaps()) and pass in -- same shared-reference-data approach
// useCloudTasksAndNotes.js uses for notes.
export async function fetchStudySessions(userId, topicIdToKey) {
  const { data, error } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  assertNoError('fetching study sessions', error);
  return (data || []).map(row => sessionFromRow(row, topicIdToKey));
}

// Sessions are append-only in this app (no per-row edit/delete UI, no local
// id) -- there is no cloudUpdateStudySession/cloudDeleteStudySession to
// match. The only bulk operation is cloudDeleteAllStudySessions below, for
// "Reset my progress".
//
// keyToTopicId resolution follows the same write-path rule as
// cloudAddNote(): an unresolvable key throws, since StudySessions.jsx's
// topic picker only ever offers keys built from the same live syllabus data
// the map was built from.
export async function cloudAddStudySession(userId, keyToTopicId, { label, mins, date, topicId }) {
  const resolvedTopicId = topicId ? keyToTopicId.get(topicId) : null;
  if (topicId && !resolvedTopicId) throw new Error(`[cloudData] unknown topic for session link "${topicId}"`);
  const { error } = await supabase.from('study_sessions').insert({
    user_id: userId,
    label,
    minutes: mins,
    local_date: date,
    topic_id: resolvedTopicId,
    // Same best-effort inference migrateToSupabase.js uses: the Pomodoro
    // timer is the only thing that produces this exact label prefix
    // (finishPhaseState() in logic.js); everything else -- including
    // "Skip phase", which also logs a partial Pomodoro session under the
    // same label -- is otherwise indistinguishable from a manual entry.
    source: typeof label === 'string' && label.startsWith('Pomodoro —') ? 'pomodoro' : 'manual'
  });
  assertNoError('adding study session', error);
}

// Phase 5, step 2: mirrors "Reset my progress" clearing local sessions to
// [] -- the same delete-all-rows treatment already used for flashcard SRS
// state (Step 4) when its local state clears to {}.
export async function cloudDeleteAllStudySessions(userId) {
  const { error } = await supabase.from('study_sessions').delete().eq('user_id', userId);
  assertNoError('resetting study sessions', error);
}

// Local topic keys look like
// "Level 1 (PRT)|Child Development & Pedagogy|Theories of learning" --
// built by topicKey() in logic.js as level|moduleName|topicName.
// topic_confidence, notes, and study_sessions all store a topic_id (uuid)
// instead, so every read/write for any of them needs this key <-> id
// mapping -- exported so useCloudTasksAndNotes.js (Phase 6, step 1) and
// useCloudStudySessions.js (Phase 6, step 2) can share it with
// useCloudTopicConfidence.js rather than duplicating the lookup.
// migrateToSupabase.js resolves the identical mapping the same way
// (a `topics` select joining modules/courses) for the one-time migration;
// that file is reviewed, tested and left alone per Phase 3D, so it keeps
// its own independent copy rather than importing this one.
export async function fetchTopicKeyMaps() {
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

// Phase 5, step 3: mirrors "Reset my progress" clearing local confidence to
// {} -- the same delete-all-rows treatment already used for study sessions
// and quiz attempts (step 2) and flashcard SRS state (Phase 3E step 4).
export async function cloudDeleteAllTopicConfidence(userId) {
  const { error } = await supabase.from('topic_confidence').delete().eq('user_id', userId);
  assertNoError('resetting topic confidence', error);
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

// Phase 6, step 3: custom_flashcards is a separate, user-owned table from
// the shared/read-only `flashcards` seed set above -- see
// 20260909_custom_flashcards.sql for why the two can't share a table
// (no user_id column or write policies on `flashcards`, a UNIQUE
// constraint on `front`, and fetchFlashcardIndexMaps()'s hard assertion
// that its row count equals CARDS.length). Content and SM-2 scheduling
// fields live together in one row here, since a custom card is always 1:1
// with its owner -- there's no shared reference copy to keep separate from
// per-user progress the way flashcards/flashcard_srs_state are split.
function customCardFromRow(row, topicIdToKey) {
  return {
    id: row.id, front: row.front, back: row.back, category: row.category || '',
    // Same read-path rationale as noteFromRow()/sessionFromRow() above: a
    // stale/unresolvable topic_id degrades to null rather than throwing --
    // the card's own front/back/category are never at risk, only this
    // optional structured link.
    topicId: (row.topic_id && topicIdToKey.get(row.topic_id)) || null,
    ease: Number(row.ease), interval: row.interval_days, reps: row.reps,
    due: dayIndex(row.due_date)
  };
}

// topicIdToKey is the caller's responsibility to fetch (via
// fetchTopicKeyMaps()) and pass in -- same shared-reference-data approach
// used for notes/study_sessions.
export async function fetchCustomCards(userId, topicIdToKey) {
  const { data, error } = await supabase
    .from('custom_flashcards')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  assertNoError('fetching custom flashcards', error);
  return (data || []).map(row => customCardFromRow(row, topicIdToKey));
}

// keyToTopicId resolution follows the same write-path rule as
// cloudAddNote()/cloudAddStudySession(): an unresolvable key throws, since
// the card creation form only ever offers keys built from the same live
// syllabus data the map was built from. The new card starts at the same
// fresh SM-2 defaults cardState() uses locally for a never-reviewed seeded
// card (ease 2.5, interval 0, reps 0, due today) -- due_date's own column
// default already matches "due today", so only the row's real id/fields
// need echoing back into the local shape.
export async function cloudAddCustomCard(userId, keyToTopicId, { front, back, category, topicId }) {
  const resolvedTopicId = topicId ? keyToTopicId.get(topicId) : null;
  if (topicId && !resolvedTopicId) throw new Error(`[cloudData] unknown topic for custom flashcard link "${topicId}"`);
  const { data, error } = await supabase
    .from('custom_flashcards')
    .insert({ user_id: userId, front, back, category: category || '', topic_id: resolvedTopicId })
    .select()
    .single();
  assertNoError('adding custom flashcard', error);
  return {
    id: data.id, front: data.front, back: data.back, category: data.category || '', topicId: topicId || null,
    ease: Number(data.ease), interval: data.interval_days, reps: data.reps, due: dayIndex(data.due_date)
  };
}

// Content-only edits (front/back/category/topicId) -- NOT the SM-2
// scheduling fields, which only ever change via cloudGradeCustomCard()
// below. Keeping the two write paths separate means an in-progress edit to
// a card's text can never race with or clobber a review grade landing at
// the same time, and vice versa.
export async function cloudUpdateCustomCard(userId, keyToTopicId, id, patch) {
  const dbPatch = { updated_at: new Date().toISOString() };
  if ('front' in patch) dbPatch.front = patch.front;
  if ('back' in patch) dbPatch.back = patch.back;
  if ('category' in patch) dbPatch.category = patch.category || '';
  if ('topicId' in patch) {
    if (patch.topicId) {
      const resolvedTopicId = keyToTopicId.get(patch.topicId);
      if (!resolvedTopicId) throw new Error(`[cloudData] unknown topic for custom flashcard link "${patch.topicId}"`);
      dbPatch.topic_id = resolvedTopicId;
    } else {
      dbPatch.topic_id = null;
    }
  }
  const { error } = await supabase.from('custom_flashcards').update(dbPatch).eq('id', id).eq('user_id', userId);
  assertNoError('updating custom flashcard', error);
}

// srsPatch is the already-computed new {ease, interval, reps, due} --
// the SM-2 transition math itself lives in exactly one place, logic.js
// (gradeState() for the seeded deck; a parallel function for custom cards
// is added in a later step), not duplicated here. `due` is a dayIndex()
// integer, same as cardState()'s shape, converted to a real date the same
// way cloudSetFlashcardSrs() does for the seeded deck.
export async function cloudGradeCustomCard(userId, id, { ease, interval, reps, due }) {
  const { error } = await supabase
    .from('custom_flashcards')
    .update({
      ease, interval_days: interval, reps, due_date: dateStringFromDayIndex(due),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('user_id', userId);
  assertNoError('grading custom flashcard', error);
}

export async function cloudDeleteCustomCard(userId, id) {
  const { error } = await supabase.from('custom_flashcards').delete().eq('id', id).eq('user_id', userId);
  assertNoError('deleting custom flashcard', error);
}

// Phase 5, step 6: the flashcard grading counter (feeds the Card Shark
// badge) lives on profiles.reviews -- a single-row-per-user column, same
// shape as the profile settings fields, but synced from
// useCloudFlashcardSrs.js instead of useCloudProfileSettings.js since it
// changes in the exact same gradeState() action as `cards`, not alongside
// theme/level/pomodoroMinutes/breakMinutes/showQuotes. Kept as its own pair
// of functions (not folded into fetchProfileSettings/
// cloudUpdateProfileSettings's LOCAL_TO_COLUMN map) so the two hooks never
// share a write path to the same table.
export async function fetchReviews(userId) {
  const { data, error } = await supabase.from('profiles').select('reviews').eq('id', userId).single();
  assertNoError('fetching reviews', error);
  return data.reviews;
}

export async function cloudSetReviews(userId, reviews) {
  const { error } = await supabase.from('profiles').update({ reviews }).eq('id', userId);
  assertNoError('updating reviews', error);
}

// Quiz questions are matched by (part, question_text) -- the same pair
// quiz_questions carries a UNIQUE constraint on, and the same shape
// migrateToSupabase.js would use if it ever needed to (it doesn't: quiz
// question identity was never part of the local `attempts` shape, only
// added now that live submissions can capture it).
async function fetchQuizQuestionMap() {
  const { data, error } = await supabase.from('quiz_questions').select('id, part, question_text');
  assertNoError('fetching quiz questions for attempt mapping', error);
  const map = new Map();
  for (const row of data ?? []) {
    map.set(`${row.part}|${row.question_text}`, row.id);
  }
  return map;
}

function formatAttemptWhen(isoTimestamp) {
  return new Date(isoTimestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function attemptFromRow(row) {
  return { when: formatAttemptWhen(row.submitted_at), mode: row.mode, correct: row.correct, total: row.total, pct: row.pct };
}

export async function fetchQuizAttempts(userId) {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false });
  assertNoError('fetching quiz attempts', error);
  return (data || []).map(attemptFromRow);
}

// `quiz`/`answers` are the actual question objects and qIndex->response map
// for the attempt just submitted (Quiz.jsx keeps both around through the
// 'result' stage for its own Answer review screen, so they're still exactly
// right at the point this runs). Unlike migrateToSupabase.js -- which had no
// historical per-question data to migrate and deliberately left
// quiz_attempt_answers empty -- a live submission has everything needed to
// fill it in properly.
export async function cloudAddQuizAttempt(userId, { mode, correct, total, pct, quiz, answers }) {
  const questionMap = await fetchQuizQuestionMap();
  const questionIds = quiz.map(q => {
    const id = questionMap.get(`${q.part}|${q.q}`);
    if (!id) throw new Error(`[cloudData] could not resolve quiz question to a seeded row: "${q.q}"`);
    return id;
  });

  const { data: attemptRow, error: attemptError } = await supabase
    .from('quiz_attempts')
    .insert({ user_id: userId, mode, correct, total, pct, question_ids: questionIds })
    .select()
    .single();
  assertNoError('adding quiz attempt', attemptError);

  if (quiz.length) {
    const answerRows = quiz.map((q, i) => ({
      attempt_id: attemptRow.id,
      question_id: questionIds[i],
      user_id: userId,
      response: answers[i] ?? null,
      is_correct: isCorrect(q, answers[i])
    }));
    const { error: answersError } = await supabase.from('quiz_attempt_answers').insert(answerRows);
    // The quiz_attempts row above is already committed -- there's no
    // cross-table transaction available from a browser client (the same
    // limitation migrateToSupabase.js documents for its own multi-table
    // writes) -- so a failure here leaves a real summary row with no
    // matching answers rather than nothing at all. Surfaced loudly via
    // assertNoError, not silently swallowed.
    assertNoError('adding quiz attempt answers', answersError);
  }

  return attemptFromRow(attemptRow);
}

// Phase 5, step 2: mirrors "Reset my progress" clearing local attempts to
// [] -- deleting quiz_attempts rows is sufficient on its own:
// quiz_attempt_answers.attempt_id has "on delete cascade" (per the Phase 3B
// ownership-FK fix), so this single delete also removes every matching
// answer row without a separate call.
export async function cloudDeleteAllQuizAttempts(userId) {
  const { error } = await supabase.from('quiz_attempts').delete().eq('user_id', userId);
  assertNoError('resetting quiz attempts', error);
}

// Phase 7: read-only analytics helper. s.attempts only ever stores
// attempt-LEVEL summaries (when/mode/correct/total/pct) -- per-question
// detail is never mirrored into local state (see cloudAddQuizAttempt's own
// comment above) -- but quiz_attempt_answers + quiz_questions already
// exist in Supabase and already carry it (is_correct per answer, joined to
// the question's `part`). This reads both EXISTING tables to build a
// per-part accuracy breakdown for "strongest/weakest syllabus areas" --
// no new table, no new write path, nothing else in the app calls this.
export async function fetchQuizPerformanceByPart(userId) {
  const { data, error } = await supabase
    .from('quiz_attempt_answers')
    .select('is_correct, quiz_questions ( part )')
    .eq('user_id', userId);
  assertNoError('fetching quiz performance by part', error);

  const byPart = {};
  for (const row of data ?? []) {
    const part = row.quiz_questions?.part;
    if (!part) continue;
    if (!byPart[part]) byPart[part] = { correct: 0, total: 0 };
    byPart[part].total++;
    if (row.is_correct) byPart[part].correct++;
  }
  return byPart;
}

// Phase 3E, step 6: profiles is a single row per user (id = auth.users.id,
// auto-created by the handle_new_user() trigger on signup), so unlike every
// other resource so far there is no id-resolution/mapping and no insert
// path -- only select/update against a row that's guaranteed to exist.
//
// LOCAL_TO_COLUMN is the only place local setting names map to columns, and
// cloudUpdateProfileSettings() only ever writes columns it finds in that
// map -- an unrecognized key throws rather than passing through, which is
// what keeps this function from ever being able to touch
// profiles.migrated_at (exclusively owned by migrateToSupabase.js's
// idempotency gate) even by accident.
const LOCAL_TO_COLUMN = {
  theme: 'theme',
  level: 'exam_level',
  pomodoroMinutes: 'pomodoro_minutes',
  breakMinutes: 'break_minutes',
  showQuotes: 'show_quotes',
  // Phase 8: study goal & exam countdown -- same profiles row, same
  // generic map/hook (useCloudProfileSettings.js), no new table.
  examDate: 'exam_date',
  dailyGoalMinutes: 'daily_goal_minutes'
};

function settingsFromRow(row) {
  return {
    theme: row.theme,
    level: row.exam_level,
    pomodoroMinutes: row.pomodoro_minutes,
    breakMinutes: row.break_minutes,
    showQuotes: row.show_quotes,
    examDate: row.exam_date,
    dailyGoalMinutes: row.daily_goal_minutes
  };
}

export async function fetchProfileSettings(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('theme, exam_level, pomodoro_minutes, break_minutes, show_quotes, exam_date, daily_goal_minutes')
    .eq('id', userId)
    .single();
  assertNoError('fetching profile settings', error);
  return settingsFromRow(data);
}

export async function cloudUpdateProfileSettings(userId, patch) {
  const dbPatch = {};
  for (const key of Object.keys(patch)) {
    const column = LOCAL_TO_COLUMN[key];
    if (!column) throw new Error(`[cloudData] unknown profile setting "${key}"`);
    dbPatch[column] = patch[key];
  }
  const { error } = await supabase.from('profiles').update(dbPatch).eq('id', userId);
  assertNoError('updating profile settings', error);
}

// Phase 15: permanently deletes the signed-in user's account and, via
// cascade, every row they own across every table. See
// 20260909c_delete_own_account_function.sql for why this has to be a
// SECURITY DEFINER Postgres function rather than a direct client-side
// delete -- the anon key can never remove an auth.users row itself, and
// the function is hard-gated to auth.uid() (no id parameter exists to
// pass), so this can only ever delete the caller's own account.
export async function deleteOwnAccount() {
  const { error } = await supabase.rpc('delete_own_account');
  assertNoError('deleting account', error);
}
