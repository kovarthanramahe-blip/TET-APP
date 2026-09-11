-- ============================================================================
-- HTET Preparation — Phase 3B follow-up fix
-- Closes a data-integrity gap in quiz_attempt_answers: the current
-- single-column FK on attempt_id only checks that the attempt EXISTS, not
-- that it belongs to the same user_id on the answer row. RLS alone cannot
-- express that cross-table rule (a policy only ever inspects columns on
-- the row in front of it). A composite foreign key makes Postgres itself
-- enforce it on every insert and update.
--
-- Safe to run once, after the Phase 3B schema migration.
-- Adds constraints only. Does not touch data, RLS policies, or any other
-- table.
-- ============================================================================

-- 1) Give Postgres something to point a composite FK at. `id` alone is
--    already unique (it's the primary key) so this adds no real
--    restriction beyond exposing the pair for the FK below.
alter table public.quiz_attempts
  add constraint quiz_attempts_id_user_id_key unique (id, user_id);

-- 2) Before dropping the old single-column FK, confirm its exact name —
--    it should be the Postgres-generated default below, but verify with:
--      select conname from pg_constraint
--      where conrelid = 'public.quiz_attempt_answers'::regclass and contype = 'f';
alter table public.quiz_attempt_answers
  drop constraint if exists quiz_attempt_answers_attempt_id_fkey;

-- 3) Replace it with a composite FK: attempt_id AND user_id together must
--    match a real (id, user_id) pair on quiz_attempts. This is what makes
--    "insert an answer under someone else's attempt_id" impossible, even
--    if the RLS check on user_id alone would have allowed the row.
alter table public.quiz_attempt_answers
  add constraint quiz_attempt_answers_attempt_user_fkey
    foreign key (attempt_id, user_id)
    references public.quiz_attempts (id, user_id)
    on delete cascade;

-- ============================================================================
-- End of fix. quiz_questions FK on question_id, and the user_id -> auth.users
-- FK, are unaffected and unchanged.
-- ============================================================================
