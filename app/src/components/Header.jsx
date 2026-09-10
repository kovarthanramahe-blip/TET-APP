import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext.jsx';
import { VIEWS, streakCount, totalMinutes, globalSearch } from '../lib/logic.js';

const SEARCH_LISTBOX_ID = 'header-search-listbox';

// Resolves each group's raw result objects (notes/tasks/customCards/topics
// rows) into the {title, sub, go} shape SearchResults renders, and drops
// empty groups -- shared between Header (which needs a flat, ordered list
// for arrow-key navigation) and SearchResults (which renders the same
// items grouped), so the two never define "what's item 0" differently.
function buildSearchGroups(results, { onOpenNote, onOpenView }) {
  return [
    { key: 'notes', label: 'Notes', items: results.notes.map(n => ({ title: n.title, sub: n.topic, go: () => onOpenNote(n.id) })) },
    { key: 'tasks', label: 'Tasks', items: results.tasks.map(t => ({ title: t.title, sub: t.priority + (t.due ? ' · due ' + t.due : ''), go: () => onOpenView('tasks') })) },
    { key: 'customCards', label: 'Your flashcards', items: results.customCards.map(c => ({ title: c.front, sub: c.category, go: () => onOpenView('cards') })) },
    { key: 'topics', label: 'Syllabus', items: results.topics.map(t => ({ title: t.name, sub: t.module, go: () => onOpenView('syllabus') })) }
  ].filter(g => g.items.length > 0);
}

// Phase 29: role="listbox"/"option"/"group" plus the input's
// aria-activedescendant (set by the caller) is the standard ARIA combobox
// pattern -- it lets arrow keys move a virtual selection through the list
// via ID reference alone, without ever moving real DOM focus off the
// input, which is what lets typing and navigating work at the same time.
function SearchResults({ groups, highlightedIndex, onHighlight }) {
  let idx = -1;
  return (
    <div className="card" data-testid="search-results" role="listbox" id={SEARCH_LISTBOX_ID} aria-label="Search results" style={{
      position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 20,
      padding: 'var(--space-3)', maxHeight: '360px', overflowY: 'auto'
    }}>
      {groups.length === 0 && <p style={{ fontSize: '13px', opacity: .65, margin: 0 }}>No matches.</p>}
      {groups.map(g => {
        const groupLabelId = SEARCH_LISTBOX_ID + '-group-' + g.key;
        return (
          <div key={g.key} role="group" aria-labelledby={groupLabelId} style={{ marginBottom: 'var(--space-2)' }}>
            <div id={groupLabelId} style={{ fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase', opacity: .65, margin: '4px 0' }}>{g.label}</div>
            {g.items.map(r => {
              idx++;
              const optionId = SEARCH_LISTBOX_ID + '-option-' + idx;
              const isHighlighted = idx === highlightedIndex;
              return (
                <button
                  key={optionId}
                  id={optionId}
                  type="button"
                  role="option"
                  aria-selected={isHighlighted}
                  onMouseDown={r.go}
                  onMouseEnter={() => onHighlight(idx)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', cursor: 'pointer',
                    background: isHighlighted ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent',
                    border: 'none', borderRadius: 'var(--radius-sm)', color: 'var(--color-text)'
                  }}
                >
                  <div style={{ fontSize: '13px' }}>{r.title || 'Untitled'}</div>
                  {r.sub && <div style={{ fontSize: '11px', opacity: .65 }}>{r.sub}</div>}
                </button>
              );
            })}
          </div>
        );
      })}
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
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const showDropdown = focused && query.trim().length > 0;
  const results = showDropdown ? globalSearch(state, query) : null;
  const searchInputRef = useRef(null);

  const openNote = (id) => { actions.setView('notes'); actions.setActiveNote(id); setQuery(''); };
  const openView = (view) => { actions.setView(view); setQuery(''); };

  const groups = results ? buildSearchGroups(results, { onOpenNote: openNote, onOpenView: openView }) : [];
  const flatItems = groups.flatMap(g => g.items);

  // A fresh query (or the dropdown opening/closing) always starts with
  // nothing highlighted -- carrying over a stale index from the previous
  // keystroke's result set could otherwise silently point Enter at an
  // unrelated item that just happens to share that position.
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [query, showDropdown]);

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

  // Phase 29: the "/"/⌘K shortcut above puts a keyboard user straight into
  // this input, but until now the dropdown it opens could only be picked
  // from with a mouse -- ArrowUp/Down move a virtual selection (via
  // aria-activedescendant, not real focus) and Enter activates it, the
  // same as any standard combobox/autocomplete.
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') { setQuery(''); e.target.blur(); return; }
    if (!showDropdown || flatItems.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => (i + 1) % flatItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => (i <= 0 ? flatItems.length - 1 : i - 1));
    } else if (e.key === 'Enter' && highlightedIndex >= 0 && highlightedIndex < flatItems.length) {
      e.preventDefault();
      flatItems[highlightedIndex].go();
    }
  };

  return (
    <header style={{
      display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'flex-end',
      justifyContent: 'space-between', borderBottom: '1px solid var(--color-divider)',
      paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-6)'
    }}>
      <div>
        <div style={{ fontSize: '11px', letterSpacing: '.14em', textTransform: 'uppercase', opacity: .65 }}>
          {cur[2]}
        </div>
        <h2 style={{ margin: '2px 0 0' }}>{viewTitle}</h2>
      </div>

      <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '340px' }}>
        <input
          ref={searchInputRef}
          className="input"
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? SEARCH_LISTBOX_ID : undefined}
          aria-activedescendant={showDropdown && highlightedIndex >= 0 ? SEARCH_LISTBOX_ID + '-option-' + highlightedIndex : undefined}
          aria-autocomplete="list"
          aria-label="Search"
          placeholder="Search notes, tasks, flashcards, syllabus… (/ or ⌘K)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={handleSearchKeyDown}
        />
        {showDropdown && <SearchResults groups={groups} highlightedIndex={highlightedIndex} onHighlight={setHighlightedIndex} />}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-6)', textAlign: 'right', fontFeatureSettings: "'tnum'" }}>
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '24px' }}>{streak}</div>
          <div style={{ fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', opacity: .65 }}>day streak</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '24px' }}>{totalHours}</div>
          <div style={{ fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', opacity: .65 }}>hours logged</div>
        </div>
      </div>
    </header>
  );
}
