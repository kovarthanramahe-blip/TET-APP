-- ============================================================================
-- Phase 37: week-ahead planner.
--
-- A plan item is a single "study this module, for this many minutes, on
-- this date" suggestion -- generated client-side from the user's existing
-- weakest-areas ranking (confidence + quiz accuracy, see
-- modulePerformance() in logic.js) and daily goal minutes, then persisted
-- here so it can be checked off or deleted like a task. module_name is
-- stored as plain text (not a topic_id FK) because generation only ever
-- reasons at module granularity, the same level modulePerformance()
-- already ranks at -- there is no per-topic suggestion to link to.
--
-- Treated as user-authored content once generated, same as
-- custom_topics/custom_flashcards: "Reset my progress" does not touch it.
-- ============================================================================

create table if not exists public.plan_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  plan_date    date not null,
  module_name  text not null,
  minutes_goal integer not null default 30,
  done         boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists plan_items_user_date_idx on public.plan_items(user_id, plan_date);

alter table public.plan_items enable row level security;

create policy "plan_items_select_own" on public.plan_items
  for select using (auth.uid() = user_id);
create policy "plan_items_insert_own" on public.plan_items
  for insert with check (auth.uid() = user_id);
create policy "plan_items_update_own" on public.plan_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "plan_items_delete_own" on public.plan_items
  for delete using (auth.uid() = user_id);
