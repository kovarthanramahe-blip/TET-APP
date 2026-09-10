import React from 'react';
import { useApp } from '../AppContext.jsx';
import { modulesFor, modulesWithCustom, confOf, confColor, confName, topicKey } from '../lib/logic.js';
import { chip } from '../lib/styleHelpers.js';

export default function Syllabus() {
  const { state: s, actions } = useApp();
  const modules = modulesWithCustom(s);
  const moduleNames = modulesFor(s).map(m => m.name);
  const customForLevel = s.customTopics.filter(t => t.level === s.level);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <p style={{ maxWidth: '72ch', opacity: .8, margin: 0 }}>
        Course → module → topic → sub-topic. Tap a topic to cycle its confidence: needs work, moderate, mastered.
        The heatmap and dashboard read from these marks. Topics you add yourself count toward mastery the same way,
        but can't be linked from notes, tasks, or study sessions.
      </p>
      {modules.map((m, mi) => {
        const done = m.topics.filter(t => confOf(s, m.name, t[0]) === 3).length;
        const isCustomModule = !moduleNames.includes(m.name);
        return (
          <div key={m.name} className="card" style={{ padding: 'var(--space-4) var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--accent-ink)', fontFeatureSettings: "'tnum'" }}>
                  {isCustomModule ? 'Custom module' : 'Module ' + (mi + 1) + ' · ' + m.weight + ' marks'}
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
                const customTopic = customForLevel.find(ct => ct.moduleName === m.name && ct.name === t[0]);
                return (
                  <div key={t[0]} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Decorative duplicate of the labeled chip button below (same
                        cycle() action) -- hidden from keyboard/screen-reader
                        navigation so it isn't a blank, unlabeled tab-stop; the
                        chip button is the one accessible way to reach this
                        control by keyboard. Still mouse/touch-clickable. */}
                    <button type="button" onClick={cycle} tabIndex={-1} aria-hidden="true" style={{
                      width: '14px', height: '14px', flex: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0,
                      background: c ? confColor(c) : 'transparent',
                      border: '1px solid ' + (c ? confColor(c) : 'var(--color-divider)')
                    }}></button>
                    <div style={{ flex: '1 1 220px' }}>
                      <div style={{ fontSize: '14px' }}>
                        {t[0]}
                        {customTopic && (
                          <span style={{ fontSize: '10px', letterSpacing: '.08em', textTransform: 'uppercase', opacity: .55, marginLeft: '6px' }}>
                            Custom
                          </span>
                        )}
                      </div>
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
                    <button type="button" onClick={cycle} aria-label={t[0] + ' confidence: ' + confName(c) + '. Press to cycle.'} style={{
                      ...chip(c > 0, true),
                      color: c ? confColor(c) : 'var(--color-text)',
                      borderColor: c ? confColor(c) : 'var(--color-divider)',
                      background: 'transparent', minWidth: '96px'
                    }}>{confName(c)}</button>
                    {customTopic && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        aria-label={'Delete custom topic ' + t[0]}
                        style={{ fontSize: '11px', color: '#b3392f', padding: '2px 4px' }}
                        onClick={() => actions.deleteCustomTopic(customTopic.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="card" style={{ padding: 'var(--space-4) var(--space-6)' }}>
        <h4 style={{ margin: 0 }}>Add a custom topic</h4>
        <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-3)' }} />
        <p style={{ fontSize: '12px', opacity: .6, margin: '0 0 var(--space-3)' }}>
          Added to {s.level}. Pick an existing module to fold it in, or type a new one to start a custom module.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 200px' }}>
            <label>
              Module
              <input
                className="input" type="text" list="syllabus-module-names"
                value={s.customTopicModule} onChange={e => actions.setCustomTopicModule(e.target.value)}
                placeholder="e.g. Child Development & Pedagogy"
              />
              <datalist id="syllabus-module-names">
                {moduleNames.map(name => <option key={name} value={name} />)}
              </datalist>
            </label>
          </div>
          <div className="field" style={{ flex: '1 1 200px' }}>
            <label>
              Topic
              <input className="input" type="text" value={s.customTopicName} onChange={e => actions.setCustomTopicName(e.target.value)} placeholder="Topic name" />
            </label>
          </div>
          <div className="field" style={{ flex: '2 1 240px' }}>
            <label>
              Description (optional)
              <input className="input" type="text" value={s.customTopicDesc} onChange={e => actions.setCustomTopicDesc(e.target.value)} placeholder="What this covers" />
            </label>
          </div>
          <button type="button" className="btn btn-primary" onClick={actions.addCustomTopic}>Add topic</button>
        </div>
      </div>
    </section>
  );
}
