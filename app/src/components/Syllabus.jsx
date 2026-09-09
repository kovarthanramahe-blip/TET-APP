import React from 'react';
import { useApp } from '../AppContext.jsx';
import { modulesFor, confOf, confColor, confName, topicKey } from '../lib/logic.js';
import { chip } from '../lib/styleHelpers.js';

export default function Syllabus() {
  const { state: s, actions } = useApp();
  const modules = modulesFor(s);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <p style={{ maxWidth: '72ch', opacity: .8, margin: 0 }}>
        Course → module → topic → sub-topic. Tap a topic to cycle its confidence: needs work, moderate, mastered.
        The heatmap and dashboard read from these marks.
      </p>
      {modules.map((m, mi) => {
        const done = m.topics.filter(t => confOf(s, m.name, t[0]) === 3).length;
        return (
          <div key={m.name} className="card" style={{ padding: 'var(--space-4) var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--accent-ink)', fontFeatureSettings: "'tnum'" }}>
                  Module {mi + 1} · {m.weight} marks
                </div>
                <h4 style={{ margin: '2px 0 0' }}>{m.name}</h4>
              </div>
              <div style={{ fontSize: '12px', opacity: .7, fontFeatureSettings: "'tnum'" }}>
                {done} of {m.topics.length} mastered
              </div>
            </div>
            <hr className="hr" style={{ margin: 'var(--space-3) 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {m.topics.map(t => {
                const c = confOf(s, m.name, t[0]);
                const key = topicKey(s.level, m.name, t[0]);
                const cycle = () => actions.cycleConfidence(key, c);
                const topicNotes = s.notes.filter(n => n.topicId === key);
                const openNotes = () => {
                  actions.setView('notes');
                  if (topicNotes.length) actions.setActiveNote(topicNotes[0].id);
                };
                return (
                  <div key={t[0]} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="button" onClick={cycle} style={{
                      width: '14px', height: '14px', flex: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0,
                      background: c ? confColor(c) : 'transparent',
                      border: '1px solid ' + (c ? confColor(c) : 'var(--color-divider)')
                    }}></button>
                    <div style={{ flex: '1 1 220px' }}>
                      <div style={{ fontSize: '14px' }}>{t[0]}</div>
                      <div style={{ fontSize: '12px', opacity: .6 }}>{t[1]}</div>
                    </div>
                    {topicNotes.length > 0 && (
                      <button type="button" onClick={openNotes} style={{
                        fontSize: '11px', opacity: .7, border: 'none', background: 'transparent',
                        cursor: 'pointer', textDecoration: 'underline', padding: 0, color: 'inherit'
                      }}>
                        {topicNotes.length} note{topicNotes.length > 1 ? 's' : ''}
                      </button>
                    )}
                    <button type="button" onClick={cycle} style={{
                      ...chip(c > 0, true),
                      color: c ? confColor(c) : 'var(--color-text)',
                      borderColor: c ? confColor(c) : 'var(--color-divider)',
                      background: 'transparent', minWidth: '96px'
                    }}>{confName(c)}</button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
