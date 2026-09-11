-- ============================================================================
-- Phase 5, step 5 — add a reviews counter to profiles
-- Closes the local-only "reviews"/Card Shark cross-device gap disclosed in
-- the Phase 3E step 7 audit: the flashcard grading counter had no cloud
-- column, so a second device could show the badge as locked even when
-- truly earned. This is additive only -- no existing column, policy, or
-- row is touched.
-- ============================================================================

alter table public.profiles
  add column if not exists reviews int not null default 0 check (reviews >= 0);

-- No RLS policy changes needed: profiles already has select/insert/update/
-- delete policies scoped to auth.uid() = id, and those apply to every
-- column on the table, this one included.
