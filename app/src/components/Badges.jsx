import React from 'react';
import { useApp } from '../AppContext.jsx';
import { BADGE_DEFS, streakCount, minutesOn, badgeMetricsFor } from '../lib/logic.js';
import { offsetDateString } from '../lib/dates.js';

export default function Badges() {
  const { state: s } = useApp();
  const streak = streakCount(s);

  const streakDots = [];
  for (let i = 13; i >= 0; i--) {
    const d = offsetDateString(-i);
    const m = minutesOn(s, d);
    streakDots.push({
      title: d + ' · ' + m + ' min',
      style: {
        width: '18px', height: '18px', borderRadius: '50%',
        background: m ? 'color-mix(in srgb, var(--color-accent) ' + Math.min(90, 25 + m / 2) + '%, transparent)' : 'transparent',
        border: '1px solid ' + (m ? 'var(--color-accent)' : 'var(--color-divider)')
      }
    });
  }

  const metrics = badgeMetricsFor(s);
  const badges = BADGE_DEFS.map(b => {
    const v = metrics[b.metric] || 0;
    const unlocked = v >= b.target;
    const pct = Math.min(100, Math.round((v / b.target) * 100));
    return {
      name: b.name, desc: b.desc, state: unlocked ? 'Unlocked' : 'Locked',
      progress: Math.min(v, b.target) + ' / ' + b.target,
      style: {
        // Phase 25: this card's own opacity used to drop to 0.75 when
        // locked -- compounding with the "Locked"/progress text's OWN
        // reduced opacity inside it (effectively ~0.75 * 0.65), fading
        // both well past WCAG AA. The border/background difference above
        // already signals locked-vs-unlocked; that's enough on its own.
        padding: 'var(--space-4)', border: '1px solid ' + (unlocked ? 'var(--color-accent)' : 'var(--color-divider)'),
        borderRadius: 'var(--radius-md)', background: unlocked ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'transparent'
      },
      fillStyle: { width: Math.max(1, pct) + '%', height: '100%', background: unlocked ? 'var(--color-accent)' : 'var(--color-neutral-500)' }
    };
  });

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      <div className="card" style={{ padding: 'var(--space-6)', display: 'flex', gap: 'var(--space-8)', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '56px', lineHeight: 1, fontFeatureSettings: "'tnum'" }}>{streak}</div>
          <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', opacity: .65 }}>consecutive days</div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: '1 1 260px' }}>
          {streakDots.map((d, i) => <div key={i} title={d.title} style={d.style}></div>)}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 'var(--space-4)' }}>
        {badges.map(b => (
          <div key={b.name} style={b.style}>
            <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--accent-ink)' }}>{b.state}</div>
            <h4 style={{ margin: '6px 0 2px' }}>{b.name}</h4>
            <p style={{ margin: 0, fontSize: '13px', opacity: .8 }}>{b.desc}</p>
            <div style={{ height: '3px', background: 'var(--color-divider)', marginTop: 'var(--space-3)' }}>
              <div style={b.fillStyle}></div>
            </div>
            <div style={{ fontSize: '11px', opacity: .65, marginTop: '4px', fontFeatureSettings: "'tnum'" }}>{b.progress}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
