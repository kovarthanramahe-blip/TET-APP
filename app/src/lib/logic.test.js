import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  seedState, loadState, saveState, sanitizeForPersistence,
  focusMins, breakMins, phaseLength, logSessionState, finishPhaseState,
  minutesOn, totalMinutes, streakCount, goalStreakCount,
  modulesFor, modulesWithCustom, topicKey, confOf, globalSearch,
  addCustomTopicState, deleteCustomTopicState,
  minutesByModule, minutesByTopic,
  dailyMinutesSeries, daysStudiedInRange, weeklyConsistency,
  quizAverageScore, quizPassRate, quizTrend,
  partForModule, modulePerformance,
  daysUntilExam, todayGoalProgress, weeklyGoalProgress,
  seededDeckProgress, customDeckProgress,
  reminderReasons, confColor, confName, masteredCount,
  cardState, dueCards, bestScore, quoteFor,
  nextIntervalFor, applySrsGrade, gradeState,
  dueCustomCards, gradeCustomCardState, addCustomCardState, deleteCustomCardState,
  buildQuiz, isCorrect, submitQuizState,
  resetProgressState, taskViewModel,
  badgeMetricsFor, navBadgesFor,
  CARDS, BANK
} from './logic.js';

// A fixed, mid-day moment -- far enough from either UTC day boundary that
// today()'s UTC-based ISO slice and dayIndex()'s local-midnight parse of
// that same slice always land on the same calendar day, regardless of the
// host timezone.
const FIXED_NOW = new Date('2026-06-15T12:00:00.000Z');

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function daysAgoIso(n) {
  return new Date(FIXED_NOW.getTime() - n * 86400000).toISOString().slice(0, 10);
}

describe('seedState / loadState / saveState', () => {
  it('seedState returns a fresh state with no persisted storage', () => {
    const s = seedState();
    expect(s.view).toBe('dash');
    expect(s.level).toBe('Level 1 (PRT)');
    expect(s.sessions.length).toBeGreaterThan(0);
    expect(s.confidence).toEqual({});
  });

  it('loadState falls back to seedState when nothing is stored', () => {
    const s = loadState();
    expect(s.level).toBe('Level 1 (PRT)');
  });

  it('saveState persists state and loadState reads it back merged over defaults', () => {
    const s = { ...seedState(), level: 'Level 2 (TGT)', dailyGoalMinutes: 90 };
    saveState(s);
    const reloaded = loadState();
    expect(reloaded.level).toBe('Level 2 (TGT)');
    expect(reloaded.dailyGoalMinutes).toBe(90);
  });

  it('saveState always resets a running timer and an in-progress quiz', () => {
    const s = { ...seedState(), running: true, quizStage: 'active', quiz: [{ type: 'mcq' }] };
    saveState(s);
    const reloaded = loadState();
    expect(reloaded.running).toBe(false);
    expect(reloaded.quizStage).toBe('setup');
    expect(reloaded.quiz).toBeNull();
  });

  it('saveState leaves a non-active quiz stage untouched', () => {
    const s = { ...seedState(), quizStage: 'result' };
    saveState(s);
    expect(loadState().quizStage).toBe('result');
  });
});

describe('sanitizeForPersistence', () => {
  it('is the exact same rule saveState() persists through, exposed for reuse by the backup exporter', () => {
    const s = { ...seedState(), running: true, quizStage: 'active', quiz: [{ type: 'mcq' }], level: 'Level 2 (TGT)' };
    const sanitized = sanitizeForPersistence(s);
    expect(sanitized.running).toBe(false);
    expect(sanitized.quizStage).toBe('setup');
    expect(sanitized.quiz).toBeNull();
    expect(sanitized.level).toBe('Level 2 (TGT)');
  });
});

describe('timer phase lengths', () => {
  it('focusMins/breakMins default to 25/5 and clamp to a minimum of 1', () => {
    expect(focusMins({})).toBe(25);
    expect(breakMins({})).toBe(5);
    expect(focusMins({ pomodoroMinutes: 0 })).toBe(1);
    expect(breakMins({ breakMinutes: -3 })).toBe(1);
  });

  it('phaseLength uses the custom pomodoro/break minutes for the default mode', () => {
    const s = { timerMode: 'Pomodoro 25/5', pomodoroMinutes: 20, breakMinutes: 7 };
    expect(phaseLength(s, 'focus')).toBe(20 * 60);
    expect(phaseLength(s, 'break')).toBe(7 * 60);
  });

  it('phaseLength is fixed at 50/10 minutes for Deep work regardless of custom settings', () => {
    const s = { timerMode: 'Deep work 50/10', pomodoroMinutes: 20, breakMinutes: 7 };
    expect(phaseLength(s, 'focus')).toBe(50 * 60);
    expect(phaseLength(s, 'break')).toBe(10 * 60);
  });

  it('phaseLength is 0 for Stopwatch mode', () => {
    expect(phaseLength({ timerMode: 'Stopwatch' }, 'focus')).toBe(0);
  });
});

describe('logSessionState / finishPhaseState', () => {
  it('logSessionState prepends a new session dated today', () => {
    const s = { ...seedState(), sessions: [] };
    const next = logSessionState(s, 'Test session', '45', 'topic-key');
    expect(next.sessions).toHaveLength(1);
    expect(next.sessions[0]).toEqual({ label: 'Test session', mins: 45, date: daysAgoIso(0), topicId: 'topic-key' });
  });

  it('logSessionState coerces a non-numeric minutes value to 0', () => {
    const next = logSessionState({ sessions: [] }, 'x', 'not-a-number', null);
    expect(next.sessions[0].mins).toBe(0);
  });

  it('finishPhaseState logs a session and switches focus -> break', () => {
    const s = { sessions: [], timerMode: 'Pomodoro 25/5', pomodoroMinutes: 25, breakMinutes: 5, phase: 'focus', sessionTopicId: null, cycles: 0 };
    const next = finishPhaseState(s);
    expect(next.phase).toBe('break');
    expect(next.running).toBe(true);
    expect(next.cycles).toBe(1);
    expect(next.remaining).toBe(5 * 60);
    expect(next.sessions).toHaveLength(1);
    expect(next.sessions[0].mins).toBe(25);
  });

  it('finishPhaseState switches break -> focus without logging a session', () => {
    const s = { sessions: [], timerMode: 'Pomodoro 25/5', pomodoroMinutes: 25, breakMinutes: 5, phase: 'break', cycles: 1 };
    const next = finishPhaseState(s);
    expect(next.phase).toBe('focus');
    expect(next.running).toBe(false);
    expect(next.sessions).toHaveLength(0);
  });
});

describe('minutesOn / totalMinutes / streakCount / goalStreakCount', () => {
  it('minutesOn sums only sessions on the given date', () => {
    const s = { sessions: [{ mins: 10, date: '2026-01-01' }, { mins: 20, date: '2026-01-01' }, { mins: 5, date: '2026-01-02' }] };
    expect(minutesOn(s, '2026-01-01')).toBe(30);
    expect(minutesOn(s, '2026-01-02')).toBe(5);
    expect(minutesOn(s, '2026-01-03')).toBe(0);
  });

  it('totalMinutes sums every session regardless of date', () => {
    const s = { sessions: [{ mins: 10 }, { mins: 20 }, { mins: 5 }] };
    expect(totalMinutes(s)).toBe(35);
  });

  it('streakCount is 0 with no sessions today or any prior unbroken day', () => {
    expect(streakCount({ sessions: [] })).toBe(0);
  });

  it('streakCount counts consecutive days backward from today until a gap', () => {
    const s = { sessions: [
      { mins: 10, date: daysAgoIso(0) },
      { mins: 10, date: daysAgoIso(1) },
      { mins: 10, date: daysAgoIso(2) },
      { mins: 10, date: daysAgoIso(4) } // gap at day 3 breaks the streak
    ] };
    expect(streakCount(s)).toBe(3);
  });

  it('tolerates today having no session yet (the day isn\'t over) without breaking the streak, but still breaks on an older gap', () => {
    // i === 0 (today) hitting 0 minutes does not break the loop (only i > 0
    // does) -- so a streak already in progress still counts, it just isn't
    // extended by today until today actually gets logged.
    const s = { sessions: [{ mins: 10, date: daysAgoIso(1) }, { mins: 10, date: daysAgoIso(2) }] };
    expect(streakCount(s)).toBe(2);
  });

  it('goalStreakCount only counts days where the daily goal was actually met', () => {
    const s = {
      dailyGoalMinutes: 60,
      sessions: [
        { mins: 60, date: daysAgoIso(0) },
        { mins: 59, date: daysAgoIso(1) } // under goal -> streak stops here
      ]
    };
    expect(goalStreakCount(s)).toBe(1);
  });

  it('goalStreakCount defaults the goal to 60 when unset or invalid', () => {
    const s = { dailyGoalMinutes: 0, sessions: [{ mins: 60, date: daysAgoIso(0) }] };
    expect(goalStreakCount(s)).toBe(1);
  });
});

// Phase 36: streakCount()/dailyMinutesSeries() etc. walk backward via
// dates.js's offsetDateString(), which used to derive its date string from
// toISOString() -- always UTC by spec. For a timezone ahead of UTC (IST,
// this app's actual audience), a session logged at 1am IST would be
// stamped with today's LOCAL date by logSessionState() (via today(), same
// underlying bug) but streakCount() would look for it under what it
// thought was "today" using the same broken logic -- so under the OLD
// code the two actually agreed with each other (both wrong the same way)
// and this specific end-to-end path wouldn't have shown symptoms on its
// own. What genuinely breaks is a session logged late one IST evening
// (correctly stamped, UTC and local agree then) followed by a session
// early the NEXT IST morning: the old UTC-based "today" during that
// morning window still resolves to the PREVIOUS calendar day, so the two
// sessions collapse onto the same UTC date instead of counting as two
// separate consecutive days. This reproduces exactly that scenario.
describe('streakCount under IST: a late-evening session followed by an early-morning one counts as two separate days', () => {
  const originalTZ = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = 'Asia/Kolkata';
  });

  afterEach(() => {
    process.env.TZ = originalTZ;
  });

  it('counts a streak of 2 across the midnight boundary, not 1', () => {
    // Day 1, 9pm IST (= 3:30pm UTC same day). Starts from an empty
    // sessions list, not seedState()'s own sample data, so the streak
    // this produces is exactly the two sessions below -- nothing else.
    vi.setSystemTime(new Date('2026-06-15T15:30:00.000Z'));
    const day1 = logSessionState({ sessions: [] }, 'Evening revision', 45, null);

    // Day 2, 1am IST (= 7:30pm UTC on the PREVIOUS day) -- the exact
    // window the old UTC-based date logic got wrong.
    vi.setSystemTime(new Date('2026-06-15T19:30:00.000Z'));
    const day2 = logSessionState(day1, 'Early morning revision', 30, null);

    expect(day1.sessions[0].date).not.toBe(day2.sessions[0].date);
    expect(streakCount(day2)).toBe(2);
  });
});

describe('modulesFor / topicKey / confOf', () => {
  it('modulesFor returns the syllabus for the current level, [] for an unknown one', () => {
    const s = seedState();
    expect(modulesFor(s).length).toBeGreaterThan(0);
    expect(modulesFor({ level: 'Not a real level' })).toEqual([]);
  });

  it('topicKey builds a stable "level|module|topic" string', () => {
    expect(topicKey('Level 1 (PRT)', 'Child Development & Pedagogy', 'Theories of learning'))
      .toBe('Level 1 (PRT)|Child Development & Pedagogy|Theories of learning');
  });

  it('confOf reads confidence via the same key shape, defaulting to 0', () => {
    const s = { level: 'Level 1 (PRT)', confidence: { 'Level 1 (PRT)|Mod|Top': 3 } };
    expect(confOf(s, 'Mod', 'Top')).toBe(3);
    expect(confOf(s, 'Mod', 'Other topic')).toBe(0);
  });
});

describe('modulesWithCustom / addCustomTopicState / deleteCustomTopicState', () => {
  it('modulesWithCustom is identical to modulesFor when there are no custom topics for the current level', () => {
    const s = seedState();
    expect(modulesWithCustom(s)).toEqual(modulesFor(s));
  });

  it('addCustomTopicState is a no-op when module or topic name is blank', () => {
    const s = { ...seedState(), customTopicModule: '  ', customTopicName: 'Topic' };
    expect(addCustomTopicState(s)).toBe(s);
  });

  it('addCustomTopicState attaches a custom topic to an EXISTING module by name', () => {
    const s = seedState();
    const moduleName = modulesFor(s)[0].name;
    const s2 = {
      ...s, customTopicModule: moduleName, customTopicName: 'My extra topic', customTopicDesc: 'Extra detail'
    };
    const next = addCustomTopicState(s2);
    expect(next.customTopics).toHaveLength(1);
    expect(next.customTopics[0]).toMatchObject({ level: s.level, moduleName, name: 'My extra topic', desc: 'Extra detail' });
    // Draft fields clear on success, same as addCustomCardState().
    expect(next.customTopicModule).toBe('');
    expect(next.customTopicName).toBe('');
    expect(next.customTopicDesc).toBe('');

    const merged = modulesWithCustom(next);
    const mod = merged.find(m => m.name === moduleName);
    expect(mod.topics.some(t => t[0] === 'My extra topic')).toBe(true);
    // The base module's own topic count is untouched by modulesFor() itself.
    expect(modulesFor(next).find(m => m.name === moduleName).topics.length)
      .toBe(mod.topics.length - 1);
  });

  it('addCustomTopicState starts a brand-new module when the name matches nothing existing', () => {
    const s = { ...seedState(), customTopicModule: 'A Whole New Module', customTopicName: 'Topic X', customTopicDesc: '' };
    const next = addCustomTopicState(s);
    const merged = modulesWithCustom(next);
    const mod = merged.find(m => m.name === 'A Whole New Module');
    expect(mod).toBeDefined();
    expect(mod.weight).toBe(0);
    expect(mod.topics).toEqual([['Topic X', 'Custom topic']]);
  });

  it('a custom topic only appears for the level it was added under', () => {
    const s = { ...seedState(), level: 'Level 1 (PRT)', customTopicModule: 'Mod', customTopicName: 'T', customTopicDesc: '' };
    const withTopic = addCustomTopicState(s);
    expect(modulesWithCustom({ ...withTopic, level: 'Level 2 (TGT)' }))
      .toEqual(modulesFor({ ...withTopic, level: 'Level 2 (TGT)' }));
  });

  it('modulePerformance/masteredCount/globalSearch pick up custom topics via modulesWithCustom', () => {
    const s = { ...seedState(), customTopicModule: 'A Whole New Module', customTopicName: 'Topic X', customTopicDesc: 'desc here' };
    const next = addCustomTopicState(s);
    expect(masteredCount(next)).toBe(0);
    const key = topicKey(next.level, 'A Whole New Module', 'Topic X');
    const mastered = { ...next, confidence: { ...next.confidence, [key]: 3 } };
    expect(masteredCount(mastered)).toBe(1);
    expect(modulePerformance(next, {}).some(m => m.name === 'A Whole New Module')).toBe(true);
    expect(globalSearch(next, 'Topic X').topics).toEqual([{ module: 'A Whole New Module', name: 'Topic X', desc: 'desc here' }]);
  });

  it('deleteCustomTopicState removes the topic and its confidence mark', () => {
    const s = { ...seedState(), customTopicModule: 'Mod', customTopicName: 'T', customTopicDesc: '' };
    const withTopic = addCustomTopicState(s);
    const id = withTopic.customTopics[0].id;
    const key = topicKey(withTopic.level, 'Mod', 'T');
    const withConfidence = { ...withTopic, confidence: { ...withTopic.confidence, [key]: 2 } };

    const next = deleteCustomTopicState(withConfidence, id);
    expect(next.customTopics).toEqual([]);
    expect(next.confidence[key]).toBeUndefined();
  });

  it('deleteCustomTopicState is safe to call for an id that has no confidence mark yet', () => {
    const s = { ...seedState(), customTopicModule: 'Mod', customTopicName: 'T', customTopicDesc: '' };
    const withTopic = addCustomTopicState(s);
    const id = withTopic.customTopics[0].id;
    const next = deleteCustomTopicState(withTopic, id);
    expect(next.customTopics).toEqual([]);
  });
});

describe('globalSearch', () => {
  const s = {
    ...seedState(),
    notes: [{ id: 'n1', title: 'Piaget notes', body: 'stages of development' }],
    tasks: [{ id: 't1', title: 'Revise Piaget stages' }, { id: 't2', title: 'Unrelated task' }],
    customCards: [{ id: 'c1', front: 'What is scaffolding?', back: 'Vygotsky concept', category: 'CDP' }]
  };

  it('returns empty buckets for a blank query without matching anything', () => {
    expect(globalSearch(s, '   ')).toEqual({ notes: [], tasks: [], customCards: [], topics: [] });
  });

  it('matches notes by title or body, case-insensitively', () => {
    const r = globalSearch(s, 'PIAGET');
    expect(r.notes.map(n => n.id)).toEqual(['n1']);
  });

  it('matches tasks by title only', () => {
    const r = globalSearch(s, 'piaget');
    expect(r.tasks.map(t => t.id)).toEqual(['t1']);
  });

  it('matches custom flashcards across front/back/category', () => {
    const r = globalSearch(s, 'vygotsky');
    expect(r.customCards.map(c => c.id)).toEqual(['c1']);
  });

  it('matches syllabus topics for the current level', () => {
    const r = globalSearch(s, 'theories of learning');
    expect(r.topics.length).toBe(1);
    expect(r.topics[0].name).toBe('Theories of learning');
  });

  it('caps every bucket at 6 results', () => {
    const manyNotes = Array.from({ length: 10 }, (_, i) => ({ id: 'n' + i, title: 'match ' + i, body: '' }));
    const r = globalSearch({ ...s, notes: manyNotes }, 'match');
    expect(r.notes).toHaveLength(6);
  });
});

describe('minutesByModule / minutesByTopic', () => {
  const level = 'Level 1 (PRT)';
  const moduleName = 'Child Development & Pedagogy';
  const topicName = 'Theories of learning';
  const key = topicKey(level, moduleName, topicName);

  it('minutesByModule attributes minutes to the matching module for the current level', () => {
    const s = { level, sessions: [{ mins: 30, topicId: key }, { mins: 10, topicId: null }] };
    const result = minutesByModule(s);
    const match = result.find(m => m.name === moduleName);
    const unlinked = result.find(m => m.name === 'Unlinked');
    expect(match.mins).toBe(30);
    expect(unlinked.mins).toBe(10);
  });

  it('minutesByModule buckets a different level\'s topicId as Unlinked, not conflated by module name', () => {
    const otherLevelKey = topicKey('Level 2 (TGT)', moduleName, topicName);
    const s = { level, sessions: [{ mins: 15, topicId: otherLevelKey }] };
    const result = minutesByModule(s);
    expect(result.find(m => m.name === moduleName).mins).toBe(0);
    expect(result.find(m => m.name === 'Unlinked').mins).toBe(15);
  });

  it('minutesByTopic returns flat per-topic totals sorted by minutes descending', () => {
    const key2 = topicKey(level, moduleName, 'Individual differences');
    const s = { level, sessions: [{ mins: 5, topicId: key }, { mins: 5, topicId: key }, { mins: 20, topicId: key2 }] };
    const result = minutesByTopic(s);
    expect(result[0]).toMatchObject({ module: moduleName, topic: 'Individual differences', mins: 20 });
    expect(result[1]).toMatchObject({ module: moduleName, topic: topicName, mins: 10 });
  });

  it('minutesByTopic ignores sessions with no topicId or a different level\'s key', () => {
    const s = { level, sessions: [{ mins: 5, topicId: null }, { mins: 5, topicId: topicKey('Level 3 (PGT)', moduleName, topicName) }] };
    expect(minutesByTopic(s)).toEqual([]);
  });
});

describe('dailyMinutesSeries / daysStudiedInRange / weeklyConsistency', () => {
  it('dailyMinutesSeries returns `days` entries oldest-first ending today', () => {
    const s = { sessions: [{ mins: 30, date: daysAgoIso(0) }, { mins: 20, date: daysAgoIso(2) }] };
    const series = dailyMinutesSeries(s, 3);
    expect(series).toHaveLength(3);
    expect(series[series.length - 1].iso).toBe(daysAgoIso(0));
    expect(series[series.length - 1].mins).toBe(30);
    expect(series[0].mins).toBe(20);
  });

  it('daysStudiedInRange counts only the days with minutes > 0', () => {
    const s = { sessions: [{ mins: 30, date: daysAgoIso(0) }, { mins: 0, date: daysAgoIso(1) }] };
    expect(daysStudiedInRange(s, 7)).toBe(1);
  });

  it('weeklyConsistency buckets into non-overlapping 7-day windows, most recent last', () => {
    const s = { sessions: [{ mins: 10, date: daysAgoIso(0) }, { mins: 10, date: daysAgoIso(10) }] };
    const weeks = weeklyConsistency(s, 2);
    expect(weeks).toHaveLength(2);
    expect(weeks[1].label).toBe('This wk');
    expect(weeks[1].daysStudied).toBe(1);
    expect(weeks[0].daysStudied).toBe(1);
  });
});

describe('quizAverageScore / quizPassRate / quizTrend', () => {
  it('returns 0 for both average and pass rate with no attempts', () => {
    expect(quizAverageScore({ attempts: [] })).toBe(0);
    expect(quizPassRate({ attempts: [] })).toBe(0);
  });

  it('quizAverageScore rounds the mean pct across all attempts', () => {
    const s = { attempts: [{ pct: 50 }, { pct: 80 }, { pct: 90 }] };
    expect(quizAverageScore(s)).toBe(73); // 73.33 rounded
  });

  it('quizPassRate is the percentage of attempts at or above 60%', () => {
    const s = { attempts: [{ pct: 60 }, { pct: 59 }, { pct: 100 }, { pct: 0 }] };
    expect(quizPassRate(s)).toBe(50);
  });

  it('quizTrend takes the `limit` most recent attempts, then reverses to oldest-to-newest', () => {
    const s = { attempts: [{ pct: 3 }, { pct: 2 }, { pct: 1 }] };
    // The 2 most recent (newest-first) are pct 3 and pct 2; reversed for
    // left-to-right charting, the older of that pair comes first.
    expect(quizTrend(s, 2).map(a => a.pct)).toEqual([2, 3]);
  });
});

describe('partForModule / modulePerformance', () => {
  it('partForModule normalizes any "Subject..." module name to "Subject"', () => {
    expect(partForModule('Subject — Maths & EVS')).toBe('Subject');
    expect(partForModule('Subject specialisation (PGT)')).toBe('Subject');
    expect(partForModule('Child Development & Pedagogy')).toBe('Child Development & Pedagogy');
  });

  it('modulePerformance ranks modules by confidence ascending and carries quiz stats where present', () => {
    const s = seedState();
    const moduleName = modulesFor(s)[0].name;
    const topics = modulesFor(s)[0].topics;
    // Mark every topic in the first module as mastered (confidence 3).
    const confidence = {};
    topics.forEach(t => { confidence[topicKey(s.level, moduleName, t[0])] = 3; });
    const s2 = { ...s, confidence };
    const quizByPart = { [partForModule(moduleName)]: { correct: 8, total: 10 } };
    const result = modulePerformance(s2, quizByPart);
    const entry = result.find(r => r.name === moduleName);
    expect(entry.confidencePct).toBe(100);
    expect(entry.quizPct).toBe(80);
    expect(entry.quizAttempts).toBe(10);
    // Fully-mastered module should sort last (ascending by confidence).
    expect(result[result.length - 1].name).toBe(moduleName);
  });

  it('modulePerformance reports quizPct as null (not 0) when there is no quiz history for that part', () => {
    const s = seedState();
    const result = modulePerformance(s, {});
    expect(result.every(r => r.quizPct === null)).toBe(true);
  });
});

describe('daysUntilExam / todayGoalProgress / weeklyGoalProgress', () => {
  it('daysUntilExam is null when no exam date is set', () => {
    expect(daysUntilExam({ examDate: null })).toBeNull();
  });

  it('daysUntilExam counts whole days to a future date', () => {
    expect(daysUntilExam({ examDate: daysAgoIso(-10) })).toBe(10);
  });

  it('daysUntilExam is negative once the exam date has passed', () => {
    expect(daysUntilExam({ examDate: daysAgoIso(3) })).toBe(-3);
  });

  it('todayGoalProgress reports done/goal and caps pct at 100', () => {
    const s = { dailyGoalMinutes: 60, sessions: [{ mins: 90, date: daysAgoIso(0) }] };
    expect(todayGoalProgress(s)).toEqual({ goal: 60, done: 90, pct: 100 });
  });

  it('weeklyGoalProgress averages the last 7 days against the goal', () => {
    const s = { dailyGoalMinutes: 60, sessions: [{ mins: 420, date: daysAgoIso(0) }] };
    const result = weeklyGoalProgress(s);
    expect(result.avg).toBe(60); // 420 / 7 days
    expect(result.pct).toBe(100);
  });
});

describe('seededDeckProgress / customDeckProgress', () => {
  it('seededDeckProgress reports total from CARDS and reviewed/dueNow/avgEase from state', () => {
    const s = { cards: {} };
    const progress = seededDeckProgress(s);
    expect(progress.total).toBe(CARDS.length);
    expect(progress.reviewed).toBe(0);
    expect(progress.dueNow).toBe(CARDS.length); // every card starts due
    expect(progress.avgEase).toBe(2.5);
  });

  it('customDeckProgress defaults avgEase to 2.5 for an empty deck', () => {
    expect(customDeckProgress({ customCards: [] })).toEqual({ total: 0, reviewed: 0, dueNow: 0, avgEase: 2.5 });
  });

  it('customDeckProgress computes real averages for a populated deck', () => {
    const s = { customCards: [
      { reps: 1, ease: 2.0, due: 0 },
      { reps: 0, ease: 3.0, due: 999999 }
    ] };
    const progress = customDeckProgress(s);
    expect(progress.total).toBe(2);
    expect(progress.reviewed).toBe(1);
    expect(progress.dueNow).toBe(1);
    expect(progress.avgEase).toBe(2.5);
  });
});

describe('reminderReasons', () => {
  it('is empty when the goal is met, nothing is due, and no cards are due', () => {
    // cards: {} would leave every seeded CARDS entry at its default (due
    // today) via cardState()'s fallback -- push them all far into the
    // future so the seeded deck genuinely has nothing due, same as
    // customCards: [] genuinely has no custom deck at all.
    const futureCards = Object.fromEntries(CARDS.map((_, i) => [String(i), { ease: 2.5, interval: 30, reps: 3, due: 999999 }]));
    const s = {
      dailyGoalMinutes: 30, sessions: [{ mins: 30, date: daysAgoIso(0) }],
      tasks: [], cards: futureCards, customCards: []
    };
    expect(reminderReasons(s)).toEqual([]);
  });

  it('reports an under-goal reason with the real done/goal numbers', () => {
    const s = { dailyGoalMinutes: 60, sessions: [], tasks: [], cards: {}, customCards: [] };
    expect(reminderReasons(s)).toContain("You're at 0/60 min of today's study goal.");
  });

  it('reports overdue/due tasks with correct singular/plural wording', () => {
    const s = {
      dailyGoalMinutes: 1, sessions: [{ mins: 1, date: daysAgoIso(0) }],
      tasks: [{ done: false, due: daysAgoIso(1) }], cards: {}, customCards: []
    };
    expect(reminderReasons(s)).toContain('1 task is due or overdue.');
  });

  it('reports due flashcards (seeded + custom combined)', () => {
    const s = {
      dailyGoalMinutes: 1, sessions: [{ mins: 1, date: daysAgoIso(0) }],
      tasks: [], cards: {}, customCards: [{ due: 0 }]
    };
    const reasons = reminderReasons(s);
    expect(reasons.some(r => r.includes('flashcard'))).toBe(true);
  });
});

describe('confColor / confName / masteredCount', () => {
  it('confColor maps each confidence level to a distinct theme-aware color variable, with a neutral default', () => {
    expect(confColor(1)).toBe('var(--danger-ink)');
    expect(confColor(2)).toBe('var(--warning-ink)');
    expect(confColor(3)).toBe('var(--success-ink)');
    expect(confColor(0)).toBe('var(--color-divider)');
  });

  it('confName labels each confidence level in order', () => {
    expect(confName(0)).toBe('Untouched');
    expect(confName(3)).toBe('Mastered');
  });

  it('masteredCount counts only topics at confidence 3 across the whole current-level syllabus', () => {
    const s = seedState();
    expect(masteredCount(s)).toBe(0);
    const moduleName = modulesFor(s)[0].name;
    const topicName = modulesFor(s)[0].topics[0][0];
    s.confidence[topicKey(s.level, moduleName, topicName)] = 3;
    expect(masteredCount(s)).toBe(1);
  });
});

describe('flashcard SRS: cardState / dueCards / nextIntervalFor / applySrsGrade / gradeState', () => {
  it('cardState defaults to a fresh, due-today card', () => {
    const cs = cardState({ cards: {} }, 0);
    expect(cs).toEqual({ ease: 2.5, interval: 0, reps: 0, due: expect.any(Number) });
  });

  it('dueCards includes every card whose due day has arrived', () => {
    const s = { cards: { '0': { ease: 2.5, interval: 5, reps: 1, due: -1 } } };
    expect(dueCards(s)).toContain(0);
  });

  it('nextIntervalFor returns "" for no existing card state, "today" for Again', () => {
    expect(nextIntervalFor(null, 3)).toBe('');
    expect(nextIntervalFor({ reps: 0, ease: 2.5, interval: 0 }, 0)).toBe('today');
  });

  it('nextIntervalFor gives fixed 1d/3d for the first two successful reps', () => {
    expect(nextIntervalFor({ reps: 0, ease: 2.5, interval: 0 }, 2)).toBe('1d');
    expect(nextIntervalFor({ reps: 1, ease: 2.5, interval: 1 }, 2)).toBe('3d');
  });

  it('applySrsGrade resets reps/interval and drops ease on "Again" (grade 0)', () => {
    const next = applySrsGrade({ ease: 2.5, interval: 10, reps: 3 }, 0);
    expect(next.reps).toBe(0);
    expect(next.interval).toBe(0);
    expect(next.ease).toBe(2.3);
  });

  it('applySrsGrade never lets ease drop below 1.3 or above 3.0', () => {
    const low = applySrsGrade({ ease: 1.3, interval: 1, reps: 1 }, 1);
    expect(low.ease).toBe(1.3);
    const high = applySrsGrade({ ease: 3.0, interval: 1, reps: 5 }, 3);
    expect(high.ease).toBe(3.0);
  });

  it('gradeState updates the graded card, increments reviews, and advances to the next due card', () => {
    const s = { cards: {}, reviews: 0, cardRevealed: true };
    const next = gradeState(s, 0, 3);
    expect(next.reviews).toBe(1);
    expect(next.cardRevealed).toBe(false);
    expect(next.cards['0'].reps).toBe(1);
  });

  it('gradeState sets cardIndex to -1 once no cards remain due', () => {
    // A single-card deck (mocked via CARDS.length being whatever it is) --
    // grade every due card to push them all out of the due window, then
    // confirm cardIndex becomes -1 once dueCards() is empty.
    let s = { cards: {}, reviews: 0, cardRevealed: false };
    let due = dueCards(s);
    while (due.length) {
      s = gradeState(s, due[0], 3);
      due = dueCards(s);
    }
    expect(s.cardIndex).toBe(-1);
  });
});

describe('custom flashcards: dueCustomCards / gradeCustomCardState / addCustomCardState / deleteCustomCardState', () => {
  it('addCustomCardState is a no-op when front or back is blank', () => {
    const s = { customCardFront: '  ', customCardBack: 'answer', customCards: [] };
    expect(addCustomCardState(s)).toBe(s);
  });

  it('addCustomCardState prepends a fresh card and clears the draft fields', () => {
    const s = {
      customCardFront: ' Front ', customCardBack: ' Back ', customCardCategory: ' Cat ',
      customCardTopicId: 'topic-1', customCards: []
    };
    const next = addCustomCardState(s);
    expect(next.customCards).toHaveLength(1);
    expect(next.customCards[0]).toMatchObject({ front: 'Front', back: 'Back', category: 'Cat', ease: 2.5, reps: 0 });
    expect(next.customCardFront).toBe('');
    expect(next.customCardTopicId).toBeNull();
  });

  it('deleteCustomCardState removes the card and clears customCardCurrentId if it pointed there', () => {
    const s = { customCards: [{ id: 'a' }, { id: 'b' }], customCardCurrentId: 'a' };
    const next = deleteCustomCardState(s, 'a');
    expect(next.customCards.map(c => c.id)).toEqual(['b']);
    expect(next.customCardCurrentId).toBeNull();
  });

  it('dueCustomCards / gradeCustomCardState mirror the seeded-deck SRS behavior', () => {
    const s = { customCards: [{ id: 'a', ease: 2.5, interval: 0, reps: 0, due: 0 }], reviews: 0, customCardRevealed: true };
    expect(dueCustomCards(s).map(c => c.id)).toEqual(['a']);
    const next = gradeCustomCardState(s, 'a', 3);
    expect(next.reviews).toBe(1);
    expect(next.customCardRevealed).toBe(false);
    expect(next.customCards[0].reps).toBe(1);
  });
});

describe('quiz: buildQuiz / isCorrect / submitQuizState', () => {
  it('buildQuiz filters by selected types and falls back to the whole bank if a filter matches nothing', () => {
    const s = { quizTypes: ['mcq'], quizParts: [] };
    const pool = buildQuiz(s);
    expect(pool.every(q => q.type === 'mcq')).toBe(true);
    expect(pool.length).toBeGreaterThan(0);
  });

  it('buildQuiz falls back to the full bank when the type+part filter is empty', () => {
    const s = { quizTypes: ['this-type-does-not-exist'], quizParts: [] };
    expect(buildQuiz(s).length).toBe(BANK.length);
  });

  it('isCorrect treats missing/blank answers as wrong', () => {
    expect(isCorrect({ type: 'mcq', answer: 'A' }, undefined)).toBe(false);
    expect(isCorrect({ type: 'mcq', answer: 'A' }, '')).toBe(false);
  });

  it('isCorrect does exact match for mcq/tf, case-insensitive trimmed match for fib', () => {
    expect(isCorrect({ type: 'mcq', answer: 'A' }, 'A')).toBe(true);
    expect(isCorrect({ type: 'tf', answer: true }, false)).toBe(false);
    expect(isCorrect({ type: 'fib', answer: 'Piaget' }, '  piaget  ')).toBe(true);
  });

  it('isCorrect treats any long-form answer over 12 chars as correct for other types', () => {
    expect(isCorrect({ type: 'long' }, 'short')).toBe(false);
    expect(isCorrect({ type: 'long' }, 'this is a sufficiently long answer')).toBe(true);
  });

  it('submitQuizState scores the quiz, records an attempt, and resets mockLeft', () => {
    const s = {
      quiz: [{ type: 'mcq', answer: 'A' }, { type: 'mcq', answer: 'B' }],
      answers: { 0: 'A', 1: 'wrong' },
      quizMode: 'Practice', attempts: [], mockLeft: 300
    };
    const next = submitQuizState(s);
    expect(next.quizStage).toBe('result');
    expect(next.mockLeft).toBe(0);
    expect(next.attempts).toHaveLength(1);
    expect(next.attempts[0]).toMatchObject({ correct: 1, total: 2, pct: 50, mode: 'Practice' });
  });

  it('submitQuizState handles an empty quiz without dividing by zero', () => {
    const next = submitQuizState({ quiz: [], answers: {}, quizMode: 'Practice', attempts: [], mockLeft: 0 });
    expect(next.attempts[0]).toMatchObject({ correct: 0, total: 0, pct: 0 });
  });
});

describe('resetProgressState', () => {
  it('clears study data and completion state but preserves tasks (marked undone) and returns to Dashboard', () => {
    const s = {
      confirmReset: true, sessions: [{ mins: 1 }], attempts: [{ pct: 1 }], cards: { 0: {} }, reviews: 5,
      confidence: { a: 3 }, tasks: [{ id: 't1', done: true }], view: 'quiz',
      timerMode: 'Pomodoro 25/5', pomodoroMinutes: 25, breakMinutes: 5
    };
    const next = resetProgressState(s);
    expect(next.sessions).toEqual([]);
    expect(next.attempts).toEqual([]);
    expect(next.cards).toEqual({});
    expect(next.reviews).toBe(0);
    expect(next.confidence).toEqual({});
    expect(next.tasks).toEqual([{ id: 't1', done: false }]);
    expect(next.view).toBe('dash');
    expect(next.confirmReset).toBe(false);
  });
});

describe('taskViewModel', () => {
  it('reports "No deadline" and no countdown for a task without a due date', () => {
    const vm = taskViewModel({ showQuotes: true }, { title: 'X', priority: 'Low', done: false, due: null }, 0, false);
    expect(vm.meta).toBe('No deadline');
    expect(vm.countdown).toBe('');
    expect(vm.mark).toBe('');
  });

  it('marks a completed task and reports "completed" regardless of due date', () => {
    const vm = taskViewModel({}, { title: 'X', priority: 'Low', done: true, due: daysAgoIso(-5) }, 0, false);
    expect(vm.mark).toBe('✓');
    expect(vm.countdown).toBe('completed');
  });

  it('reports overdue days for a past-due, incomplete task', () => {
    const vm = taskViewModel({}, { title: 'X', priority: 'High', done: false, due: daysAgoIso(3) }, 0, false);
    expect(vm.countdown).toBe('3 days overdue');
  });

  it('reports "due today" and days-left correctly', () => {
    const today = taskViewModel({}, { title: 'X', priority: 'High', done: false, due: daysAgoIso(0) }, 0, false);
    expect(today.countdown).toBe('due today');
    const future = taskViewModel({}, { title: 'X', priority: 'High', done: false, due: daysAgoIso(-2) }, 0, false);
    expect(future.countdown).toBe('2 days left');
  });

  it('only shows a quote when withQuote is true, the task is open, and showQuotes is not disabled', () => {
    const base = { title: 'X', priority: 'Low', done: false, due: null };
    expect(taskViewModel({ showQuotes: true }, base, 0, true).showQuote).toBe(true);
    expect(taskViewModel({ showQuotes: true }, base, 0, false).showQuote).toBe(false);
    expect(taskViewModel({ showQuotes: false }, base, 0, true).showQuote).toBe(false);
    expect(taskViewModel({ showQuotes: true }, { ...base, done: true }, 0, true).showQuote).toBe(false);
  });
});

describe('quoteFor', () => {
  it('is deterministic for a given index and wraps negative indices via abs', () => {
    expect(quoteFor(5)).toBe(quoteFor(5));
    expect(quoteFor(-3)).toBe(quoteFor(3));
  });
});

describe('bestScore', () => {
  it('returns 0 with no attempts, otherwise the max pct', () => {
    expect(bestScore({ attempts: [] })).toBe(0);
    expect(bestScore({ attempts: [{ pct: 40 }, { pct: 90 }, { pct: 10 }] })).toBe(90);
  });
});

describe('badgeMetricsFor / navBadgesFor', () => {
  it('badgeMetricsFor aggregates the underlying metrics used by badge definitions', () => {
    const s = { ...seedState(), sessions: [{ mins: 120, date: daysAgoIso(0) }], tasks: [{ done: true }, { done: false }], reviews: 3 };
    const metrics = badgeMetricsFor(s);
    expect(metrics).toMatchObject({ sessions: 1, hours: 2, tasksDone: 1, reviews: 3 });
  });

  it('navBadgesFor shows open task/due card counts only when non-zero', () => {
    const s = { ...seedState(), tasks: [], customCards: [], cards: {} };
    const badges = navBadgesFor(s);
    expect(badges.tasks).toBe('');
    // Every seeded card starts due, so the seeded deck alone makes this non-empty.
    expect(badges.cards).not.toBe('');
  });
});
