-- ============================================================================
-- Phase 23: custom syllabus topics (confidence-tracking only)
--
-- Scope, deliberately: a custom topic participates in mastery/confidence
-- tracking (Syllabus.jsx, weakest/strongest areas, badges) exactly like a
-- seeded topic, and syncs to the cloud for signed-in users. It is NOT
-- linkable from notes/tasks/study_sessions/custom_flashcards' "attach to a
-- topic" pickers -- those keep working only against the shared, seeded
-- public.topics table, completely unchanged by this migration. Extending
-- linking to custom topics too would need a topic_id FK that can point at
-- either public.topics or this new table, which a single Postgres FK
-- column can't express without either dropping referential integrity on
-- four already-working tables or duplicating each of them -- out of
-- proportion to the value for this phase.
--
-- This migration is purely additive to every existing table except one
-- constraint drop, explained below. No existing data, policy, or app code
-- outside the confidence-tracking path is touched.
-- ============================================================================

create table if not exists public.custom_topics (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  level        text not null,
  module_name  text not null,
  name         text not null,
  description  text,
  created_at   timestamptz not null default now()
);
create index if not exists custom_topics_user_level_idx on public.custom_topics(user_id, level);

alter table public.custom_topics enable row level security;

create policy "custom_topics_select_own" on public.custom_topics
  for select using (auth.uid() = user_id);
create policy "custom_topics_insert_own" on public.custom_topics
  for insert with check (auth.uid() = user_id);
create policy "custom_topics_update_own" on public.custom_topics
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "custom_topics_delete_own" on public.custom_topics
  for delete using (auth.uid() = user_id);

-- topic_confidence.topic_id currently has a FK to public.topics(id) only --
-- see 20260907_phase3b_schema.sql. A confidence mark against a custom
-- topic needs to store a custom_topics.id there instead, and a single FK
-- column can't reference two different tables. Dropping the FK (rather
-- than duplicating topic_confidence for custom topics) keeps the existing,
-- tested read/write path in cloudData.js exactly as-is -- it already
-- treats keyToTopicId/topicIdToKey as opaque maps built by the caller;
-- app/src/lib/cloudData.js's fetchTopicConfidence() is the only place that
-- builds them, and is updated (in the same phase as this migration) to
-- merge the user's own custom_topics into those maps alongside the shared
-- public.topics rows. Row ownership stays fully enforced by RLS regardless
-- of the FK; only cross-table referential integrity on this one column is
-- given up. A custom topic's confidence row is deleted explicitly by
-- cloudDeleteCustomTopic() when the topic itself is deleted, since there's
-- no more FK to cascade that automatically.
--
-- Verify the exact constraint name before running against a real database
-- if this project's Postgres ever auto-named it differently:
--   select conname from pg_constraint
--   where conrelid = 'public.topic_confidence'::regclass and contype = 'f';
alter table public.topic_confidence
  drop constraint if exists topic_confidence_topic_id_fkey;
