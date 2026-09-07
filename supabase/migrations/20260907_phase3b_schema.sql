-- ============================================================================
-- HTET Preparation — Phase 3B schema migration
-- Creates tables + Row Level Security ONLY.
-- Does NOT seed reference data. Does NOT touch any application code.
-- Safe to run once on a fresh Supabase project (idempotent guards included).
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- SECTION 1 — profiles (user-owned: identity + settings, one row per user)
-- ============================================================================
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  theme             text not null default 'light' check (theme in ('light','dark')),
  exam_level        text not null default 'Level 1 (PRT)',
  pomodoro_minutes  int  not null default 25 check (pomodoro_minutes between 5 and 60),
  break_minutes     int  not null default 5  check (break_minutes between 2 and 20),
  show_quotes       boolean not null default true,
  migrated_at       timestamptz,
  created_at        timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);

-- Auto-create a profile row the moment someone signs up, so the app never
-- has to worry about a missing profile for a logged-in user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- SECTION 2 — Reference content: courses -> modules -> topics
-- (shared across all users; read-only for regular users)
-- ============================================================================
create table if not exists public.courses (
  id        uuid primary key default gen_random_uuid(),
  title     text not null unique,
  position  int  not null default 0
);

create table if not exists public.modules (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses(id) on delete cascade,
  name         text not null,
  marks_weight int  not null default 0,
  position     int  not null default 0,
  unique (course_id, name)
);
create index if not exists modules_course_id_idx on public.modules(course_id);

create table if not exists public.topics (
  id           uuid primary key default gen_random_uuid(),
  module_id    uuid not null references public.modules(id) on delete cascade,
  name         text not null,
  description  text,
  position     int  not null default 0,
  unique (module_id, name)
);
create index if not exists topics_module_id_idx on public.topics(module_id);

alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.topics  enable row level security;

create policy "courses_select_all" on public.courses for select using (true);
create policy "modules_select_all" on public.modules for select using (true);
create policy "topics_select_all"  on public.topics  for select using (true);
-- No insert/update/delete policies on these three tables for any regular
-- role -> normal users are physically unable to write to them. Only a
-- service-role key (which bypasses RLS) can manage this content.

-- ============================================================================
-- SECTION 3 — topic_confidence (user-owned: mastery marks per topic)
-- ============================================================================
create table if not exists public.topic_confidence (
  user_id     uuid not null references auth.users(id) on delete cascade,
  topic_id    uuid not null references public.topics(id) on delete cascade,
  level       smallint not null default 0 check (level between 0 and 3),
  updated_at  timestamptz not null default now(),
  primary key (user_id, topic_id)
);

alter table public.topic_confidence enable row level security;

create policy "topic_confidence_select_own" on public.topic_confidence
  for select using (auth.uid() = user_id);
create policy "topic_confidence_insert_own" on public.topic_confidence
  for insert with check (auth.uid() = user_id);
create policy "topic_confidence_update_own" on public.topic_confidence
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "topic_confidence_delete_own" on public.topic_confidence
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- SECTION 4 — study_sessions (user-owned)
-- ============================================================================
create table if not exists public.study_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  label       text not null,
  minutes     int  not null check (minutes >= 0),
  local_date  date not null,
  source      text check (source in ('pomodoro','deep_work','stopwatch','manual')),
  topic_id    uuid references public.topics(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists study_sessions_user_date_idx
  on public.study_sessions(user_id, local_date);

alter table public.study_sessions enable row level security;

create policy "study_sessions_select_own" on public.study_sessions
  for select using (auth.uid() = user_id);
create policy "study_sessions_insert_own" on public.study_sessions
  for insert with check (auth.uid() = user_id);
create policy "study_sessions_update_own" on public.study_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "study_sessions_delete_own" on public.study_sessions
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- SECTION 5 — tasks (user-owned)
-- ============================================================================
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  priority    text not null default 'Medium' check (priority in ('High','Medium','Low')),
  due_date    date,
  done        boolean not null default false,
  topic_id    uuid references public.topics(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists tasks_user_done_due_idx
  on public.tasks(user_id, done, due_date);

alter table public.tasks enable row level security;

create policy "tasks_select_own" on public.tasks
  for select using (auth.uid() = user_id);
create policy "tasks_insert_own" on public.tasks
  for insert with check (auth.uid() = user_id);
create policy "tasks_update_own" on public.tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks_delete_own" on public.tasks
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- SECTION 6 — notes (user-owned)
-- ============================================================================
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'Untitled',
  topic_label text,
  topic_id    uuid references public.topics(id) on delete set null,
  body_md     text not null default '',
  updated_at  timestamptz not null default now()
);
create index if not exists notes_user_id_idx on public.notes(user_id);

alter table public.notes enable row level security;

create policy "notes_select_own" on public.notes
  for select using (auth.uid() = user_id);
create policy "notes_insert_own" on public.notes
  for insert with check (auth.uid() = user_id);
create policy "notes_update_own" on public.notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes_delete_own" on public.notes
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- SECTION 7 — quiz_questions (shared reference content)
-- ============================================================================
create table if not exists public.quiz_questions (
  id             uuid primary key default gen_random_uuid(),
  type           text not null check (type in ('mcq','tf','fib','sa')),
  part           text not null,
  question_text  text not null,
  options        jsonb,
  answer         jsonb not null,
  explanation    text not null,
  unique (part, question_text)
);
create index if not exists quiz_questions_part_type_idx
  on public.quiz_questions(part, type);

alter table public.quiz_questions enable row level security;
create policy "quiz_questions_select_all" on public.quiz_questions
  for select using (true);
-- No write policies for regular users.

-- ============================================================================
-- SECTION 8 — quiz_attempts + quiz_attempt_answers (user-owned)
-- ============================================================================
create table if not exists public.quiz_attempts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  mode           text not null check (mode in ('Practice','Mock exam')),
  correct        int  not null check (correct >= 0),
  total          int  not null check (total >= 0),
  pct            int  not null check (pct between 0 and 100),
  question_ids   uuid[],
  submitted_at   timestamptz not null default now()
);
create index if not exists quiz_attempts_user_submitted_idx
  on public.quiz_attempts(user_id, submitted_at desc);

alter table public.quiz_attempts enable row level security;

create policy "quiz_attempts_select_own" on public.quiz_attempts
  for select using (auth.uid() = user_id);
create policy "quiz_attempts_insert_own" on public.quiz_attempts
  for insert with check (auth.uid() = user_id);
create policy "quiz_attempts_update_own" on public.quiz_attempts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "quiz_attempts_delete_own" on public.quiz_attempts
  for delete using (auth.uid() = user_id);

-- user_id is intentionally duplicated here (not just reachable via
-- attempt_id -> quiz_attempts.user_id) so RLS policies are a direct,
-- un-bypassable column check rather than a join/subquery.
create table if not exists public.quiz_attempt_answers (
  attempt_id   uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id  uuid not null references public.quiz_questions(id) on delete restrict,
  user_id      uuid not null references auth.users(id) on delete cascade,
  response     jsonb,
  is_correct   boolean not null default false,
  primary key (attempt_id, question_id)
);
create index if not exists quiz_attempt_answers_user_id_idx
  on public.quiz_attempt_answers(user_id);

alter table public.quiz_attempt_answers enable row level security;

create policy "quiz_attempt_answers_select_own" on public.quiz_attempt_answers
  for select using (auth.uid() = user_id);
create policy "quiz_attempt_answers_insert_own" on public.quiz_attempt_answers
  for insert with check (auth.uid() = user_id);
create policy "quiz_attempt_answers_update_own" on public.quiz_attempt_answers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "quiz_attempt_answers_delete_own" on public.quiz_attempt_answers
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- SECTION 9 — flashcards (shared reference) + flashcard_srs_state (user-owned)
-- ============================================================================
create table if not exists public.flashcards (
  id         uuid primary key default gen_random_uuid(),
  front      text not null,
  back       text not null,
  category   text not null,
  topic_id   uuid references public.topics(id) on delete set null
);

alter table public.flashcards enable row level security;
create policy "flashcards_select_all" on public.flashcards
  for select using (true);
-- No write policies for regular users.

create table if not exists public.flashcard_srs_state (
  user_id        uuid not null references auth.users(id) on delete cascade,
  card_id        uuid not null references public.flashcards(id) on delete cascade,
  ease           numeric(3,2) not null default 2.5 check (ease between 1.3 and 3.0),
  interval_days  int not null default 0 check (interval_days >= 0),
  reps           int not null default 0 check (reps >= 0),
  due_date       date not null default current_date,
  primary key (user_id, card_id)
);
create index if not exists flashcard_srs_state_user_due_idx
  on public.flashcard_srs_state(user_id, due_date);

alter table public.flashcard_srs_state enable row level security;

create policy "flashcard_srs_state_select_own" on public.flashcard_srs_state
  for select using (auth.uid() = user_id);
create policy "flashcard_srs_state_insert_own" on public.flashcard_srs_state
  for insert with check (auth.uid() = user_id);
create policy "flashcard_srs_state_update_own" on public.flashcard_srs_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "flashcard_srs_state_delete_own" on public.flashcard_srs_state
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- SECTION 10 — badge_defs (shared reference) + badge_awards (user-owned)
-- ============================================================================
create table if not exists public.badge_defs (
  id           text primary key,
  name         text not null unique,
  description  text not null,
  metric       text not null check (
    metric in ('sessions','hours','streak','best','mastered','tasksDone','reviews')
  ),
  target       int not null check (target > 0)
);

alter table public.badge_defs enable row level security;
create policy "badge_defs_select_all" on public.badge_defs
  for select using (true);
-- No write policies for regular users.

-- user_id is a direct column here too (this table's PK already includes it,
-- so its RLS policies are already a direct check, not a join).
create table if not exists public.badge_awards (
  user_id     uuid not null references auth.users(id) on delete cascade,
  badge_id    text not null references public.badge_defs(id) on delete restrict,
  awarded_at  timestamptz not null default now(),
  primary key (user_id, badge_id)
);
create index if not exists badge_awards_user_id_idx on public.badge_awards(user_id);

alter table public.badge_awards enable row level security;

create policy "badge_awards_select_own" on public.badge_awards
  for select using (auth.uid() = user_id);
create policy "badge_awards_insert_own" on public.badge_awards
  for insert with check (auth.uid() = user_id);
create policy "badge_awards_update_own" on public.badge_awards
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "badge_awards_delete_own" on public.badge_awards
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- End of Phase 3B migration. No reference data seeded. No localStorage
-- migration performed. No application code touched.
-- ============================================================================
