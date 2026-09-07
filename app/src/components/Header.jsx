import React from 'react';
import { useApp } from '../AppContext.jsx';
import { VIEWS, streakCount, totalMinutes } from '../lib/logic.js';

export default function Header() {
  const { state } = useApp();
  const cur = VIEWS.find(v => v[0] === state.view) || VIEWS[0];
  const viewTitle = cur[1] === 'Syllabus' ? 'Syllabus — ' + state.level : cur[1];
  const streak = streakCount(state);
  const totalHours = (totalMinutes(state) / 60).toFixed(1);

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
