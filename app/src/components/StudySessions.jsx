import React from 'react';
import { useApp } from '../AppContext.jsx';
import { modulesFor, phaseLength, topicKey, totalMinutes } from '../lib/logic.js';
import { today, fmtShort } from '../lib/dates.js';
import { chip } from '../lib/styleHelpers.js';

function mm(secs) {
  secs = Math.max(0, secs);
  return String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0');
}

export default function StudySessions() {
  const { state: s, actions } = useApp();
  const mins = totalMinutes(s);
  const phaseTotal = phaseLength(s, s.phase) || 1;
  const phaseLabel = s.timerMode === 'Stopwatch' ? 'Stopwatch' : (s.phase === 'focus' ? 'Focus' : 'Break');
  const pomodoroNote = s.timerMode === 'Stopwatch'
    ? 'Stopwatch counts up — log the minutes by hand when you stop.'
    : 'Completed focus phases are logged automatically. Cycles today: ' + s.cycles + '.';

  const sessionRows = s.sessions.slice(0, 8).map(x => ({
    label: x.label,
    when: x.date === today() ? 'Today' : fmtShort(x.date),
    mins: x.mins,
    topic: x.topicId ? x.topicId.split('|')[2] : '—'
  }));
  const sessionSummary = s.sessions.length + ' sessions · ' + (mins / 60).toFixed(1) + ' hours total · average ' +
    Math.round(mins / Math.max(1, s.sessions.length)) + ' min';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="card" style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: '1 1 260px', margin: 0 }}>
          <label>Currently studying</label>
          <select className="input" value={s.sessionTopicId || ''} onChange={e => actions.setSessionTopic(e.target.value)}>
            <option value="">— Not linked —</option>
            {modulesFor(s).map(m => (
              <optgroup key={m.name} label={m.name}>
                {m.topics.map(t => (
                  <option key={t[0]} value={topicKey(s.level, m.name, t[0])}>{t[0]}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <p style={{ fontSize: '12px', opacity: .65, margin: 0, flex: '2 1 260px' }}>
          Applies to the timer below and to sessions you log by hand, so time studied can be broken down by topic on the dashboard.
        </p>
      </div>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 'var(--space-8)', alignItems: 'start' }}>
      <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <div style={{ fontSize: '11px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent-ink)' }}>{phaseLabel}</div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '96px', lineHeight: 1, fontWeight: 400, fontFeatureSettings: "'tnum'", margin: 'var(--space-4) 0' }}>
          {mm(s.remaining)}
        </div>
        <div style={{ height: '2px', background: 'var(--color-divider)', marginBottom: 'var(--space-6)' }}>
          <div style={{ width: Math.round(((phaseTotal - s.remaining) / phaseTotal) * 100) + '%', height: '100%', background: 'var(--color-accent)' }}></div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={actions.toggleTimer} style={{ minWidth: '110px' }}>
            {s.running ? 'Pause' : 'Start'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={actions.resetTimer}>Reset</button>
          <button type="button" className="btn btn-secondary" onClick={actions.skipPhase}>Skip phase</button>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', marginTop: 'var(--space-6)' }}>
          {['Pomodoro 25/5', 'Deep work 50/10', 'Stopwatch'].map(m => (
            <button key={m} type="button" onClick={() => actions.setTimerMode(m)} aria-pressed={s.timerMode === m} style={chip(s.timerMode === m, true)}>{m}</button>
          ))}
        </div>
        <p style={{ fontSize: '13px', opacity: .7, margin: 'var(--space-6) 0 0' }}>{pomodoroNote}</p>

        <hr className="hr" style={{ margin: 'var(--space-6) 0 var(--space-4)' }} />
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ width: '100px' }}>
            <label>Focus min</label>
            <input className="input" type="number" min={5} max={60} value={s.pomodoroMinutes}
              onChange={e => actions.setPomodoroMinutes(Math.min(60, Math.max(5, Number(e.target.value) || 5)))} />
          </div>
          <div className="field" style={{ width: '100px' }}>
            <label>Break min</label>
            <input className="input" type="number" min={2} max={20} value={s.breakMinutes}
              onChange={e => actions.setBreakMinutes(Math.min(20, Math.max(2, Number(e.target.value) || 2)))} />
          </div>
          <button type="button" aria-pressed={s.showQuotes ?? true} style={chip(s.showQuotes ?? true, false)} onClick={() => actions.setShowQuotes(!(s.showQuotes ?? true))}>
            Quotes {(s.showQuotes ?? true) ? 'on' : 'off'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div>
          <h4>Log a session by hand</h4>
          <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-3)' }} />
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '2 1 160px' }}>
              <label>What did you study?</label>
              <input className="input" type="text" value={s.logLabel} onChange={e => actions.setLogLabel(e.target.value)} placeholder="e.g. Piaget's stages" />
            </div>
            <div className="field" style={{ flex: '0 1 100px' }}>
              <label>Minutes</label>
              <input className="input" type="number" value={s.logMinutes} onChange={e => actions.setLogMinutes(e.target.value)} />
            </div>
            <button type="button" className="btn btn-primary" onClick={actions.addManualLog}>Add</button>
          </div>
        </div>
        <div>
          <h4>Session log</h4>
          <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-3)' }} />
          <table className="table" style={{ width: '100%' }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Session</th><th style={{ textAlign: 'left' }}>Topic</th><th style={{ textAlign: 'left' }}>When</th><th style={{ textAlign: 'right' }}>Min</th></tr></thead>
            <tbody>
              {sessionRows.map((r, i) => (
                <tr key={i}>
                  <td>{r.label}</td>
                  <td style={{ opacity: .7 }}>{r.topic}</td>
                  <td style={{ opacity: .7 }}>{r.when}</td>
                  <td style={{ textAlign: 'right', fontFeatureSettings: "'tnum'" }}>{r.mins}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: '12px', opacity: .6, marginTop: 'var(--space-3)' }}>{sessionSummary}</p>
        </div>
      </div>
      </section>
    </div>
  );
}
