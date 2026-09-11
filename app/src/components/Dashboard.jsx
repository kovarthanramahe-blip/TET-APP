import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../AppContext.jsx';
import {
  totalMinutes, minutesOn, streakCount, bestScore, modulesFor, confOf,
  confColor, confName, taskViewModel, minutesByModule,
  dailyMinutesSeries, daysStudiedInRange, weeklyConsistency, minutesByTopic,
  quizAverageScore, quizPassRate, quizTrend, modulePerformance,
  seededDeckProgress, customDeckProgress,
  daysUntilExam, todayGoalProgress, weeklyGoalProgress
} from '../lib/logic.js';
import { today, fmtWeekday, fmtShort } from '../lib/dates.js';
import { chip, checkbox } from '../lib/styleHelpers.js';
import { renderMarkdown } from '../lib/markdown.js';
import { useQuizPartPerformance } from '../hooks/useQuizPartPerformance.js';

export default function Dashboard() {
  const { state, actions, migration } = useApp();
  const s = state;
  const mins = totalMinutes(s);
  const streak = streakCount(s);
  const openTasks = s.tasks.filter(t => !t.done);
  const modules = modulesFor(s);

  const stats = [
    { label: 'Hours studied', value: (mins / 60).toFixed(1), sub: minutesOn(s, today()) + ' min today' },
    { label: 'Daily streak', value: streak, sub: streak > 2 ? 'Keep it alive' : 'Build the habit' },
    { label: 'Tasks done', value: s.tasks.filter(t => t.done).length + '/' + s.tasks.length, sub: openTasks.length + ' open' },
    { label: 'Best test score', value: bestScore(s) + '%', sub: s.attempts.length + ' attempts · 60% qualifies' }
  ];

  // Phase 8: study goal & exam countdown.
  const examDays = daysUntilExam(s);
  const todayGoal = todayGoalProgress(s);
  const weekGoal = weeklyGoalProgress(s);

  // Phase 7: KPI row -- same stat-tile shape as `stats` above, one level
  // down in prominence (second row), summarizing the new analytics blocks
  // below rather than duplicating their detail.
  const quizAvg = quizAverageScore(s);
  const passRate = quizPassRate(s);
  const daysStudied7 = daysStudiedInRange(s, 7);
  const seededProgress = seededDeckProgress(s);
  const customProgress = customDeckProgress(s);
  const kpis = [
    { label: 'Avg quiz score', value: s.attempts.length ? quizAvg + '%' : '—', sub: s.attempts.length + ' attempts' },
    { label: 'Pass rate', value: s.attempts.length ? passRate + '%' : '—', sub: '60% qualifies' },
    { label: 'Study consistency', value: daysStudied7 + '/7', sub: 'days studied this week' },
    { label: 'Cards reviewed', value: seededProgress.reviewed + customProgress.reviewed, sub: (seededProgress.total + customProgress.total) + ' total cards' }
  ];

  // Study hours trend -- generalizes the old fixed 7-day chart with a
  // 7/30/90 selector. Bar scaling is relative to the selected range's own
  // max (not a fixed 120min cap) so 30/90-day views stay legible. Per-bar
  // weekday/minute labels only render at 7 days -- 30 or 90 tiny labels
  // would be unreadable clutter, so those ranges rely on the hover title
  // and the summary line below instead.
  const [trendDays, setTrendDays] = useState(7);

  // Phase 16: which notes go on the printable revision sheet. Deliberately
  // local, ephemeral UI state -- not synced to the cloud or persisted --
  // since it's a rarely-used, low-stakes choice that resets to "all notes"
  // on reload.
  //
  // Tracks DESELECTED ids, not selected ones -- for a signed-in user,
  // s.notes at the moment this component first mounts is still the
  // pre-fetch fallback (useCloudTasksAndNotes.js's cloud notes start out
  // null and briefly fall back to base.state.notes); the real list arrives
  // an instant later. A "selected" whitelist seeded from that first,
  // incomplete render would never grow to include the real notes once
  // they load, silently leaving every note unchecked. A "deselected"
  // blacklist has no such gap: any note absent from it -- new, late-
  // loading, or just added -- is selected by default with no resync effect
  // needed.
  const [deselectedNoteIds, setDeselectedNoteIds] = useState(() => new Set());
  const toggleNoteSelected = (id) => {
    setDeselectedNoteIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const trendSeries = dailyMinutesSeries(s, trendDays);
  const trendMax = Math.max(1, ...trendSeries.map(d => d.mins));
  const trendTotalMins = trendSeries.reduce((a, d) => a + d.mins, 0);
  const trendDaysStudied = trendSeries.filter(d => d.mins > 0).length;
  const chart = trendSeries.map(d => ({
    iso: d.iso, mins: d.mins,
    title: fmtShort(d.iso) + ' · ' + d.mins + ' min',
    dayLabel: trendDays === 7 ? fmtWeekday(d.date) : '',
    minsLabel: trendDays === 7 ? (d.mins || '—') : '',
    barStyle: {
      width: '100%', height: Math.max(2, Math.round((d.mins / trendMax) * 100)) + '%',
      background: d.mins ? 'color-mix(in srgb, var(--color-accent) 28%, transparent)' : 'transparent',
      borderTop: '2px solid ' + (d.mins ? 'var(--color-accent)' : 'var(--color-divider)'),
      borderRadius: '2px 2px 0 0'
    }
  }));

  const heatCells = [];
  modules.forEach(m => m.topics.forEach(t => {
    const c = confOf(s, m.name, t[0]);
    heatCells.push({
      title: m.name + ' — ' + t[0] + ' · ' + confName(c),
      style: {
        width: '22px', height: '22px', borderRadius: '2px',
        background: c ? confColor(c) : 'transparent',
        border: '1px solid ' + (c ? 'transparent' : 'var(--color-divider)'),
        opacity: c ? 0.85 : 1
      }
    });
  }));
  const heatLegend = [1, 2, 3, 0].map(c => ({
    label: confName(c),
    style: { width: '10px', height: '10px', display: 'inline-block', background: confColor(c), borderRadius: '2px' }
  }));

  const courseProgress = modules.map(m => {
    const done = m.topics.filter(t => confOf(s, m.name, t[0]) === 3).length;
    const pct = Math.round((done / m.topics.length) * 100);
    return { name: m.name, label: pct + '% · ' + m.weight + ' marks', fillStyle: { width: Math.max(1, pct) + '%', height: '100%', background: 'var(--color-accent)' } };
  });

  const agenda = openTasks.slice(0, 5).map((t, i) => ({ t, vm: taskViewModel(s, t, i, false) }));

  const moduleMinutes = minutesByModule(s);
  const maxModuleMins = Math.max(1, ...moduleMinutes.map(m => m.mins));
  const timeByModule = moduleMinutes
    .filter(m => m.name !== 'Unlinked' || m.mins > 0)
    .map(m => ({
      name: m.name,
      label: m.mins >= 60 ? Math.floor(m.mins / 60) + 'h ' + (m.mins % 60) + 'm' : m.mins + ' min',
      fillStyle: {
        width: Math.max(m.mins ? 2 : 0, Math.round((m.mins / maxModuleMins) * 100)) + '%', height: '100%',
        background: m.name === 'Unlinked' ? 'var(--color-divider)' : 'var(--color-accent)'
      }
    }));

  // Phase 7 additions below -----------------------------------------------

  const weeks = weeklyConsistency(s, 8);

  const topTopics = minutesByTopic(s).slice(0, 6).map(t => ({
    ...t,
    label: t.mins >= 60 ? Math.floor(t.mins / 60) + 'h ' + (t.mins % 60) + 'm' : t.mins + ' min'
  }));

  const quizSeries = quizTrend(s, 10);

  // Cloud-only, read-only, self-contained (see useQuizPartPerformance.js) --
  // {} for a logged-out/local user, so modulePerformance() below falls back
  // to confidence alone, exactly as it would for a cloud user with no quiz
  // history yet.
  const cloudActive = (migration.status === 'success' || migration.status === 'already_migrated') && !!migration.userId;
  const quizByPart = useQuizPartPerformance({ active: cloudActive, userId: migration.userId });
  const performance = modulePerformance(s, quizByPart);
  const weakestAreas = performance.slice(0, 2);
  const strongestAreas = performance.slice(-2).reverse();
  const selectedNotes = s.notes.filter(n => !deselectedNoteIds.has(n.id));

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 'var(--space-4)' }}>
        {stats.map(st => (
          <div key={st.label} className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', opacity: .65 }}>{st.label}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '38px', lineHeight: 1.1, fontWeight: 400, fontFeatureSettings: "'tnum'", marginTop: '4px' }}>{st.value}</div>
            <div style={{ fontSize: '12px', opacity: .65 }}>{st.sub}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 'var(--space-4) var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <h4 style={{ margin: 0 }}>Study goal</h4>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ margin: 0 }}>
              <label>
                Exam date
                <input className="input" type="date" value={s.examDate || ''} onChange={e => actions.setExamDate(e.target.value)} />
              </label>
            </div>
            <div className="field" style={{ margin: 0, width: '110px' }}>
              <label>
                Daily goal (min)
                <input className="input" type="number" min={5} value={s.dailyGoalMinutes} onChange={e => actions.setDailyGoalMinutes(Math.max(5, Number(e.target.value) || 5))} />
              </label>
            </div>
          </div>
        </div>
        <hr className="hr" style={{ margin: 'var(--space-3) 0' }} />
        {examDays === null && (
          <p style={{ fontSize: '13px', opacity: .65, margin: 0 }}>Set your exam date above to see a countdown here and in the sidebar.</p>
        )}
        {examDays !== null && (
          <p style={{ fontSize: '14px', margin: '0 0 var(--space-4)' }}>
            {examDays > 0 ? <strong>{examDays} day{examDays === 1 ? '' : 's'}</strong> : examDays === 0 ? <strong>Today</strong> : <strong>Passed</strong>}
            {examDays > 0 ? ' until your exam.' : examDays === 0 ? ' is exam day.' : ' — update the date above if this is out of date.'}
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 'var(--space-4)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>Today</span>
              <span style={{ fontFeatureSettings: "'tnum'", opacity: .7 }}>{todayGoal.done} / {todayGoal.goal} min</span>
            </div>
            <div style={{ height: '5px', background: 'var(--color-divider)', borderRadius: '3px', marginTop: '6px' }}>
              <div style={{ width: todayGoal.pct + '%', height: '100%', borderRadius: '3px', background: todayGoal.pct >= 100 ? 'var(--success-ink)' : 'var(--color-accent)' }}></div>
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>Last 7 days (avg)</span>
              <span style={{ fontFeatureSettings: "'tnum'", opacity: .7 }}>{weekGoal.avg} / {weekGoal.goal} min</span>
            </div>
            <div style={{ height: '5px', background: 'var(--color-divider)', borderRadius: '3px', marginTop: '6px' }}>
              <div style={{ width: weekGoal.pct + '%', height: '100%', borderRadius: '3px', background: weekGoal.pct >= 100 ? 'var(--success-ink)' : 'var(--color-accent)' }}></div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 'var(--space-4)' }}>
        {kpis.map(st => (
          <div key={st.label} className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', opacity: .65 }}>{st.label}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '30px', lineHeight: 1.1, fontWeight: 400, fontFeatureSettings: "'tnum'", marginTop: '4px' }}>{st.value}</div>
            <div style={{ fontSize: '12px', opacity: .65 }}>{st.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 'var(--space-8)' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <h4 style={{ margin: 0 }}>Study hours trend</h4>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[7, 30, 90].map(d => (
                <button key={d} type="button" aria-pressed={trendDays === d} style={chip(trendDays === d, true)} onClick={() => setTrendDays(d)}>{d}d</button>
              ))}
            </div>
          </div>
          <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-4)' }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: trendDays === 7 ? 'var(--space-3)' : '2px', height: '150px' }}>
            {chart.map((c, i) => (
              <div key={i} title={c.title} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', height: '100%' }}>
                {trendDays === 7 && <div style={{ fontSize: '11px', fontFeatureSettings: "'tnum'", opacity: .7 }}>{c.minsLabel}</div>}
                <div style={c.barStyle}></div>
                {trendDays === 7 && <div style={{ fontSize: '11px', letterSpacing: '.06em', textTransform: 'uppercase', opacity: .65 }}>{c.dayLabel}</div>}
              </div>
            ))}
          </div>
          <p style={{ fontSize: '12px', opacity: .65, margin: 'var(--space-3) 0 0' }}>
            {(trendTotalMins / 60).toFixed(1)} hours · studied {trendDaysStudied} of the last {trendDays} days
          </p>
        </div>
        <div>
          <h4>Mastery heatmap</h4>
          <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-4)' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {heatCells.map((h, i) => <div key={i} title={h.title} style={h.style}></div>)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', marginTop: 'var(--space-3)', fontSize: '12px', opacity: .75 }}>
            {heatLegend.map(l => (
              <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <i style={l.style}></i>{l.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 'var(--space-8)' }}>
        <div>
          <h4>Today's agenda</h4>
          <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-3)' }} />
          {agenda.length === 0 && <p style={{ fontSize: '13px', opacity: .65, margin: 0 }}>Nothing open — add a task to see it here.</p>}
          {agenda.map(({ t, vm }) => (
            <div key={t.id} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-divider)' }}>
              <button type="button" onClick={() => actions.toggleTask(t.id)} role="checkbox" aria-checked={vm.done} aria-label={vm.title} style={checkbox(vm.done)}>{vm.mark}</button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', textDecoration: vm.done ? 'line-through' : 'none', opacity: vm.done ? 0.55 : 1 }}>{vm.title}</div>
                <div style={{ fontSize: '12px', opacity: .65, fontFeatureSettings: "'tnum'" }}>{vm.meta}</div>
              </div>
              <span className="tag tag-outline" style={{
                ...chip(vm.priority === 'High', true),
                color: vm.priority === 'High' ? 'var(--danger-ink)' : 'var(--color-text)',
                borderColor: vm.priority === 'High' ? 'var(--danger-ink)' : 'var(--color-divider)',
                cursor: 'default'
              }}>{vm.priority}</span>
            </div>
          ))}
        </div>
        <div>
          <h4>Course progress</h4>
          <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-3)' }} />
          {courseProgress.map(m => (
            <div key={m.name} style={{ padding: 'var(--space-2) 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', fontSize: '14px' }}>
                <span>{m.name}</span>
                <span style={{ fontFeatureSettings: "'tnum'", opacity: .7 }}>{m.label}</span>
              </div>
              <div style={{ height: '3px', background: 'var(--color-divider)', marginTop: '6px' }}>
                <div style={m.fillStyle}></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4>Time by module</h4>
        <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-3)' }} />
        {timeByModule.every(m => m.name === 'Unlinked') && (
          <p style={{ fontSize: '13px', opacity: .65, margin: 0 }}>
            No sessions linked to a topic yet — pick one under "Currently studying" on the Study sessions page.
          </p>
        )}
        {timeByModule.map(m => (
          <div key={m.name} style={{ padding: 'var(--space-2) 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', fontSize: '14px' }}>
              <span>{m.name}</span>
              <span style={{ fontFeatureSettings: "'tnum'", opacity: .7 }}>{m.label}</span>
            </div>
            <div style={{ height: '3px', background: 'var(--color-divider)', marginTop: '6px' }}>
              <div style={m.fillStyle}></div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 'var(--space-8)' }}>
        <div>
          <h4>Time by topic</h4>
          <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-3)' }} />
          {topTopics.length === 0 && (
            <p style={{ fontSize: '13px', opacity: .65, margin: 0 }}>No topic-linked sessions yet.</p>
          )}
          {topTopics.map(t => (
            <div key={t.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', padding: 'var(--space-2) 0', fontSize: '13px', borderBottom: '1px solid var(--color-divider)' }}>
              <span>{t.topic}<span style={{ opacity: .65 }}> · {t.module}</span></span>
              <span style={{ fontFeatureSettings: "'tnum'", opacity: .7, flex: 'none' }}>{t.label}</span>
            </div>
          ))}
        </div>
        <div>
          <h4>Weekly consistency</h4>
          <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-4)' }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '110px' }}>
            {weeks.map((w, i) => (
              <div key={i} title={w.label + ': ' + w.daysStudied + '/7 days studied'} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', height: '100%' }}>
                <div style={{ fontSize: '11px', fontFeatureSettings: "'tnum'", opacity: .7 }}>{w.daysStudied}</div>
                <div style={{
                  width: '100%', height: Math.max(2, Math.round((w.daysStudied / 7) * 100)) + '%',
                  background: w.daysStudied ? 'color-mix(in srgb, var(--color-accent) 28%, transparent)' : 'transparent',
                  borderTop: '2px solid ' + (w.daysStudied ? 'var(--color-accent)' : 'var(--color-divider)'),
                  borderRadius: '2px 2px 0 0'
                }}></div>
                <div style={{ fontSize: '10px', letterSpacing: '.04em', textTransform: 'uppercase', opacity: .65 }}>{w.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 'var(--space-8)' }}>
        <div>
          <h4>Quiz performance trend</h4>
          <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-3)' }} />
          {quizSeries.length === 0 && <p style={{ fontSize: '13px', opacity: .65, margin: 0 }}>No test attempts yet.</p>}
          {quizSeries.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-2)', height: '110px' }}>
                {quizSeries.map((a, i) => (
                  <div key={i} title={a.when + ' · ' + a.mode + ' · ' + a.pct + '%'} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: '100%' }}>
                    <div style={{
                      width: '100%', height: Math.max(2, a.pct) + '%',
                      background: a.pct >= 60 ? 'color-mix(in srgb, var(--color-accent) 28%, transparent)' : 'color-mix(in srgb, var(--danger-ink) 22%, transparent)',
                      borderTop: '2px solid ' + (a.pct >= 60 ? 'var(--color-accent)' : 'var(--danger-ink)'),
                      borderRadius: '2px 2px 0 0'
                    }}></div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '12px', opacity: .65, margin: 'var(--space-3) 0 0' }}>
                Last {quizSeries.length} attempt{quizSeries.length > 1 ? 's' : ''}, oldest to newest · red bars are below the 60% qualifying mark
              </p>
            </>
          )}
        </div>
        <div>
          <h4>Strongest / weakest areas</h4>
          <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-3)' }} />
          <p style={{ fontSize: '12px', opacity: .65, margin: '0 0 var(--space-3)' }}>
            Ranked by syllabus mastery; quiz accuracy shown where you have test attempts for that part of the paper.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 'var(--space-4)' }}>
            <div>
              <div style={{ fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', opacity: .65, marginBottom: '6px' }}>Needs the most work</div>
              {weakestAreas.map(m => (
                <div key={m.name} style={{ padding: 'var(--space-1) 0' }}>
                  <div style={{ fontSize: '13px' }}>{m.name}</div>
                  <div style={{ fontSize: '12px', opacity: .65, fontFeatureSettings: "'tnum'" }}>
                    {m.confidencePct}% mastered{m.quizPct !== null ? ' · ' + m.quizPct + '% quiz avg' : ''}
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', opacity: .65, marginBottom: '6px' }}>Strongest</div>
              {strongestAreas.map(m => (
                <div key={m.name} style={{ padding: 'var(--space-1) 0' }}>
                  <div style={{ fontSize: '13px' }}>{m.name}</div>
                  <div style={{ fontSize: '12px', opacity: .65, fontFeatureSettings: "'tnum'" }}>
                    {m.confidencePct}% mastered{m.quizPct !== null ? ' · ' + m.quizPct + '% quiz avg' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h4>Flashcard progress</h4>
        <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-3)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 'var(--space-4)' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', opacity: .65 }}>Seeded deck</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>{seededProgress.reviewed}/{seededProgress.total} reviewed at least once</div>
            <div style={{ fontSize: '12px', opacity: .65 }}>{seededProgress.dueNow} due now · avg ease {seededProgress.avgEase.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', opacity: .65 }}>Your flashcards</div>
            {customProgress.total === 0 && <div style={{ fontSize: '13px', marginTop: '4px', opacity: .65 }}>None yet</div>}
            {customProgress.total > 0 && (
              <>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>{customProgress.reviewed}/{customProgress.total} reviewed at least once</div>
                <div style={{ fontSize: '12px', opacity: .65 }}>{customProgress.dueNow} due now · avg ease {customProgress.avgEase.toFixed(2)}</div>
              </>
            )}
          </div>
        </div>
      </div>

      <div>
        <h4>Revision sheet</h4>
        <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-3)' }} />
        <p style={{ fontSize: '12px', opacity: .65, margin: '0 0 var(--space-3)' }}>
          Choose which notes to include, then print a one-page summary with your exam countdown, weakest/strongest areas, and the selected notes.
        </p>
        {s.notes.length === 0 && (
          <p style={{ fontSize: '13px', opacity: .65, margin: '0 0 var(--space-3)' }}>No notes yet — add some in the Notes tab first.</p>
        )}
        {s.notes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: 'var(--space-4)' }}>
            {s.notes.map(n => (
              <label key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={!deselectedNoteIds.has(n.id)} onChange={() => toggleNoteSelected(n.id)} />
                {n.title || 'Untitled note'}
              </label>
            ))}
          </div>
        )}
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Print revision sheet
        </button>
      </div>

      {createPortal(
        <div className="print-only">
          <h1 style={{ fontFamily: 'var(--font-heading)', margin: '0 0 4px' }}>HTET Study Desk — Revision Sheet</h1>
          <p style={{ margin: '0 0 16px', fontSize: '13px' }}>{s.level} · Generated {fmtShort(today())}</p>
          <p style={{ fontSize: '14px', margin: '0 0 16px' }}>
            {examDays === null && 'No exam date set.'}
            {examDays !== null && (
              examDays > 0 ? examDays + ' day' + (examDays === 1 ? '' : 's') + ' until your exam.'
                : examDays === 0 ? 'Today is exam day.'
                : 'Exam date has passed.'
            )}
          </p>
          <h3>Weakest areas</h3>
          <ul>
            {weakestAreas.map(m => (
              <li key={m.name}>{m.name} — {m.confidencePct}% mastered{m.quizPct !== null ? ' · ' + m.quizPct + '% quiz avg' : ''}</li>
            ))}
          </ul>
          <h3>Strongest areas</h3>
          <ul>
            {strongestAreas.map(m => (
              <li key={m.name}>{m.name} — {m.confidencePct}% mastered{m.quizPct !== null ? ' · ' + m.quizPct + '% quiz avg' : ''}</li>
            ))}
          </ul>
          {selectedNotes.length > 0 && <h3>Notes</h3>}
          {selectedNotes.map(n => (
            <div key={n.id} style={{ marginBottom: '16px', pageBreakInside: 'avoid' }}>
              <h4 style={{ margin: '0 0 4px' }}>{n.title || 'Untitled note'}</h4>
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(n.body) }} />
            </div>
          ))}
        </div>,
        document.body
      )}
    </section>
  );
}
