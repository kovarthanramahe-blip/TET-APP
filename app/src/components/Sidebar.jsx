import React from 'react';
import { useApp } from '../AppContext.jsx';
import { VIEWS, SYLLABUS, navBadgesFor } from '../lib/logic.js';
import { navBtn } from '../lib/styleHelpers.js';
import AccountPanel from './AccountPanel.jsx';

export default function Sidebar() {
  const { state, actions } = useApp();
  const navBadges = navBadgesFor(state);

  return (
    <aside style={{
      flex: '0 0 232px', minWidth: '200px', borderRight: '1px solid var(--color-divider)',
      padding: 'var(--space-6) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)'
    }}>
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
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {VIEWS.map(v => (
          <button
            key={v[0]}
            type="button"
            onClick={() => actions.setView(v[0])}
            style={navBtn(state.view === v[0])}
          >
            <span>{v[1]}</span>
            <span style={{ fontSize: '11px', fontFeatureSettings: "'tnum'", opacity: .75 }}>{navBadges[v[0]] || ''}</span>
          </button>
        ))}
      </nav>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <AccountPanel />

        <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-3)' }}>
          <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', opacity: .6, marginBottom: '4px' }}>
            Exam level
          </div>
          {Object.keys(SYLLABUS).map(lv => (
            <button
              key={lv}
              type="button"
              onClick={() => actions.setLevel(lv)}
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
          style={{ justifyContent: 'space-between' }}
        >
          <span>{state.theme === 'dark' ? 'Dark' : 'Light'}</span>
          <span style={{ opacity: .6, fontSize: '12px' }}>theme</span>
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={actions.resetProgress}
          style={{
            justifyContent: 'center',
            borderColor: state.confirmReset ? '#b3392f' : 'var(--color-divider)',
            color: state.confirmReset ? '#b3392f' : 'var(--color-text)'
          }}
        >
          {state.confirmReset ? 'Tap again to confirm' : 'Reset my progress'}
        </button>
        <p style={{ fontSize: '11px', opacity: .6, margin: 0, lineHeight: 1.4 }}>
          {state.confirmReset
            ? 'Clears every logged session, streak, test attempt, card schedule and mastery mark. Syllabus, tasks and notes stay.'
            : 'Start from zero — clears the sample study data.'}
        </p>
      </div>
    </aside>
  );
}
