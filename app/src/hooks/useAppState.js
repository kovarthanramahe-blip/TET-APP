import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadState, saveState, phaseLength, finishPhaseState, logSessionState,
  gradeState, buildQuiz, submitQuizState, resetProgressState,
  addCustomCardState, addCustomCardsState, deleteCustomCardState, gradeCustomCardState,
  addCustomTopicState, deleteCustomTopicState,
  generatePlanState, togglePlanItemState, deletePlanItemState
} from '../lib/logic.js';

export function useAppState() {
  const [state, setState] = useState(loadState);
  // Phase 35: saveState() can fail (localStorage quota exceeded, private
  // browsing's storage restrictions, etc.) -- it used to fail silently,
  // with nothing in the UI ever telling the user their edits stopped
  // being persisted. This is deliberately its own piece of state, not part
  // of `state` itself: it describes whether saving state worked, so
  // folding it into the very thing being saved would be circular, and it
  // has no business surviving a reload anyway.
  const [saveFailed, setSaveFailed] = useState(false);

  // persist on every change (mirrors componentDidUpdate -> save())
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
    setSaveFailed(!saveState(state));
  }, [state]);

  // 1s tick: pomodoro/stopwatch countdown + mock exam clock.
  //
  // Ticks by REAL elapsed time (measured via Date.now()) rather than a
  // fixed 1 second per firing. Browsers throttle or fully suspend
  // setInterval in a backgrounded tab or a locked phone screen -- exactly
  // where a 25-minute focus timer or a timed mock exam is likely to be
  // left running -- so a fixed decrement would silently fall behind real
  // time whenever a tick is delayed or skipped, understating how much
  // time actually passed. Whenever this interval DOES fire, even after a
  // long gap, it corrects both countdowns to the true remaining time.
  //
  // `r <= 0`/`m <= 0` (not `=== 0`) because a big elapsed jump can carry
  // remaining/mockLeft straight past zero without ever landing exactly on
  // it. Deliberately only advances ONE phase transition per tick even if
  // the elapsed jump was large enough to have crossed several (e.g. a
  // phone locked through an entire break) -- finishPhaseState() logs a
  // full nominal phase length as studied time, so fast-forwarding through
  // multiple phases on reopen would credit study time that was never
  // actually spent studying, which is worse than just completing the one
  // phase that was in progress and leaving the rest to run normally.
  useEffect(() => {
    let lastTick = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.max(0, Math.round((now - lastTick) / 1000));
      lastTick = now;
      if (elapsedSeconds === 0) return;

      setState(s => {
        let next = s;
        if (s.running && s.remaining > 0) {
          const r = s.remaining - elapsedSeconds;
          next = r <= 0 ? finishPhaseState(next) : { ...next, remaining: r };
        }
        if (next.quizStage === 'active' && next.quizMode === 'Mock exam' && next.mockLeft > 0) {
          const m = next.mockLeft - elapsedSeconds;
          next = m <= 0 ? submitQuizState(next) : { ...next, mockLeft: m };
        }
        return next === s ? s : next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const update = useCallback((patch) => {
    setState(s => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
  }, []);

  const actions = useRef({
    toggleTheme: () => update(s => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

    setView: (view) => update({ view }),
    setLevel: (level) => update({ level }),

    resetProgress: () => setState(s => {
      if (!s.confirmReset) {
        setTimeout(() => setState(s2 => s2.confirmReset ? { ...s2, confirmReset: false } : s2), 5000);
        return { ...s, confirmReset: true };
      }
      return resetProgressState(s);
    }),

    logSession: (label, mins) => setState(s => logSessionState(s, label, mins, s.sessionTopicId)),
    addManualLog: () => setState(s => {
      if (!Number(s.logMinutes)) return s;
      const next = logSessionState(s, s.logLabel || 'Manual session', Number(s.logMinutes), s.sessionTopicId);
      return { ...next, logLabel: '' };
    }),
    setLogLabel: (v) => update({ logLabel: v }),
    setLogMinutes: (v) => update({ logMinutes: v }),
    setSessionTopic: (topicId) => update({ sessionTopicId: topicId || null }),

    setTimerMode: (m) => setState(s => ({
      ...s, timerMode: m, phase: 'focus', running: false,
      remaining: m === 'Stopwatch' ? 0 : phaseLength({ ...s, timerMode: m }, 'focus')
    })),
    toggleTimer: () => update(s => ({ running: !s.running })),
    resetTimer: () => setState(s => ({ ...s, running: false, remaining: phaseLength(s, s.phase) })),
    skipPhase: () => setState(s => finishPhaseState(s)),
    setPomodoroMinutes: (n) => setState(s => {
      const next = { ...s, pomodoroMinutes: n };
      return s.phase === 'focus' && !s.running ? { ...next, remaining: phaseLength(next, 'focus') } : next;
    }),
    setBreakMinutes: (n) => setState(s => {
      const next = { ...s, breakMinutes: n };
      return s.phase === 'break' && !s.running ? { ...next, remaining: phaseLength(next, 'break') } : next;
    }),
    setShowQuotes: (v) => update({ showQuotes: v }),
    setExamDate: (v) => update({ examDate: v || null }),
    setDailyGoalMinutes: (v) => update({ dailyGoalMinutes: v }),
    setRemindersEnabled: (v) => update({ remindersEnabled: v }),
    setReminderTime: (v) => update({ reminderTime: v }),
    toggleReminderDay: (day) => update(s => ({
      reminderDays: s.reminderDays.includes(day)
        ? s.reminderDays.filter(d => d !== day)
        : [...s.reminderDays, day].sort((a, b) => a - b)
    })),
    setEndOfDayNudgeEnabled: (v) => update({ endOfDayNudgeEnabled: v }),
    setEndOfDayNudgeTime: (v) => update({ endOfDayNudgeTime: v }),

    cycleConfidence: (key, current) => update(s => ({ confidence: { ...s.confidence, [key]: (current + 1) % 4 } })),

    setTaskDraft: (v) => update({ taskDraft: v }),
    setTaskDue: (v) => update({ taskDue: v }),
    setTaskPriority: (v) => update({ taskPriority: v }),
    addTask: () => setState(s => {
      if (!s.taskDraft.trim()) return s;
      return {
        ...s,
        tasks: [{ id: 't' + Date.now(), title: s.taskDraft.trim(), priority: s.taskPriority, due: s.taskDue, done: false }, ...s.tasks],
        taskDraft: '', taskDue: ''
      };
    }),
    setTaskFilter: (v) => update({ taskFilter: v }),
    toggleTask: (id) => update(s => ({ tasks: s.tasks.map(x => x.id === id ? { ...x, done: !x.done } : x) })),
    removeTask: (id) => update(s => ({ tasks: s.tasks.filter(x => x.id !== id) })),

    setQuizTypes: (types) => update({ quizTypes: types }),
    setQuizParts: (parts) => update({ quizParts: parts }),
    setQuizMode: (mode) => update({ quizMode: mode }),
    startQuiz: () => setState(s => {
      const quiz = buildQuiz(s);
      return {
        ...s, quiz, quizStage: 'active', qIndex: 0, answers: {}, textAnswer: '', revealed: false,
        mockLeft: s.quizMode === 'Mock exam' ? quiz.length * 60 : 0
      };
    }),
    pickOption: (qIndex, i, isMock) => update(s => ({ answers: { ...s.answers, [qIndex]: i }, revealed: !isMock })),
    setTextAnswer: (qIndex, v) => update(s => ({ answers: { ...s.answers, [qIndex]: v } })),
    revealTextAnswer: () => update({ revealed: true }),
    advanceQuestion: () => setState(s => ({ ...s, qIndex: s.qIndex + 1, revealed: false })),
    submitQuiz: () => setState(s => submitQuizState(s)),
    abortQuiz: () => update({ quizStage: 'setup' }),
    backToSetup: () => update({ quizStage: 'setup', quiz: null, answers: {}, qIndex: 0 }),

    revealCard: (cardIdx) => update({ cardIndex: cardIdx, cardRevealed: true }),
    grade: (idx, g) => setState(s => gradeState(s, idx, g)),
    resetSrs: () => update({ cards: {}, cardRevealed: false, cardIndex: 0 }),

    setCustomCardFront: (v) => update({ customCardFront: v }),
    setCustomCardBack: (v) => update({ customCardBack: v }),
    setCustomCardCategory: (v) => update({ customCardCategory: v }),
    setCustomCardTopic: (topicId) => update({ customCardTopicId: topicId || null }),
    addCustomCard: () => setState(s => addCustomCardState(s)),
    updateCustomCard: (id, patch) => update(s => ({ customCards: s.customCards.map(c => c.id === id ? { ...c, ...patch } : c) })),
    deleteCustomCard: (id) => setState(s => deleteCustomCardState(s, id)),
    revealCustomCard: (id) => update({ customCardCurrentId: id, customCardRevealed: true }),
    gradeCustomCard: (id, g) => setState(s => gradeCustomCardState(s, id, g)),
    addMistakesToDeck: (cards) => setState(s => addCustomCardsState(s, cards)),

    setCustomTopicModule: (v) => update({ customTopicModule: v }),
    setCustomTopicName: (v) => update({ customTopicName: v }),
    setCustomTopicDesc: (v) => update({ customTopicDesc: v }),
    addCustomTopic: () => setState(s => addCustomTopicState(s)),
    deleteCustomTopic: (id) => setState(s => deleteCustomTopicState(s, id)),

    generateWeekPlan: (weakestAreas) => setState(s => generatePlanState(s, weakestAreas)),
    togglePlanItem: (id) => setState(s => togglePlanItemState(s, id)),
    deletePlanItem: (id) => setState(s => deletePlanItemState(s, id)),

    setActiveNote: (id) => update({ activeNote: id }),
    updateNote: (id, patch) => update(s => ({ notes: s.notes.map(n => n.id === id ? { ...n, ...patch } : n) })),
    addNote: () => setState(s => {
      const id = 'n' + Date.now();
      return { ...s, notes: [{ id, title: 'New note', topic: s.level, topicId: null, body: '# New note\n\n- point one\n' }, ...s.notes], activeNote: id };
    }),
    deleteNote: (id) => setState(s => {
      const rest = s.notes.filter(n => n.id !== id);
      return { ...s, notes: rest, activeNote: rest.length ? rest[0].id : '' };
    })
  });

  return { state, update, actions: actions.current, saveFailed };
}
