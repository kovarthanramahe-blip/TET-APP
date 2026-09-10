// One-time localStorage -> Supabase migration engine.
//
// This module is intentionally standalone: it does not import from
// useAppState.js or any view component, and nothing yet calls it from the
// UI. It only reads localStorage (via dataStore.js's readStoredState) --
// it never writes to or clears it. localStorage remains the safety
// fallback until this migration path has been exercised for real.
//
// All writes below run through the caller's normal authenticated Supabase
// session (the same client used everywhere else in the app). Every table
// this touches has Row Level Security enabled with `auth.uid() = user_id`
// policies, so nothing here can read or write another user's data, and
// nothing here uses or needs a service-role key.

import { getSupabaseClient } from './supabaseClient.js';
import { readStoredState } from './dataStore.js';
import { CARDS } from '../data/flashcards.js';
import { dayIndex, today } from './dates.js';

// ---- DAY-INDEX -> CALENDAR DATE CONVERSION --------------------------------
// `due` is stored locally as dayIndex()'s raw integer (see dates.js), which
// is NOT simply "days since the Unix epoch at UTC midnight" -- dayIndex()
// parses a date string as a LOCAL midnight instant, so its integer carries
// a timezone-dependent offset baked in. Converting it back with naive epoch
// arithmetic (`new Date(due * 86400000).toISOString()`) silently loses a
// day for anyone in a positive UTC offset (e.g. India, this app's actual
// audience): dayIndex('2026-09-07') under IST comes back as 2026-09-06 with
// that approach. Verified empirically under both IST and US Eastern.
//
// The correct, timezone-invariant fix: the *difference* between two
// dayIndex() values is always exactly the number of calendar days apart,
// regardless of timezone offset (the offset is a constant that cancels out
// in a subtraction). So we anchor on today's real local calendar date,
// compute the day-count difference from a fresh dayIndex() call, and add
// that difference using local date arithmetic -- never raw millisecond math.
function dateStringFromDayIndex(targetIndex) {
  const diff = targetIndex - dayIndex();
  const anchor = new Date(today() + 'T00:00:00');
  anchor.setDate(anchor.getDate() + diff);
  const yyyy = anchor.getFullYear();
  const mm = String(anchor.getMonth() + 1).padStart(2, '0');
  const dd = String(anchor.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function assertNoError(context, error) {
  if (error) {
    throw new Error(`[migrateToSupabase] ${context} failed: ${error.message}`);
  }
}

// ---- PARTIAL-MIGRATION / DUPLICATE-INSERT GUARD ---------------------------
// tasks, notes, study_sessions and quiz_attempts have no unique constraint
// to fall back on (unlike topic_confidence and flashcard_srs_state, which
// use a real upsert against their primary key). A true multi-table
// transaction isn't available from a browser Supabase client -- each
// `.from(...)` call is its own independent request, so there is no way to
// wrap several of them in one atomic unit without a server-side Postgres
// function, which would mean adding a new migration/schema file. That is
// out of scope here, so instead: each table step below already performs a
// single batch `insert(rows)` for ALL of that table's local rows in one
// call, and a single multi-row INSERT statement is itself atomic in
// Postgres -- it can never insert some rows and fail on the rest. That
// guarantees the only possible state for one of these tables is "this user
// has zero rows here" or "this user's full batch already landed here."
// So a plain existence check per table is sufficient (not per-row content
// matching) to make a retry-after-partial-failure skip work that's already
// done, without ever under- or over-inserting.
//
// NOTE: this reasoning depends on each table's insert staying a single
// batched call. If this code is ever changed to insert rows one at a time
// or in smaller chunks, this existence check would no longer be sufficient
// on its own.
async function tableAlreadyHasRows(table, userId) {
  const supabase = await getSupabaseClient();
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  assertNoError(`checking existing rows in ${table}`, error);
  return (count ?? 0) > 0;
}

/**
 * Migrates the current browser's localStorage study data into Supabase for
 * the given authenticated user. Safe to call on every login: it checks
 * profiles.migrated_at first and does nothing if migration already ran.
 *
 * @param {{ id: string }} user - the Supabase auth user (e.g. from useAuth().user)
 * @returns {Promise<{ status: 'already_migrated' | 'migrated', migratedAt: string }>}
 */
export async function migrateLocalStorageToSupabase(user) {
  const supabase = await getSupabaseClient();
  if (!user || !user.id) {
    throw new Error('[migrateToSupabase] a signed-in user is required');
  }
  const userId = user.id;

  // Defensive check: every write below is stamped with `userId` from the
  // passed-in `user` object, and RLS independently enforces
  // `auth.uid() = user_id` against the *real* session on every request
  // regardless of what this function believes -- so a mismatch here could
  // never leak or corrupt another user's data. But if a caller ever passes
  // a stale or wrong `user` object, that mismatch would otherwise surface
  // as a wall of confusing RLS-denied errors on every single insert. Fail
  // once, clearly, up front instead.
  const { data: authData, error: authError } = await supabase.auth.getUser();
  assertNoError('verifying the current Supabase session', authError);
  if (!authData?.user || authData.user.id !== userId) {
    throw new Error('[migrateToSupabase] the provided user does not match the current authenticated Supabase session');
  }

  // ==========================================================================
  // IDEMPOTENCY GUARD
  // profiles.migrated_at is the single source of truth for "has this user's
  // local data already been migrated." It is only ever set in the very last
  // step below, after every preceding step has succeeded -- so if this
  // function was previously interrupted partway through, migrated_at will
  // still be null and a re-run is expected to try again from the top. See
  // tableAlreadyHasRows() above for why a retry cannot duplicate rows.
  // ==========================================================================
  const { data: profile, error: profileReadError } = await supabase
    .from('profiles')
    .select('migrated_at')
    .eq('id', userId)
    .single();
  assertNoError('reading profile for idempotency check', profileReadError);

  if (profile?.migrated_at) {
    return { status: 'already_migrated', migratedAt: profile.migrated_at };
  }

  const state = readStoredState() || {};

  // ==========================================================================
  // 1) profiles -- settings
  // `reviews` (Phase 5, step 6) carries the flashcard grading counter
  // across into its new cloud column the same way every other setting
  // here already does -- a plain snapshot of whatever's in localStorage
  // at migration time, nothing derived or recomputed.
  // ==========================================================================
  const { error: settingsError } = await supabase
    .from('profiles')
    .update({
      theme: state.theme ?? 'light',
      exam_level: state.level ?? 'Level 1 (PRT)',
      pomodoro_minutes: state.pomodoroMinutes ?? 25,
      break_minutes: state.breakMinutes ?? 5,
      show_quotes: state.showQuotes ?? true,
      reviews: state.reviews ?? 0
    })
    .eq('id', userId);
  assertNoError('updating profile settings', settingsError);

  // ==========================================================================
  // 2) tasks
  // Fresh UUIDs only -- the old local ids ('t1', 't' + Date.now()) are
  // never reused, so `id` is simply omitted and the database default
  // (gen_random_uuid()) takes over.
  // ==========================================================================
  const tasks = state.tasks ?? [];
  if (tasks.length && !(await tableAlreadyHasRows('tasks', userId))) {
    const rows = tasks.map(t => ({
      user_id: userId,
      title: t.title,
      priority: t.priority,
      due_date: t.due ? t.due : null, // "" -> null; due_date is a real date column
      done: !!t.done
    }));
    const { error } = await supabase.from('tasks').insert(rows);
    assertNoError('inserting tasks', error);
  }

  // ==========================================================================
  // 3) notes
  // `topic` is free text the user typed themselves (e.g. "CDP · Theories of
  // learning") -- it was never constrained to match a real topic name, so
  // it is preserved as-is in topic_label and NOT resolved to a topic_id.
  // ==========================================================================
  const notes = state.notes ?? [];
  if (notes.length && !(await tableAlreadyHasRows('notes', userId))) {
    const rows = notes.map(n => ({
      user_id: userId,
      title: n.title,
      topic_label: n.topic || null,
      topic_id: null,
      body_md: n.body ?? ''
    }));
    const { error } = await supabase.from('notes').insert(rows);
    assertNoError('inserting notes', error);
  }

  // ==========================================================================
  // 4) study_sessions
  // ==========================================================================
  const sessions = state.sessions ?? [];
  if (sessions.length && !(await tableAlreadyHasRows('study_sessions', userId))) {
    const rows = sessions.map(s => ({
      user_id: userId,
      label: s.label,
      minutes: s.mins,
      local_date: s.date,
      topic_id: null,
      // `source` is NOT part of the original localStorage shape -- it is
      // inferred here, best-effort, from the auto-generated label text
      // ('Pomodoro — <mode>', set by finishPhaseState() in logic.js).
      // Anything else (including manual log entries) is classified as
      // 'manual'. This is an inference, not a recovered historical fact.
      source: typeof s.label === 'string' && s.label.startsWith('Pomodoro —') ? 'pomodoro' : 'manual'
    }));
    const { error } = await supabase.from('study_sessions').insert(rows);
    assertNoError('inserting study sessions', error);
  }

  // ==========================================================================
  // 5) topic_confidence
  // ---- TOPIC CONFIDENCE LOOKUP -------------------------------------------
  // Local keys look like "Level 1 (PRT)|Child Development & Pedagogy|Theories
  // of learning" (built by topicKey() in logic.js: level|moduleName|topicName).
  // We rebuild the same "course|module|topic" string for every row seeded in
  // Phase 3C and use it as a lookup key, so a match here means an exact,
  // byte-for-byte match against the seeded reference data -- not a fuzzy one.
  // Per requirement F, an unmatched key is NOT silently dropped: it stops the
  // whole migration with an error naming the exact key that failed.
  // ==========================================================================
  const confidence = state.confidence ?? {};
  const confidenceKeys = Object.keys(confidence);
  if (confidenceKeys.length) {
    const { data: topicRows, error: topicsError } = await supabase
      .from('topics')
      .select('id, name, modules ( name, courses ( title ) )');
    assertNoError('fetching topics for confidence lookup', topicsError);

    const topicIdByKey = new Map();
    for (const row of topicRows ?? []) {
      const courseTitle = row.modules?.courses?.title;
      const moduleName = row.modules?.name;
      if (!courseTitle || !moduleName) continue;
      topicIdByKey.set(`${courseTitle}|${moduleName}|${row.name}`, row.id);
    }

    const confidenceRows = [];
    for (const key of confidenceKeys) {
      const parts = key.split('|');
      const topicId = parts.length === 3 ? topicIdByKey.get(key) : undefined;
      if (!topicId) {
        throw new Error(
          `[migrateToSupabase] could not resolve topic_confidence key "${key}" to a seeded topic — stopping migration, nothing was marked complete`
        );
      }
      confidenceRows.push({ user_id: userId, topic_id: topicId, level: confidence[key] });
    }

    const { error } = await supabase
      .from('topic_confidence')
      .upsert(confidenceRows, { onConflict: 'user_id,topic_id' });
    assertNoError('inserting topic confidence', error);
  }

  // ==========================================================================
  // 6) flashcard_srs_state
  // ---- FLASHCARD INDEX MAPPING --------------------------------------------
  // Local keys are stringified indexes ("0".."9") into the original CARDS
  // array from data/flashcards.js. The `flashcards` table has no
  // `position`/`created_at` column to order by, and per the requirement to
  // "never assume UUID ordering," we don't sort by `id` either. Instead we
  // match each of the 10 known CARDS[i][0] front-texts (imported directly
  // from data/flashcards.js -- the same file Phase 3C was seeded from)
  // against `front`, which carries a UNIQUE constraint. That gives an exact
  // index -> id mapping with no dependency on row insertion order at all.
  // ==========================================================================
  const cards = state.cards ?? {};
  const cardKeys = Object.keys(cards);
  if (cardKeys.length) {
    const { data: flashcardRows, error: flashcardsError } = await supabase
      .from('flashcards')
      .select('id, front');
    assertNoError('fetching flashcards for SRS index mapping', flashcardsError);

    if (!flashcardRows || flashcardRows.length !== CARDS.length) {
      throw new Error(
        `[migrateToSupabase] expected ${CARDS.length} seeded flashcards, found ${flashcardRows?.length ?? 0}`
      );
    }

    const idByFront = new Map(flashcardRows.map(r => [r.front, r.id]));
    const indexToId = CARDS.map(([front]) => {
      const id = idByFront.get(front);
      if (!id) {
        throw new Error(`[migrateToSupabase] seeded flashcards is missing expected card: "${front}"`);
      }
      return id;
    });

    const srsRows = [];
    for (const key of cardKeys) {
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || index >= CARDS.length) {
        throw new Error(
          `[migrateToSupabase] flashcard SRS index "${key}" is outside the expected 0-${CARDS.length - 1} range — stopping migration`
        );
      }
      const entry = cards[key];
      srsRows.push({
        user_id: userId,
        card_id: indexToId[index],
        ease: entry.ease,
        interval_days: entry.interval,
        reps: entry.reps,
        // See dateStringFromDayIndex() above for why this can't be naive
        // epoch arithmetic.
        due_date: dateStringFromDayIndex(entry.due)
      });
    }

    const { error } = await supabase
      .from('flashcard_srs_state')
      .upsert(srsRows, { onConflict: 'user_id,card_id' });
    assertNoError('inserting flashcard SRS state', error);
  }

  // ==========================================================================
  // 7) quiz_attempts
  // ---- QUIZ TIMESTAMP LIMITATION ------------------------------------------
  // The local `when` value (e.g. "07 Sep") has no year and no time of day,
  // so it cannot be converted into a real timestamp without guessing one.
  // Per requirement H, we deliberately do NOT invent a historical date --
  // every migrated attempt is stamped with the migration's own time. This
  // is a known, disclosed loss of precision, not a bug.
  // ==========================================================================
  const attempts = state.attempts ?? [];
  if (attempts.length && !(await tableAlreadyHasRows('quiz_attempts', userId))) {
    const migratedAt = new Date().toISOString();
    const rows = attempts.map(a => ({
      user_id: userId,
      mode: a.mode,
      correct: a.correct,
      total: a.total,
      pct: a.pct,
      submitted_at: migratedAt
    }));
    const { error } = await supabase.from('quiz_attempts').insert(rows);
    assertNoError('inserting quiz attempts', error);
  }

  // quiz_attempt_answers and badge_awards intentionally receive nothing --
  // there is no historical localStorage data for either. They will start
  // filling in once the app itself is later switched to write to Supabase.

  // ==========================================================================
  // 8) mark migration complete
  // Only reached if every step above completed without throwing. If any
  // step above failed, its error already propagated out of this function
  // and this line never runs -- migrated_at stays null, so a later retry
  // is expected to try the whole thing again from the top.
  //
  // A retry is safe: topic_confidence and flashcard_srs_state use a real
  // upsert against their primary key, and tasks/notes/study_sessions/
  // quiz_attempts are each guarded by tableAlreadyHasRows() above, which a
  // retry will find already populated and skip -- so no step can insert
  // its rows twice.
  // ==========================================================================
  const finishedAt = new Date().toISOString();
  const { error: completeError } = await supabase
    .from('profiles')
    .update({ migrated_at: finishedAt })
    .eq('id', userId);
  assertNoError('marking profile as migrated', completeError);

  return { status: 'migrated', migratedAt: finishedAt };
}
