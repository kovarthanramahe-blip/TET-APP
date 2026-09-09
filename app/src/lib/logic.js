import { SYLLABUS } from '../data/syllabus.js';
import { BANK } from '../data/quizBank.js';
import { CARDS } from '../data/flashcards.js';
import { BADGE_DEFS } from '../data/badges.js';
import { QUOTES } from '../data/quotes.js';
import { today, dayIndex } from './dates.js';
import { readStoredState, writeStoredState, STORAGE_KEY } from './dataStore.js';

export { STORAGE_KEY };

export function seedState() {
  const seedDay = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  return {
    view: 'dash', theme: 'light', level: 'Level 1 (PRT)',
    confidence: {},
    sessions: [
      { label: 'Piaget & Vygotsky revision', mins: 50, date: seedDay(-1), topicId: 'Level 1 (PRT)|Child Development & Pedagogy|Theories of learning' },
      { label: 'Haryana GK — districts', mins: 25, date: seedDay(-1), topicId: null },
      { label: 'English grammar drill', mins: 75, date: seedDay(-2), topicId: null },
      { label: 'Quantitative aptitude set', mins: 40, date: seedDay(-3), topicId: null },
      { label: 'Hindi vyakaran', mins: 30, date: seedDay(-4), topicId: null },
      { label: 'Mock exam — Part I', mins: 60, date: seedDay(0), topicId: null }
    ],
    tasks: [
      { id: 't1', title: 'Finish Child Development ch. 3 — learning theories', priority: 'High', due: seedDay(1), done: false },
      { id: 't2', title: 'Attempt 30 questions of Haryana GK', priority: 'Medium', due: seedDay(2), done: false },
      { id: 't3', title: 'Revise passive voice and narration', priority: 'Low', due: seedDay(4), done: false },
      { id: 't4', title: 'Full-length mock exam under timed conditions', priority: 'High', due: seedDay(6), done: false }
    ],
    notes: [
      { id: 'n1', title: 'Learning theories cheat sheet', topic: 'CDP · Theories of learning', topicId: 'Level 1 (PRT)|Child Development & Pedagogy|Theories of learning', body: '# Learning theories\n\n**Piaget** — cognitive constructivism, four stages, *schema* / assimilation / accommodation.\n\n**Vygotsky** — social constructivism.\n\n- ZPD: gap between solo and assisted performance\n- Scaffolding fades as competence grows\n- Language precedes thought\n\n**Bruner** — spiral curriculum; enactive, iconic, symbolic.\n\n> HTET favours applied questions: given a classroom scene, name the theorist.' },
      { id: 'n2', title: 'Haryana GK — quick facts', topic: 'General Studies · Haryana GK', topicId: null, body: '# Haryana quick facts\n\n- Formed **1 November 1966**\n- Capital: Chandigarh\n- Districts: 22\n- Rivers: Yamuna, Ghaggar, Markanda\n- Folk dance: Ghoomar, Khoria\n\n`HTET tip:` one or two questions almost every year on formation and symbols.' }
    ],
    cards: {},
    customCards: [],
    attempts: [],
    reviews: 0,
    taskFilter: 'Open', taskDraft: '', taskDue: '', taskPriority: 'Medium',
    logLabel: '', logMinutes: 25, sessionTopicId: null,
    customCardFront: '', customCardBack: '', customCardCategory: '', customCardTopicId: null,
    customCardCurrentId: null, customCardRevealed: false,
    activeNote: 'n1',
    timerMode: 'Pomodoro 25/5', phase: 'focus', running: false, remaining: 1500, cycles: 0,
    quizStage: 'setup', quizTypes: ['mcq', 'tf'], quizParts: [], quizMode: 'Practice',
    quiz: null, qIndex: 0, answers: {}, textAnswer: '', mockLeft: 0, revealed: false,
    cardIndex: 0, cardRevealed: false,
    confirmReset: false,
    pomodoroMinutes: 25, breakMinutes: 5, showQuotes: true,
    examDate: null, dailyGoalMinutes: 60
  };
}

export function loadState() {
  const base = seedState();
  const stored = readStoredState();
  if (stored) return Object.assign(base, stored);
  return base;
}

export function saveState(state) {
  const s = Object.assign({}, state, {
    running: false,
    quizStage: state.quizStage === 'active' ? 'setup' : state.quizStage,
    quiz: null
  });
  writeStoredState(s);
}

export function focusMins(s) { return Math.max(1, Number(s.pomodoroMinutes ?? 25)); }
export function breakMins(s) { return Math.max(1, Number(s.breakMinutes ?? 5)); }

export function phaseLength(s, phase) {
  const m = s.timerMode;
  if (m === 'Stopwatch') return 0;
  if (m === 'Deep work 50/10') return phase === 'focus' ? 50 * 60 : 10 * 60;
  return (phase === 'focus' ? focusMins(s) : breakMins(s)) * 60;
}

export function logSessionState(s, label, mins, topicId) {
  return { ...s, sessions: [{ label, mins: Number(mins) || 0, date: today(), topicId: topicId || null }, ...s.sessions] };
}

export function finishPhaseState(s) {
  if (s.phase === 'focus') {
    const mins = Math.round(phaseLength(s, 'focus') / 60);
    const withLog = logSessionState(s, 'Pomodoro — ' + s.timerMode, mins, s.sessionTopicId);
    return { ...withLog, phase: 'break', remaining: phaseLength(s, 'break'), cycles: s.cycles + 1, running: true };
  }
  return { ...s, phase: 'focus', remaining: phaseLength(s, 'focus'), running: false };
}

export function minutesOn(s, date) {
  return s.sessions.filter(x => x.date === date).reduce((a, b) => a + b.mins, 0);
}

export function totalMinutes(s) {
  return s.sessions.reduce((a, b) => a + b.mins, 0);
}

export function streakCount(s) {
  let n = 0;
  for (let i = 0; i < 400; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    if (minutesOn(s, d) > 0) n++;
    else if (i > 0) break;
  }
  return n;
}

// Phase 11: same walk-backward-from-today shape as streakCount() above,
// just requiring the daily goal to be MET (not merely > 0) each day --
// feeds the new goal-streak achievement badges. dailyGoalMinutes always
// has a real value (defaults to 60 in seedState()), so this works the same
// way for a user who never explicitly visited the Dashboard's goal card.
export function goalStreakCount(s) {
  const goal = Math.max(1, Number(s.dailyGoalMinutes) || 60);
  let n = 0;
  for (let i = 0; i < 400; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    if (minutesOn(s, d) >= goal) n++;
    else if (i > 0) break;
  }
  return n;
}

export function modulesFor(s) { return SYLLABUS[s.level] || []; }
export function topicKey(level, m, t) { return level + '|' + m + '|' + t; }
export function confOf(s, m, t) { return s.confidence[topicKey(s.level, m, t)] || 0; }

// Phase 10: global search across the app's own content -- notes, tasks,
// custom flashcards, and syllabus topics for the CURRENT level (via
// modulesFor(s), the same level-scoping every other cross-cutting lookup
// in this file already uses). A plain case-insensitive substring match,
// same simplicity level as everything else here -- no fuzzy matching, no
// ranking beyond "which field matched," capped per category so the
// dropdown stays scannable rather than becoming a second scroll surface.
export function globalSearch(s, query) {
  const q = query.trim().toLowerCase();
  if (!q) return { notes: [], tasks: [], customCards: [], topics: [] };

  const notes = s.notes.filter(n => (n.title + ' ' + n.body).toLowerCase().includes(q)).slice(0, 6);
  const tasks = s.tasks.filter(t => t.title.toLowerCase().includes(q)).slice(0, 6);
  const customCards = s.customCards.filter(c => (c.front + ' ' + c.back + ' ' + c.category).toLowerCase().includes(q)).slice(0, 6);

  const topics = [];
  modulesFor(s).forEach(m => {
    m.topics.forEach(t => {
      if ((t[0] + ' ' + t[1]).toLowerCase().includes(q)) topics.push({ module: m.name, name: t[0], desc: t[1] });
    });
  });

  return { notes, tasks, customCards, topics: topics.slice(0, 6) };
}

// Phase 6, step 2: sessions carry a topicId built by topicKey(s.level, ...)
// (same key shape notes use), so a session only counts toward a module here
// if its key's level prefix matches the CURRENT level -- a session logged
// under a different level's module of the same name is not conflated with
// it, and falls into the Unlinked bucket below instead, same as a session
// with no topic at all. That keeps this always reconciling exactly against
// totalMinutes(s) for whichever level is active.
export function minutesByModule(s) {
  const prefix = s.level + '|';
  const totals = new Map(modulesFor(s).map(m => [m.name, 0]));
  let unlinked = 0;
  s.sessions.forEach(session => {
    const key = session.topicId;
    const moduleName = key && key.startsWith(prefix) ? key.slice(prefix.length).split('|')[0] : null;
    if (moduleName && totals.has(moduleName)) totals.set(moduleName, totals.get(moduleName) + session.mins);
    else unlinked += session.mins;
  });
  return modulesFor(s).map(m => ({ name: m.name, mins: totals.get(m.name) })).concat([{ name: 'Unlinked', mins: unlinked }]);
}

// Phase 7: generalizes the day-by-day loop Dashboard.jsx already built
// inline for its old fixed 7-day chart, so the same series backs both the
// 7/30/90-day trend chart and daysStudiedInRange() below without either
// walking the calendar twice.
export function dailyMinutesSeries(s, days) {
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    series.push({ date: d, iso, mins: minutesOn(s, iso) });
  }
  return series;
}

export function daysStudiedInRange(s, days) {
  return dailyMinutesSeries(s, days).filter(d => d.mins > 0).length;
}

// Non-overlapping rolling 7-day buckets ending today, most recent last --
// a coarser view of the same underlying sessions than streakCount() (which
// only tracks the single unbroken current streak) or dailyMinutesSeries()
// (which is daily, not weekly).
export function weeklyConsistency(s, weeks) {
  const out = [];
  for (let w = weeks - 1; w >= 0; w--) {
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const iso = new Date(Date.now() - (w * 7 + i) * 86400000).toISOString().slice(0, 10);
      if (minutesOn(s, iso) > 0) count++;
    }
    out.push({ label: w === 0 ? 'This wk' : w + 'w ago', daysStudied: count });
  }
  return out;
}

// Flat, topic-level companion to minutesByModule() -- same level-prefix
// matching rule (a session logged under a different level's topic of the
// same name never gets conflated with the current level's), just not
// rolled up to the module.
export function minutesByTopic(s) {
  const prefix = s.level + '|';
  const totals = new Map();
  s.sessions.forEach(session => {
    const key = session.topicId;
    if (key && key.startsWith(prefix)) totals.set(key, (totals.get(key) || 0) + session.mins);
  });
  return [...totals.entries()]
    .map(([key, mins]) => {
      const parts = key.split('|');
      return { key, module: parts[1], topic: parts[2], mins };
    })
    .sort((a, b) => b.mins - a.mins);
}

export function quizAverageScore(s) {
  return s.attempts.length ? Math.round(s.attempts.reduce((a, b) => a + b.pct, 0) / s.attempts.length) : 0;
}

export function quizPassRate(s) {
  return s.attempts.length ? Math.round((s.attempts.filter(a => a.pct >= 60).length / s.attempts.length) * 100) : 0;
}

// s.attempts is newest-first (submitQuizState() prepends); reverse the
// most recent `limit` so the trend chart reads oldest-to-newest, left to
// right, like the daily/weekly charts above.
export function quizTrend(s, limit) {
  return s.attempts.slice(0, limit).slice().reverse();
}

// The quiz builder's "parts of the paper" (Quiz.jsx's PART_OPTIONS /
// quiz_questions.part) match syllabus module names exactly for four of the
// five parts. The fifth, "Subject", is deliberately level-generic while its
// matching module name varies by level ("Subject — Maths & EVS" for PRT,
// "Subject — Social Studies" for TGT, "Subject specialisation (PGT)" for
// PGT) -- all three start with "Subject", which is what this normalizes on.
export function partForModule(moduleName) {
  return moduleName.startsWith('Subject') ? 'Subject' : moduleName;
}

// Combines confidence (available for every user, cloud or local) with quiz
// accuracy by part (available only where quizByPart has data -- see
// useQuizPartPerformance.js) into one ranked list, sorted weakest to
// strongest BY CONFIDENCE. quizPct stays null rather than 0 when there is
// no quiz history for that part, so a module the user simply hasn't tested
// yet is never shown as "0% quiz average" -- that would be inventing a
// score, not reporting one.
export function modulePerformance(s, quizByPart) {
  return modulesFor(s).map(m => {
    const done = m.topics.filter(t => confOf(s, m.name, t[0]) === 3).length;
    const confidencePct = Math.round((done / m.topics.length) * 100);
    const qp = quizByPart && quizByPart[partForModule(m.name)];
    const quizPct = qp && qp.total > 0 ? Math.round((qp.correct / qp.total) * 100) : null;
    return { name: m.name, confidencePct, quizPct, quizAttempts: qp ? qp.total : 0 };
  }).sort((a, b) => a.confidencePct - b.confidencePct);
}

// Phase 8: null when no exam date is set (never a fabricated countdown) --
// same dayIndex()-diff approach taskViewModel() already uses for task due
// dates, so a negative result (exam date already passed) reads the same
// way an overdue task does, not as a special case.
export function daysUntilExam(s) {
  if (!s.examDate) return null;
  return dayIndex(s.examDate) - dayIndex();
}

export function todayGoalProgress(s) {
  const goal = Math.max(1, Number(s.dailyGoalMinutes) || 60);
  const done = minutesOn(s, today());
  return { goal, done, pct: Math.min(100, Math.round((done / goal) * 100)) };
}

// Average daily minutes over the last 7 days vs. the same daily goal --
// reuses dailyMinutesSeries() rather than walking the calendar a third way.
export function weeklyGoalProgress(s) {
  const goal = Math.max(1, Number(s.dailyGoalMinutes) || 60);
  const series = dailyMinutesSeries(s, 7);
  const avg = Math.round(series.reduce((a, d) => a + d.mins, 0) / series.length);
  return { goal, avg, pct: Math.min(100, Math.round((avg / goal) * 100)) };
}

export function seededDeckProgress(s) {
  const total = CARDS.length;
  const reviewed = Object.values(s.cards).filter(c => (c?.reps || 0) > 0).length;
  const eases = Object.values(s.cards).map(c => c.ease);
  return {
    total, reviewed, dueNow: dueCards(s).length,
    avgEase: eases.length ? eases.reduce((a, b) => a + b, 0) / eases.length : 2.5
  };
}

export function customDeckProgress(s) {
  const total = s.customCards.length;
  const reviewed = s.customCards.filter(c => c.reps > 0).length;
  return {
    total, reviewed, dueNow: dueCustomCards(s).length,
    avgEase: total ? s.customCards.reduce((a, c) => a + c.ease, 0) / total : 2.5
  };
}

export function confColor(c) {
  if (c === 1) return '#b3392f';
  if (c === 2) return '#c28d41';
  if (c === 3) return '#3f7d4e';
  return 'var(--color-divider)';
}
export function confName(c) { return ['Untouched', 'Needs work', 'Moderate', 'Mastered'][c]; }

export function masteredCount(s) {
  let n = 0;
  modulesFor(s).forEach(m => m.topics.forEach(t => { if (confOf(s, m.name, t[0]) === 3) n++; }));
  return n;
}

export function cardState(s, i) {
  return s.cards[String(i)] || { ease: 2.5, interval: 0, reps: 0, due: dayIndex() };
}

export function dueCards(s) {
  const d = dayIndex();
  return CARDS.map((c, i) => i).filter(i => cardState(s, i).due <= d);
}

export function bestScore(s) {
  return s.attempts.reduce((a, b) => Math.max(a, b.pct), 0);
}

export function quoteFor(i) {
  return QUOTES[Math.abs(i) % QUOTES.length];
}

export function nextIntervalFor(cs, g) {
  if (!cs) return '';
  if (g === 0) return 'today';
  const reps = cs.reps + 1;
  const iv = reps === 1 ? 1 : reps === 2 ? 3 : Math.max(1, Math.round(cs.interval * cs.ease * (g === 1 ? 0.6 : 1)));
  return iv + 'd';
}

// The SM-2 transition itself, extracted so both the seeded deck's
// gradeState() and custom cards' gradeCustomCardState() (Phase 6, step 3)
// apply the exact same math to a { ease, interval, reps } shape without
// duplicating it -- a plain extraction, not a behavior change: gradeState()
// below computes byte-for-byte the same values it always did.
export function applySrsGrade(cs, g) {
  const c = { ...cs };
  if (g === 0) {
    c.reps = 0; c.interval = 0; c.ease = Math.max(1.3, c.ease - 0.2);
  } else {
    c.ease = Math.max(1.3, Math.min(3.0, c.ease + (g === 1 ? -0.15 : g === 2 ? 0 : 0.1)));
    c.reps += 1;
    c.interval = c.reps === 1 ? 1 : c.reps === 2 ? 3 : Math.max(1, Math.round(c.interval * c.ease * (g === 1 ? 0.6 : 1)));
  }
  c.due = dayIndex() + c.interval;
  return c;
}

export function gradeState(s, idx, g) {
  const c = applySrsGrade(cardState(s, idx), g);
  const cards = { ...s.cards, [String(idx)]: c };
  const next = { ...s, cards, reviews: s.reviews + 1, cardRevealed: false };
  const due = dueCards(next);
  return { ...next, cardIndex: due.length ? due[0] : -1 };
}

// Phase 6, step 3: custom cards store content and SM-2 fields together in
// one object (unlike the seeded deck's split between CARDS and s.cards),
// so grading finds-and-replaces the matching array entry directly rather
// than keying into a side map. Reuses s.reviews as the same "Card Shark"
// counter the seeded deck feeds -- reviewing is reviewing regardless of
// which deck a card came from.
export function dueCustomCards(s) {
  const d = dayIndex();
  return s.customCards.filter(c => c.due <= d);
}

export function gradeCustomCardState(s, id, g) {
  const customCards = s.customCards.map(c => (c.id === id ? applySrsGrade(c, g) : c));
  const next = { ...s, customCards, reviews: s.reviews + 1, customCardRevealed: false };
  const due = dueCustomCards(next);
  return { ...next, customCardCurrentId: due.length ? due[0].id : null };
}

// Mirrors addTask()'s local-mode CRUD shape (client-generated id, draft
// fields cleared on success) -- the cloud-active path instead goes through
// cloudAddCustomCard()/useCloudCustomCards.js, which never calls this.
// New cards start at the same fresh SM-2 defaults cardState() uses locally
// for a never-reviewed seeded card.
export function addCustomCardState(s) {
  if (!s.customCardFront.trim() || !s.customCardBack.trim()) return s;
  const card = {
    id: 'card' + Date.now(), front: s.customCardFront.trim(), back: s.customCardBack.trim(),
    category: s.customCardCategory.trim(), topicId: s.customCardTopicId,
    ease: 2.5, interval: 0, reps: 0, due: dayIndex()
  };
  return {
    ...s, customCards: [card, ...s.customCards],
    customCardFront: '', customCardBack: '', customCardCategory: '', customCardTopicId: null
  };
}

export function deleteCustomCardState(s, id) {
  const rest = s.customCards.filter(c => c.id !== id);
  return { ...s, customCards: rest, customCardCurrentId: s.customCardCurrentId === id ? null : s.customCardCurrentId };
}

export function buildQuiz(s) {
  const parts = s.quizParts.length ? s.quizParts : null;
  let pool = BANK.filter(q => s.quizTypes.includes(q.type));
  if (parts) pool = pool.filter(q => parts.some(p => q.part.indexOf(p) === 0 || p === q.part));
  if (!pool.length) pool = BANK.slice();
  pool = pool.slice().sort(() => Math.random() - 0.5);
  return pool;
}

export function isCorrect(q, a) {
  if (a === undefined || a === null || a === '') return false;
  if (q.type === 'mcq' || q.type === 'tf') return a === q.answer;
  if (q.type === 'fib') return String(a).trim().toLowerCase() === String(q.answer).toLowerCase();
  return String(a).trim().length > 12;
}

export function submitQuizState(s) {
  const quiz = s.quiz || [];
  let correct = 0;
  quiz.forEach((q, i) => { if (isCorrect(q, s.answers[i])) correct++; });
  const pct = quiz.length ? Math.round((correct / quiz.length) * 100) : 0;
  const attempt = { when: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), mode: s.quizMode, correct, total: quiz.length, pct };
  return { ...s, quizStage: 'result', attempts: [attempt, ...s.attempts], mockLeft: 0 };
}

export function resetProgressState(s) {
  return {
    ...s,
    confirmReset: false, sessions: [], attempts: [], cards: {}, reviews: 0, confidence: {},
    tasks: s.tasks.map(t => ({ ...t, done: false })),
    cardIndex: 0, cardRevealed: false, cycles: 0, running: false,
    remaining: phaseLength(s, 'focus'), phase: 'focus',
    quizStage: 'setup', quiz: null, answers: {}, qIndex: 0, view: 'dash'
  };
}

export function taskViewModel(s, t, i, withQuote) {
  const due = t.due ? dayIndex(t.due) - dayIndex() : null;
  return {
    title: t.title,
    priority: t.priority,
    done: t.done,
    quote: quoteFor(i + t.title.length),
    showQuote: withQuote && !t.done && (s.showQuotes ?? true),
    mark: t.done ? '✓' : '',
    meta: t.due ? 'Due ' + new Date(t.due + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'No deadline',
    countdown: !t.due ? '' : t.done ? 'completed' : (due < 0 ? Math.abs(due) + ' days overdue' : due === 0 ? 'due today' : due + ' days left')
  };
}

export const VIEWS = [
  ['dash', 'Dashboard', 'Analytics & progress', 'Where you stand'],
  ['study', 'Study sessions', 'Focus timer', 'Pomodoro & manual log'],
  ['syllabus', 'Syllabus', 'Course manager', 'level'],
  ['tasks', 'Tasks', 'Study agenda', 'Priorities & deadlines'],
  ['quiz', 'Tests', 'Assessment engine', 'Quiz builder & mock exam'],
  ['cards', 'Flashcards', 'Spaced repetition', 'SM-2 scheduler'],
  ['notes', 'Notes', 'Notes hub', 'Markdown, attached to topics'],
  ['badges', 'Achievements', 'Gamification', 'Streaks & milestones']
];

export function badgeMetricsFor(s) {
  const mins = totalMinutes(s);
  return {
    sessions: s.sessions.length,
    hours: Math.floor(mins / 60),
    streak: streakCount(s),
    goalStreak: goalStreakCount(s),
    best: bestScore(s),
    mastered: masteredCount(s),
    tasksDone: s.tasks.filter(t => t.done).length,
    reviews: s.reviews
  };
}

export function navBadgesFor(s) {
  const openTasks = s.tasks.filter(t => !t.done);
  const dueCount = dueCards(s).length + dueCustomCards(s).length;
  const metrics = badgeMetricsFor(s);
  return {
    tasks: openTasks.length ? String(openTasks.length) : '',
    cards: dueCount ? String(dueCount) : '',
    badges: String(BADGE_DEFS.filter(b => metrics[b.metric] >= b.target).length)
  };
}

export { SYLLABUS, BANK, CARDS, BADGE_DEFS, QUOTES };
