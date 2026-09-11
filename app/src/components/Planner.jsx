import React from 'react';
import { useApp } from '../AppContext.jsx';
import { modulePerformance } from '../lib/logic.js';
import { fmtWeekday, fmtShort } from '../lib/dates.js';
import { checkbox } from '../lib/styleHelpers.js';
import { useQuizPartPerformance } from '../hooks/useQuizPartPerformance.js';

// Week-ahead planner: a thin view over the plan_items produced by
// generateWeekPlan(). weakestAreas is computed here exactly the way
// Dashboard.jsx computes it (same cloudActive/useQuizPartPerformance/
// modulePerformance chain) so "Generate my week" targets the same modules
// the Dashboard's "Strongest / weakest areas" card already shows the user.
export default function Planner() {
  const { state: s, actions, migration } = useApp();

  const cloudActive = (migration.status === 'success' || migration.status === 'already_migrated') && !!migration.userId;
  const quizByPart = useQuizPartPerformance({ active: cloudActive, userId: migration.userId });
  const weakestAreas = modulePerformance(s, quizByPart).slice(0, 2);

  const items = s.planItems.slice().sort((a, b) => a.date.localeCompare(b.date));

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="card" style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0 }}>This week's plan</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: .7 }}>
            Seven days, built from your weakest modules and daily goal — {s.dailyGoalMinutes} min/day.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => actions.generateWeekPlan(weakestAreas)} disabled={!weakestAreas.length}>
          {items.length ? 'Regenerate my week' : 'Generate my week'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {items.length === 0 && (
          <p style={{ opacity: .65, margin: 0 }}>No plan yet — generate one to get a day-by-day study target for the week ahead.</p>
        )}
        {items.map(item => (
          <div key={item.id} className="card" style={{ padding: 'var(--space-4)', display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => actions.togglePlanItem(item.id)}
              role="checkbox"
              aria-checked={item.done}
              aria-label={'Mark ' + item.moduleName + ' on ' + item.date + ' as done'}
              style={checkbox(item.done)}
            >{item.done ? '✓' : ''}</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.55 : 1 }}>
                {item.moduleName}
              </div>
              <div style={{ fontSize: '12px', opacity: .7, marginTop: '2px', fontFeatureSettings: "'tnum'" }}>
                {fmtWeekday(new Date(item.date + 'T00:00:00'))} · {fmtShort(item.date)} · {item.minutesGoal} min goal
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              aria-label={'Delete plan item for ' + item.date}
              style={{ fontSize: '11px', color: 'var(--danger-ink)', padding: '2px 4px' }}
              onClick={() => actions.deletePlanItem(item.id)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
