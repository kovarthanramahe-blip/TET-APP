-- ============================================================================
-- Phase 6, step 3 (schema only) — custom_flashcards
-- The existing `flashcards` table is shared, read-only reference data: no
-- user_id column, no write policies for regular users (see
-- 20260907_phase3b_schema.sql), and cloudData.js hard-asserts its row count
-- equals the seeded deck's fixed length. It cannot hold user-created cards
-- without breaking that. This is a new, separate, user-owned table instead
-- -- same ownership/RLS shape as tasks/notes -- content and SM-2 scheduling
-- fields live together in one row (unlike the seeded deck's split between
-- `flashcards` and `flashcard_srs_state`), since a custom card is always
-- 1:1 with the single user who created it; there is no shared reference
-- copy to keep separate from per-user progress.
--
-- This migration is schema only. No application code reads or writes this
-- table yet -- that is a later step.
-- ============================================================================

create table if not exists public.custom_flashcards (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  front         text not null,
  back          text not null,
  category      text not null,
  topic_id      uuid references public.topics(id) on delete set null,
  ease          numeric(3,2) not null default 2.5 check (ease between 1.3 and 3.0),
  interval_days int not null default 0 check (interval_days >= 0),
  reps          int not null default 0 check (reps >= 0),
  due_date      date not null default current_date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists custom_flashcards_user_due_idx
  on public.custom_flashcards(user_id, due_date);

alter table public.custom_flashcards enable row level security;

create policy "custom_flashcards_select_own" on public.custom_flashcards
  for select using (auth.uid() = user_id);
create policy "custom_flashcards_insert_own" on public.custom_flashcards
  for insert with check (auth.uid() = user_id);
create policy "custom_flashcards_update_own" on public.custom_flashcards
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "custom_flashcards_delete_own" on public.custom_flashcards
  for delete using (auth.uid() = user_id);
