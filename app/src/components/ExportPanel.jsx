import React from 'react';
import { useApp } from '../AppContext.jsx';
import { exportNotesCSV, exportSessionsCSV, exportQuizAttemptsCSV, exportTasksCSV } from '../lib/exportData.js';

export default function ExportPanel() {
  const { state } = useApp();

  const buttons = [
    { label: 'Notes', run: () => exportNotesCSV(state) },
    { label: 'Sessions', run: () => exportSessionsCSV(state) },
    { label: 'Quiz attempts', run: () => exportQuizAttemptsCSV(state) },
    { label: 'Tasks', run: () => exportTasksCSV(state) }
  ];

  return (
    <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-3)' }}>
      <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', opacity: .65, marginBottom: '6px' }}>
        Export data
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {/* Phase 30: the visible label stays short (matches this sidebar's
            existing density), but "Notes"/"Tasks" here otherwise exactly
            duplicate the Sidebar nav buttons of the same name -- an
            identical accessible name on two controls that do completely
            different things (export a CSV vs. switch views). An explicit
            aria-label disambiguates without changing the compact visual
            text. */}
        {buttons.map(b => (
          <button
            key={b.label}
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '5px 9px' }}
            aria-label={'Export ' + b.label.toLowerCase()}
            onClick={b.run}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
