import React from 'react';
import { useApp } from '../AppContext.jsx';
import { taskViewModel } from '../lib/logic.js';
import { chip, checkbox } from '../lib/styleHelpers.js';

export default function TasksView() {
  const { state: s, actions } = useApp();

  const filtered = s.tasks.filter(t => s.taskFilter === 'All' ? true : s.taskFilter === 'Done' ? t.done : !t.done);
  const taskList = filtered.map((t, i) => ({ t, vm: taskViewModel(s, t, i, true) }));

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="card" style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: '3 1 220px' }}>
          <label>
            New task
            <input className="input" type="text" value={s.taskDraft} onChange={e => actions.setTaskDraft(e.target.value)} placeholder="Revise Kohlberg's moral stages" />
          </label>
        </div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label>
            Deadline
            <input className="input" type="date" value={s.taskDue} onChange={e => actions.setTaskDue(e.target.value)} />
          </label>
        </div>
        <div className="field" style={{ flex: '1 1 130px' }}>
          <label>Priority</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            {['High', 'Medium', 'Low'].map(p => (
              <button key={p} type="button" onClick={() => actions.setTaskPriority(p)} aria-pressed={s.taskPriority === p} style={chip(s.taskPriority === p, true)}>{p}</button>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={actions.addTask}>Add task</button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {['Open', 'Done', 'All'].map(f => (
          <button key={f} type="button" onClick={() => actions.setTaskFilter(f)} aria-pressed={s.taskFilter === f} style={chip(s.taskFilter === f, false)}>{f}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {taskList.length === 0 && <p style={{ opacity: .65, margin: 0 }}>Nothing here.</p>}
        {taskList.map(({ t, vm }) => (
          <div key={t.id} className="card" style={{ padding: 'var(--space-4)', display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
            <button type="button" onClick={() => actions.toggleTask(t.id)} role="checkbox" aria-checked={vm.done} aria-label={vm.title} style={checkbox(vm.done)}>{vm.mark}</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', textDecoration: vm.done ? 'line-through' : 'none', opacity: vm.done ? 0.55 : 1 }}>{vm.title}</div>
              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', fontSize: '12px', opacity: .7, marginTop: '2px', fontFeatureSettings: "'tnum'" }}>
                <span>{vm.meta}</span><span>{vm.countdown}</span>
              </div>
              {vm.showQuote && (
                <p style={{
                  fontFamily: 'var(--font-heading)', fontStyle: 'italic', fontSize: '15px', margin: 'var(--space-2) 0 0',
                  paddingLeft: 'var(--space-3)', borderLeft: '1px solid var(--color-accent)', opacity: .9
                }}>{vm.quote}</p>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
              <span style={{
                ...chip(vm.priority === 'High', true),
                color: vm.priority === 'High' ? 'var(--danger-ink)' : 'var(--color-text)',
                borderColor: vm.priority === 'High' ? 'var(--danger-ink)' : 'var(--color-divider)',
                cursor: 'default'
              }}>{vm.priority}</span>
              <button type="button" className="btn btn-ghost" onClick={() => actions.removeTask(t.id)} style={{ fontSize: '12px' }}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
