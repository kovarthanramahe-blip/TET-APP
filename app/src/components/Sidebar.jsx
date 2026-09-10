import React, { useEffect, useRef } from 'react';
import { useApp } from '../AppContext.jsx';
import { VIEWS, SYLLABUS, navBadgesFor, daysUntilExam } from '../lib/logic.js';
import { navBtn } from '../lib/styleHelpers.js';
import AccountPanel from './AccountPanel.jsx';
import ExportPanel from './ExportPanel.jsx';
import BackupPanel from './BackupPanel.jsx';
import ReminderPanel from './ReminderPanel.jsx';
import InstallPrompt from './InstallPrompt.jsx';

// Phase 27: this same element is an always-visible column on desktop and an
// off-canvas drawer on mobile (see .app-sidebar in styles.css) -- `open`
// only ever becomes true via App.jsx's hamburger button, which itself only
// renders under the mobile breakpoint, so the dialog role/focus handling
// below is only ever exercised there. On desktop `open` stays false and
// none of it engages.
export default function Sidebar({ open = false, onRequestClose = () => {} }) {
  const { state, actions } = useApp();
  const navBadges = navBadgesFor(state);
  const examDays = daysUntilExam(state);
  const asideRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const node = asideRef.current;
    node?.querySelector('.sidebar-close-btn')?.focus();

    // Locks background scroll while the drawer is open -- a standard
    // off-canvas-menu behavior, and without it a long page (Dashboard, at
    // ~1600px tall on a phone) keeps scrolling underneath the open drawer.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function focusable() {
      return Array.from(node.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter(el => !el.disabled);
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onRequestClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onRequestClose]);

  return (
    // Phase 27: this is a <div>, not the more semantically obvious <aside>,
    // specifically so it can carry role="dialog" when acting as the mobile
    // drawer -- axe (correctly) flags "dialog" as a disallowed role
    // override on <aside> per ARIA in HTML (its allowed roles are
    // complementary/feed/none/note/presentation/region/search, no dialog).
    <div
      ref={asideRef}
      className={'app-sidebar' + (open ? ' sidebar-open' : '')}
      role={open ? 'dialog' : undefined}
      aria-modal={open ? 'true' : undefined}
      aria-label={open ? 'Navigation menu' : undefined}
    >
      <button type="button" className="sidebar-close-btn" aria-label="Close menu" onClick={onRequestClose}>×</button>
      <div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', lineHeight: 1.05, letterSpacing: '-0.02em' }}>
          HTET<br />Preparation
        </div>
        <div style={{
          fontSize: '11px', letterSpacing: '.14em', textTransform: 'uppercase', marginTop: '6px',
          color: 'var(--accent-ink)', fontFeatureSettings: "'tnum'"
        }}>
          Haryana TET · Study Desk
        </div>
        {examDays !== null && (
          <div style={{ fontSize: '12px', marginTop: '10px', opacity: .8, fontFeatureSettings: "'tnum'" }}>
            {examDays > 0 ? examDays + ' day' + (examDays === 1 ? '' : 's') + ' to your exam'
              : examDays === 0 ? 'Exam is today'
              : 'Exam date has passed'}
          </div>
        )}
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {VIEWS.map(v => (
          <button
            key={v[0]}
            type="button"
            onClick={() => actions.setView(v[0])}
            aria-current={state.view === v[0] ? 'page' : undefined}
            style={navBtn(state.view === v[0])}
          >
            <span>{v[1]}</span>
            {/* Phase 25: full opacity for the active nav item -- same
                tinted-background reasoning as Notes.jsx's topic caption. */}
            <span style={{ fontSize: '11px', fontFeatureSettings: "'tnum'", opacity: state.view === v[0] ? 1 : .75 }}>{navBadges[v[0]] || ''}</span>
          </button>
        ))}
      </nav>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <AccountPanel />

        <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-3)' }}>
          <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', opacity: .65, marginBottom: '4px' }}>
            Exam level
          </div>
          {Object.keys(SYLLABUS).map(lv => (
            <button
              key={lv}
              type="button"
              onClick={() => actions.setLevel(lv)}
              aria-pressed={state.level === lv}
              style={{ ...navBtn(state.level === lv), fontSize: '13px', padding: '5px 9px', marginBottom: '3px' }}
            >
              {lv}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={actions.toggleTheme}
          aria-pressed={state.theme === 'dark'}
          style={{ justifyContent: 'space-between' }}
        >
          <span>{state.theme === 'dark' ? 'Dark' : 'Light'}</span>
          <span style={{ opacity: .65, fontSize: '12px' }}>theme</span>
        </button>

        <InstallPrompt />

        <ExportPanel />
        <BackupPanel />
        <ReminderPanel />

        <div aria-live="polite">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={actions.resetProgress}
            style={{
              justifyContent: 'center',
              borderColor: state.confirmReset ? 'var(--danger-ink)' : 'var(--color-divider)',
              color: state.confirmReset ? 'var(--danger-ink)' : 'var(--color-text)'
            }}
          >
            {state.confirmReset ? 'Tap again to confirm' : 'Reset my progress'}
          </button>
          <p style={{ fontSize: '11px', opacity: .65, margin: 'var(--space-2) 0 0', lineHeight: 1.4 }}>
            {state.confirmReset
              ? 'Clears every logged session, streak, test attempt, card schedule and mastery mark. Syllabus, tasks and notes stay.'
              : 'Start from zero — clears the sample study data.'}
          </p>
        </div>
      </div>
    </div>
  );
}
