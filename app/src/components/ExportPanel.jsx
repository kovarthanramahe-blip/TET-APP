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
        {buttons.map(b => (
          <button key={b.label} type="button" className="btn btn-secondary" style={{ fontSize: '12px', padding: '5px 9px' }} onClick={b.run}>
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
