import React from 'react';
import { useApp } from '../AppContext.jsx';
import { navBtn } from '../lib/styleHelpers.js';
import { renderMarkdown } from '../lib/markdown.js';
import { modulesFor, topicKey } from '../lib/logic.js';

export default function Notes() {
  const { state: s, actions } = useApp();
  const note = s.notes.find(n => n.id === s.activeNote) || s.notes[0] || { id: '', title: '', topic: '', topicId: null, body: '' };

  const pickTopic = (key) => {
    if (!key) { actions.updateNote(note.id, { topicId: null }); return; }
    // key is "level|module|topic" (topicKey() in logic.js) -- reuse it
    // directly rather than re-parsing the module/topic name back out
    // wherever possible, but the free-text label still needs them split out.
    const [, moduleName, topicName] = key.split('|');
    actions.updateNote(note.id, { topicId: key, topic: moduleName + ' · ' + topicName });
  };

  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,240px) 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
      <div>
        <button type="button" className="btn btn-primary btn-block" onClick={actions.addNote} style={{ margin: '0 0 var(--space-3)' }}>New note</button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {s.notes.map(n => (
            <button key={n.id} type="button" onClick={() => actions.setActiveNote(n.id)}
              style={{ ...navBtn(n.id === note.id), flexDirection: 'column', alignItems: 'flex-start', gap: '0' }}>
              <span style={{ fontSize: '14px' }}>{n.title || 'Untitled'}</span>
              <span style={{ fontSize: '11px', opacity: .6 }}>{n.topic}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 'var(--space-3)' }}>
          <div className="field" style={{ flex: '2 1 200px' }}>
            <label>Title</label>
            <input className="input" type="text" value={note.title} onChange={e => actions.updateNote(note.id, { title: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 200px' }}>
            <label>Link to topic</label>
            <select className="input" value={note.topicId || ''} onChange={e => pickTopic(e.target.value)}>
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
          <div className="field" style={{ flex: '1 1 180px' }}>
            <label>Attached to</label>
            <input className="input" type="text" value={note.topic} onChange={e => actions.updateNote(note.id, { topic: e.target.value })} placeholder="Course · module · topic" />
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => actions.deleteNote(note.id)}>Delete</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 'var(--space-4)' }}>
          <div className="field">
            <label>Markdown</label>
            <textarea className="input" value={note.body} onChange={e => actions.updateNote(note.id, { body: e.target.value })}
              style={{ minHeight: '340px', fontSize: '13px', lineHeight: 1.6 }}></textarea>
          </div>
          <div className="field">
            <label>Preview</label>
            <div className="card" style={{ padding: 'var(--space-4)', minHeight: '340px' }}>
              <div style={{ fontSize: '14px', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(note.body) }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
