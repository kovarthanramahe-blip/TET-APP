-- ============================================================================
-- Phase 8, step 1 — study goal & exam countdown fields on profiles
-- Additive only, same low-risk shape as
-- 20260908c_add_profiles_reviews_column.sql: profiles already has full
-- select/insert/update/delete RLS scoped to auth.uid() = id, and that
-- already covers every column on the table, these two included -- no
-- policy changes needed.
-- ============================================================================

alter table public.profiles
  add column if not exists exam_date date,
  add column if not exists daily_goal_minutes int not null default 60 check (daily_goal_minutes >= 0);
