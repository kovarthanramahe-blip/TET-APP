import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext.jsx';
import { VIEWS, streakCount, totalMinutes, globalSearch } from '../lib/logic.js';

function SearchResults({ results, onOpenNote, onOpenView }) {
  const groups = [
    { key: 'notes', label: 'Notes', items: results.notes, render: n => ({ title: n.title, sub: n.topic, go: () => onOpenNote(n.id) }) },
    { key: 'tasks', label: 'Tasks', items: results.tasks, render: t => ({ title: t.title, sub: t.priority + (t.due ? ' · due ' + t.due : ''), go: () => onOpenView('tasks') }) },
    { key: 'customCards', label: 'Your flashcards', items: results.customCards, render: c => ({ title: c.front, sub: c.category, go: () => onOpenView('cards') }) },
    { key: 'topics', label: 'Syllabus', items: results.topics, render: t => ({ title: t.name, sub: t.module, go: () => onOpenView('syllabus') }) }
  ].filter(g => g.items.length > 0);

  return (
    <div className="card" data-testid="search-results" role="region" aria-label="Search results" style={{
      position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 20,
      padding: 'var(--space-3)', maxHeight: '360px', overflowY: 'auto'
    }}>
      {groups.length === 0 && <p style={{ fontSize: '13px', opacity: .6, margin: 0 }}>No matches.</p>}
      {groups.map(g => (
        <div key={g.key} style={{ marginBottom: 'var(--space-2)' }}>
          <div style={{ fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase', opacity: .55, margin: '4px 0' }}>{g.label}</div>
          {g.items.map((item, i) => {
            const r = g.render(item);
            return (
              <button key={i} type="button" onMouseDown={r.go} style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', cursor: 'pointer',
                background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)', color: 'var(--color-text)'
              }}>
                <div style={{ fontSize: '13px' }}>{r.title || 'Untitled'}</div>
                {r.sub && <div style={{ fontSize: '11px', opacity: .6 }}>{r.sub}</div>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function Header() {
  const { state, actions } = useApp();
  const cur = VIEWS.find(v => v[0] === state.view) || VIEWS[0];
  const viewTitle = cur[1] === 'Syllabus' ? 'Syllabus — ' + state.level : cur[1];
  const streak = streakCount(state);
  const totalHours = (totalMinutes(state) / 60).toFixed(1);

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const showDropdown = focused && query.trim().length > 0;
  const results = showDropdown ? globalSearch(state, query) : null;
  const searchInputRef = useRef(null);

  const openNote = (id) => { actions.setView('notes'); actions.setActiveNote(id); setQuery(''); };
  const openView = (view) => { actions.setView(view); setQuery(''); };

  // Keyboard shortcut: "/" or Cmd/Ctrl+K focuses search from anywhere in
  // the app. "/" is ignored while already typing in an editable field
  // (input/textarea/select/contenteditable) so it doesn't hijack the "/"
  // character itself -- e.g. typing it into a note body or a task title.
  useEffect(() => {
    function handleKeyDown(e) {
      const el = document.activeElement;
      const isEditing = el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);
      const isShortcut = (e.key === '/' && !isEditing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k');
      if (isShortcut) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header style={{
      display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'flex-end',
      justifyContent: 'space-between', borderBottom: '1px solid var(--color-divider)',
      paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-6)'
    }}>
      <div>
        <div style={{ fontSize: '11px', letterSpacing: '.14em', textTransform: 'uppercase', opacity: .6 }}>
          {cur[2]}
        </div>
        <h2 style={{ margin: '2px 0 0' }}>{viewTitle}</h2>
      </div>

      <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '340px' }}>
        <input
          ref={searchInputRef}
          className="input"
          type="text"
          aria-label="Search"
          placeholder="Search notes, tasks, flashcards, syllabus… (/ or ⌘K)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={e => { if (e.key === 'Escape') { setQuery(''); e.target.blur(); } }}
        />
        {showDropdown && <SearchResults results={results} onOpenNote={openNote} onOpenView={openView} />}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-6)', textAlign: 'right', fontFeatureSettings: "'tnum'" }}>
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '24px' }}>{streak}</div>
          <div style={{ fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', opacity: .6 }}>day streak</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '24px' }}>{totalHours}</div>
          <div style={{ fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', opacity: .6 }}>hours logged</div>
        </div>
      </div>
    </header>
  );
}
