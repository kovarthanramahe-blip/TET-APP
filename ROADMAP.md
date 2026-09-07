# HTET Preparation Platform

*Technical specification · v1*

A study-analytics, self-assessment and content-management app for candidates preparing for the
Haryana Teacher Eligibility Test — Levels 1 (PRT), 2 (TGT) and 3 (PGT).

The prototype in this project (and the `app/` implementation built from it) delivers the full
front-end surface against browser-local storage: dashboard analytics, a Pomodoro and manual
session log, a topic-level mastery heatmap over the real HTET syllabus, a quiz builder with
practice and timed mock modes, an SM-2 flashcard scheduler, a hierarchical syllabus manager, a
task agenda with deadline countdowns, a markdown notes hub, and streak and milestone
gamification. This document specifies the production system behind it: architecture, data
model, user flows, API surface, and a phased build plan. Anything already working in the
prototype is marked as such so the backend work can be scoped against real behaviour rather
than a wishlist.

## 1 · System architecture

| Layer | Choice | Why |
|---|---|---|
| Client | Next.js (App Router) + React, TypeScript, Tailwind or CSS variables; PWA manifest + service worker | Server components for analytics pages, offline-first study screens, one codebase for mobile web and desktop |
| State & cache | TanStack Query for server data; Zustand for timer/quiz session state; IndexedDB (Dexie) as offline mirror | Timers and quiz attempts must survive refresh and offline use |
| API | Node (NestJS or Next route handlers), REST + JSON; Zod validation | Simple resource shapes; easy to add a mobile client later |
| Auth | OAuth 2.0 (Google) + email magic link, short-lived JWT access token (15 min) with rotating refresh token in httpOnly cookie | Zero password storage; safe on shared devices |
| Database | PostgreSQL (Prisma). JSONB for quiz payloads and note bodies | Relational integrity for attempts and study logs; JSONB where the shape varies |
| Jobs | Redis + BullMQ: SRS due-date rollups, streak recompute at local midnight, weekly digest email | Keeps read paths cheap |
| Analytics store | Nightly materialised view `daily_study_rollup` | Dashboard reads one row per day, not every session |
| Privacy | Local-only mode (no account, IndexedDB only) or opt-in sync; notes encrypted at rest; full export and hard delete | Personal study data stays the user's |

```
Client (Next.js PWA)
  ├─ /dashboard  /study  /syllabus  /tasks  /tests  /cards  /notes  /achievements
  ├─ Zustand session store ──► IndexedDB (offline queue)
  └─ TanStack Query ──► REST /api/v1 ──► NestJS
                                          ├─ Auth (OAuth + JWT rotation)
                                          ├─ Domain services (study, srs, quiz, content)
                                          ├─ PostgreSQL (Prisma)
                                          └─ Redis + BullMQ (rollups, streaks, digests)
```

## 2 · Data model

Entity relationships, then the same schema as JSON. Content is hierarchical
(course → module → topic → sub-topic); everything a user produces hangs off `user_id`.

```
user 1─n course 1─n module 1─n topic 1─n subtopic
user 1─n study_session          topic 1─n topic_confidence n─1 user
user 1─n task            (task n─1 topic, optional)
user 1─n note            (note n─1 topic|module|course, optional)
user 1─n quiz_attempt 1─n attempt_answer n─1 question n─1 topic
user 1─n card_state n─1 flashcard n─1 topic
user 1─n badge_award n─1 badge_def
user 1─1 streak_state
```

```json
{
  "user":            { "id":"uuid", "email":"string", "name":"string", "auth_provider":"google|email",
                       "exam_level":"L1|L2|L3", "target_exam_date":"date", "daily_goal_minutes":"int",
                       "theme":"light|dark|system", "timezone":"string", "created_at":"timestamptz" },
  "course":          { "id":"uuid", "user_id":"uuid|null", "title":"string", "exam_level":"L1|L2|L3",
                       "is_template":"bool", "position":"int" },
  "module":          { "id":"uuid", "course_id":"uuid", "title":"string", "marks_weight":"int", "position":"int" },
  "topic":           { "id":"uuid", "module_id":"uuid", "title":"string", "position":"int",
                       "est_minutes":"int" },
  "subtopic":        { "id":"uuid", "topic_id":"uuid", "title":"string", "position":"int" },
  "topic_confidence":{ "user_id":"uuid", "topic_id":"uuid", "level":"0|1|2|3",
                       "updated_at":"timestamptz", "PK":["user_id","topic_id"] },
  "study_session":   { "id":"uuid", "user_id":"uuid", "topic_id":"uuid|null", "label":"string",
                       "source":"pomodoro|stopwatch|manual", "minutes":"int",
                       "started_at":"timestamptz", "ended_at":"timestamptz", "local_date":"date" },
  "task":            { "id":"uuid", "user_id":"uuid", "topic_id":"uuid|null", "title":"string",
                       "priority":"high|medium|low", "due_date":"date|null",
                       "status":"open|done", "completed_at":"timestamptz|null" },
  "note":            { "id":"uuid", "user_id":"uuid", "scope_type":"course|module|topic",
                       "scope_id":"uuid", "title":"string", "body_md":"text",
                       "updated_at":"timestamptz" },
  "question":        { "id":"uuid", "topic_id":"uuid", "type":"mcq|tf|fib|short",
                       "stem":"text", "options":"jsonb|null", "answer":"jsonb",
                       "explanation":"text", "difficulty":"1-5", "language":"en|hi",
                       "source":"official|authored|imported" },
  "quiz_attempt":    { "id":"uuid", "user_id":"uuid", "mode":"practice|mock",
                       "config":"jsonb", "question_ids":"uuid[]", "duration_seconds":"int",
                       "score":"int", "total":"int", "percent":"numeric",
                       "started_at":"timestamptz", "submitted_at":"timestamptz|null" },
  "attempt_answer":  { "attempt_id":"uuid", "question_id":"uuid", "response":"jsonb",
                       "is_correct":"bool", "seconds_spent":"int", "locked":"bool",
                       "PK":["attempt_id","question_id"] },
  "flashcard":       { "id":"uuid", "topic_id":"uuid", "front":"text", "back":"text",
                       "user_id":"uuid|null" },
  "card_state":      { "user_id":"uuid", "card_id":"uuid", "ease":"numeric(3,2)",
                       "interval_days":"int", "repetitions":"int", "lapses":"int",
                       "due_date":"date", "last_grade":"0-3", "PK":["user_id","card_id"] },
  "streak_state":    { "user_id":"uuid", "current":"int", "longest":"int",
                       "last_active_date":"date" },
  "badge_def":       { "id":"slug", "name":"string", "description":"string",
                       "metric":"hours|sessions|streak|best_score|mastered|tasks_done|reviews",
                       "threshold":"int" },
  "badge_award":     { "user_id":"uuid", "badge_id":"slug", "awarded_at":"timestamptz",
                       "PK":["user_id","badge_id"] },
  "daily_study_rollup": { "user_id":"uuid", "local_date":"date", "minutes":"int",
                       "sessions":"int", "tasks_completed":"int", "reviews":"int",
                       "PK":["user_id","local_date"] }
}
```

Indexes: `study_session(user_id, local_date)`, `task(user_id, status, due_date)`,
`card_state(user_id, due_date)`, `question(topic_id, type)`, `attempt_answer(attempt_id)`.
Row-level security on every user-scoped table keyed to the JWT subject.

## 3 · Key user flows

| Flow | Steps | Edge cases |
|---|---|---|
| Create a module | Syllabus → choose course → Add module (title, marks weight) → add topics inline → optional sub-topics → auto-saved, position from drag order | Duplicate titles allowed; deleting a module soft-deletes and keeps its study sessions |
| Run a study session | Study → pick mode (25/5, 50/10, stopwatch) → optionally attach a topic → Start → focus phase ends → session posted, break auto-starts → cycle count and streak update | Tab closed mid-phase: elapsed time is recovered from the stored start timestamp, not a tick counter |
| Take a timed mock | Tests → pick types + parts + Mock → attempt created server-side with a server clock → answers lock on selection → auto-submit at zero → diagnostics by part → weak parts feed a suggested task | Refresh resumes from server `started_at`; offline submissions queue and reconcile on reconnect |
| Review flashcards | Cards → due queue → reveal → grade Again/Hard/Good/Easy → SM-2 updates ease and interval → next due card → queue empty state | Cards graded offline replay in order so intervals stay deterministic |
| View weekly analytics | Dashboard reads `daily_study_rollup` for the last 7/30 days → hours, streak, task completion, best score, mastery heatmap, per-module progress | Timezone-correct day boundaries; days with no data render as empty, not zero-filled gaps |
| Mark mastery | Syllabus → tap a topic to cycle needs-work → moderate → mastered → heatmap and module progress recompute; mastered topics de-prioritised in quiz generation | Confidence is per user per level, never global |

## 4 · Core API endpoints

| Method & path | Purpose | Notes |
|---|---|---|
| `POST /api/v1/auth/oauth/:provider` | Exchange provider code for tokens | Returns access JWT + sets refresh cookie |
| `POST /api/v1/auth/refresh` | Rotate refresh token | Reuse detection revokes the family |
| `GET /api/v1/courses?level=L1&expand=modules.topics` | Syllabus tree | ETag cached; templates seeded per level |
| `POST /api/v1/courses/:id/modules` | Create module | `PATCH` for rename/reorder, `DELETE` soft-deletes |
| `PUT /api/v1/topics/:id/confidence` | Set mastery level 0–3 | Idempotent upsert |
| `POST /api/v1/sessions` | Log a study session | Accepts a client `idempotency_key` for offline replay |
| `GET /api/v1/analytics/summary?range=7d` | Dashboard payload | Hours, streak, completion rate, per-module progress |
| `GET /api/v1/analytics/heatmap?level=L1` | Topic-by-topic confidence grid | One row per topic |
| `GET /api/v1/tasks?status=open` · `POST` · `PATCH /:id` | Task agenda | `PATCH` toggles status and stamps `completed_at` |
| `GET /api/v1/notes?scope_type=topic&scope_id=…` · `PUT /:id` | Notes hub | Markdown body; last-write-wins with `updated_at` guard |
| `POST /api/v1/quizzes/generate` | Build a question set from types, parts, count, difficulty | Excludes recently-seen and mastered-topic questions |
| `POST /api/v1/attempts` | Start an attempt (server clock) | Returns `attempt_id`, question payload without answers |
| `PUT /api/v1/attempts/:id/answers/:qid` | Record one answer | Rejects writes to a locked answer in mock mode |
| `POST /api/v1/attempts/:id/submit` | Grade and close | Returns score, per-part diagnostics, explanations |
| `GET /api/v1/cards/due?limit=20` | SRS queue | Ordered by due date then lapses |
| `POST /api/v1/cards/:id/review` | Grade a card (0–3) | Returns new ease, interval, due date |
| `GET /api/v1/achievements` | Badges and streak state | Server-authoritative; client never grants a badge |
| `GET /api/v1/export` · `DELETE /api/v1/me` | Data export and account deletion | JSON archive; hard delete within 30 days |

## 5 · Starter code

**Pomodoro timer** — a hook driven by wall-clock deadlines rather than a decrementing counter,
so a throttled or backgrounded tab cannot drift.

```typescript
// usePomodoro.ts
import { useEffect, useRef, useState } from "react";

type Phase = "focus" | "break";
const LEN = { focus: 25 * 60, break: 5 * 60 };   // seconds

export function usePomodoro(onFocusComplete: (mins: number) => void) {
  const [phase, setPhase] = useState<Phase>("focus");
  const [remaining, setRemaining] = useState(LEN.focus);
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState(0);
  const deadline = useRef<number | null>(null);   // epoch ms

  // Restore an in-flight phase after a refresh.
  useEffect(() => {
    const saved = localStorage.getItem("pomodoro");
    if (!saved) return;
    const s = JSON.parse(saved);
    if (s.deadline > Date.now()) {
      deadline.current = s.deadline;
      setPhase(s.phase);
      setRunning(true);
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    if (deadline.current == null) deadline.current = Date.now() + remaining * 1000;
    localStorage.setItem("pomodoro",
      JSON.stringify({ phase, deadline: deadline.current }));

    const id = setInterval(() => {
      const left = Math.round((deadline.current! - Date.now()) / 1000);
      if (left > 0) { setRemaining(left); return; }
      // phase complete
      clearInterval(id);
      deadline.current = null;
      localStorage.removeItem("pomodoro");
      if (phase === "focus") {
        onFocusComplete(LEN.focus / 60);          // POST /api/v1/sessions
        setCycles(c => c + 1);
        setPhase("break");
        setRemaining(LEN.break);                  // break auto-runs
      } else {
        setPhase("focus");
        setRemaining(LEN.focus);
        setRunning(false);                        // wait for the user
      }
    }, 250);                                      // 250ms keeps the display honest
    return () => clearInterval(id);
  }, [running, phase]);

  return {
    phase, running, cycles,
    label: `${String(Math.floor(remaining / 60)).padStart(2, "0")}:` +
           `${String(remaining % 60).padStart(2, "0")}`,
    start: () => setRunning(true),
    pause: () => { setRunning(false); deadline.current = null; },
    reset: () => { setRunning(false); deadline.current = null; setRemaining(LEN[phase]); },
  };
}
```

**Spaced repetition** — SM-2 reduced to the four grades an Anki-style UI exposes. Pure
function: same inputs, same schedule, which is what makes offline replay safe.

```typescript
// srs.ts — SM-2 (SuperMemo 2), four-button variant
export type Grade = 0 | 1 | 2 | 3;                // again | hard | good | easy
export interface CardState {
  ease: number;          // 1.3 .. 3.0, starts 2.5
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueDate: string;       // YYYY-MM-DD
}

const Q = { 0: 2, 1: 3, 2: 4, 3: 5 } as const;    // grade → SM-2 quality
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const addDays = (days: number) =>
  new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

export function review(card: CardState, grade: Grade): CardState {
  const q = Q[grade];

  // Lapse: relearn from scratch, keep a slightly harder ease.
  if (q < 3) {
    return { ...card,
      ease: clamp(card.ease - 0.20, 1.3, 3.0),
      intervalDays: 0, repetitions: 0,
      lapses: card.lapses + 1, dueDate: addDays(0) };   // again today
  }

  // SM-2 ease update.
  const ease = clamp(
    card.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)), 1.3, 3.0);

  const reps = card.repetitions + 1;
  let interval: number;
  if (reps === 1) interval = 1;
  else if (reps === 2) interval = grade === 3 ? 4 : 3;
  else interval = Math.round(card.intervalDays * ease * (grade === 1 ? 0.6 : 1));
  interval = clamp(interval, 1, 365);

  return { ...card, ease, repetitions: reps,
           intervalDays: interval, dueDate: addDays(interval) };
}

export const dueToday = (cards: (CardState & { id: string })[]) => {
  const today = new Date().toISOString().slice(0, 10);
  return cards.filter(c => c.dueDate <= today)
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.lapses - a.lapses);
};
```

## 6 · Development roadmap

| Phase | Scope | Exit criteria |
|---|---|---|
| 0 · Prototype (done) | Full UI in one page against local storage — every module in this project's prototype | Flows validated with a real candidate before backend spend |
| 1 · Foundations (wk 1–2) | Repo, CI, Postgres + Prisma migrations, OAuth + JWT rotation, user profile, theme, seed HTET syllabus for all three levels | Sign in, see own seeded syllabus tree |
| 2 · Study tracking (wk 3–4) | Sessions API, Pomodoro/stopwatch/manual logging, streak job, `daily_study_rollup`, dashboard analytics | Hours, streak and 7-day chart correct across timezones |
| 3 · Content & tasks (wk 5–6) | Syllabus CRUD with drag reorder, confidence marking + heatmap, task agenda with countdowns, markdown notes attached to topics | A candidate can run a week of study entirely in-app |
| 4 · Assessment (wk 7–9) | Question bank + import tool, quiz generator, practice mode with explanations, mock mode with server clock and locked answers, per-part diagnostics | 150-question full mock runs end to end without drift |
| 5 · Retention (wk 10–11) | SM-2 scheduler, due queue, deck management, badges and streak rewards, weekly digest email | Deterministic scheduling verified by replay test |
| 6 · Offline & privacy (wk 12–13) | Service worker, IndexedDB mirror, idempotent offline queue, local-only mode, export and delete | A full session works in airplane mode and reconciles cleanly |
| 7 · Polish & launch (wk 14–15) | Accessibility pass, Hindi UI locale, performance budget, previous-year paper packs, analytics instrumentation | Lighthouse ≥ 90, WCAG AA, pilot cohort of 50 candidates |

**Risks.** Question-bank quality is the make-or-break input — budget editorial time, not just
engineering. Mock-exam timing must be server-authoritative from day one or scores become
disputable. Streak logic is timezone-sensitive and is the most common source of user-reported
bugs; test it with a fixed clock.
