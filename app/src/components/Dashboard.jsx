import React from 'react';
import { useApp } from '../AppContext.jsx';
import {
  totalMinutes, minutesOn, streakCount, bestScore, modulesFor, confOf,
  confColor, confName, taskViewModel
} from '../lib/logic.js';
import { today, fmtWeekday } from '../lib/dates.js';
import { chip, checkbox } from '../lib/styleHelpers.js';

export default function Dashboard() {
  const { state, actions } = useApp();
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

  const chart = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    const m = minutesOn(s, iso);
    const h = Math.max(2, Math.round((m / 120) * 100));
    chart.push({
      day: fmtWeekday(d), mins: m || '—',
      barStyle: {
        width: '100%', height: Math.min(100, h) + '%',
        background: m ? 'color-mix(in srgb, var(--color-accent) 28%, transparent)' : 'transparent',
        borderTop: '2px solid ' + (m ? 'var(--color-accent)' : 'var(--color-divider)'),
        borderRadius: '2px 2px 0 0'
      }
    });
  }

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

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 'var(--space-4)' }}>
        {stats.map(st => (
          <div key={st.label} className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', opacity: .6 }}>{st.label}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '38px', lineHeight: 1.1, fontWeight: 400, fontFeatureSettings: "'tnum'", marginTop: '4px' }}>{st.value}</div>
            <div style={{ fontSize: '12px', opacity: .65 }}>{st.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 'var(--space-8)' }}>
        <div>
          <h4>Last seven days</h4>
          <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-4)' }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)', height: '150px' }}>
            {chart.map((c, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', height: '100%' }}>
                <div style={{ fontSize: '11px', fontFeatureSettings: "'tnum'", opacity: .7 }}>{c.mins}</div>
                <div style={c.barStyle}></div>
                <div style={{ fontSize: '11px', letterSpacing: '.06em', textTransform: 'uppercase', opacity: .6 }}>{c.day}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4>Mastery heatmap</h4>
          <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-4)' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {heatCells.map((h, i) => <div key={i} title={h.title} style={h.style}></div>)}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-3)', fontSize: '12px', opacity: .75 }}>
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
          {agenda.length === 0 && <p style={{ fontSize: '13px', opacity: .6, margin: 0 }}>Nothing open — add a task to see it here.</p>}
          {agenda.map(({ t, vm }) => (
            <div key={t.id} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-divider)' }}>
              <button type="button" onClick={() => actions.toggleTask(t.id)} style={checkbox(vm.done)}>{vm.mark}</button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', textDecoration: vm.done ? 'line-through' : 'none', opacity: vm.done ? 0.55 : 1 }}>{vm.title}</div>
                <div style={{ fontSize: '12px', opacity: .65, fontFeatureSettings: "'tnum'" }}>{vm.meta}</div>
              </div>
              <span className="tag tag-outline" style={{
                ...chip(vm.priority === 'High', true),
                color: vm.priority === 'High' ? '#a03027' : 'var(--color-text)',
                borderColor: vm.priority === 'High' ? '#a03027' : 'var(--color-divider)',
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
    </section>
  );
}
