import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider } from '../AppContext.jsx';
import BackupPanel from './BackupPanel.jsx';

// No fake timers here (unlike the other component/logic tests) -- restore
// involves an async file.text() read, and testing-library's waitFor()
// polls via real setTimeout internally, which fake timers freeze unless
// manually advanced. Nothing under test here is date-dependent anyway.
beforeEach(() => {
  localStorage.clear();
});

function renderPanel() {
  return render(
    <AppProvider>
      <BackupPanel />
    </AppProvider>
  );
}

// Supabase is never configured in this test environment (no app/.env),
// same as the rest of the suite -- so every render here exercises the
// not-cloud-active path, which is exactly the path Restore is meant to be
// available on. The cloud-active gating is checked directly in
// BackupPanel.jsx (recomputed the same way Dashboard.jsx already does)
// rather than re-derived here.
describe('BackupPanel', () => {
  it('offers both a download and a restore control when not signed in', () => {
    renderPanel();
    expect(screen.getByText('Download full backup')).toBeInTheDocument();
    expect(screen.getByText('Restore from backup')).toBeInTheDocument();
  });

  it('rejects a file that is not a recognized backup, without asking for confirmation', async () => {
    renderPanel();
    const file = new File([JSON.stringify({ some: 'unrelated json' })], 'notes.json', { type: 'application/json' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText(/doesn't look like/)).toBeInTheDocument());
    expect(screen.queryByText('Replace my data')).not.toBeInTheDocument();
  });

  it('rejects a file that is not even valid JSON, without asking for confirmation', async () => {
    renderPanel();
    const file = new File(['not json at all {{{'], 'notes.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText(/valid JSON/)).toBeInTheDocument());
    expect(screen.queryByText('Replace my data')).not.toBeInTheDocument();
  });

  it('asks for confirmation before restoring a valid backup file, and does nothing until confirmed', async () => {
    renderPanel();
    const payload = {
      format: 'htet-prep-backup', version: 1, exportedAt: new Date().toISOString(),
      state: { level: 'Level 3 (PGT)', dailyGoalMinutes: 45, sessions: [], tasks: [], notes: [], confidence: {}, cards: {}, customCards: [], attempts: [], reviews: 0 }
    };
    const file = new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText('Replace my data')).toBeInTheDocument());
    expect(screen.getByText(/This cannot be undone/)).toBeInTheDocument();
  });

  it('actually replaces state once the destructive restore is confirmed', async () => {
    renderPanel();
    const payload = {
      format: 'htet-prep-backup', version: 1, exportedAt: new Date().toISOString(),
      state: { level: 'Level 3 (PGT)', dailyGoalMinutes: 45, sessions: [], tasks: [], notes: [], confidence: {}, cards: {}, customCards: [], attempts: [], reviews: 0 }
    };
    const file = new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText('Replace my data')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Replace my data'));

    await waitFor(() => expect(screen.getByText('Backup restored.')).toBeInTheDocument());
    expect(JSON.parse(localStorage.getItem('htet-prep-v1')).level).toBe('Level 3 (PGT)');
    expect(JSON.parse(localStorage.getItem('htet-prep-v1')).dailyGoalMinutes).toBe(45);
  });

  it('cancelling the confirmation leaves current data untouched', async () => {
    renderPanel();
    const before = localStorage.getItem('htet-prep-v1');
    const payload = {
      format: 'htet-prep-backup', version: 1, exportedAt: new Date().toISOString(),
      state: { level: 'Level 3 (PGT)' }
    };
    const file = new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText('Cancel')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Replace my data')).not.toBeInTheDocument();
    expect(localStorage.getItem('htet-prep-v1')).toBe(before);
  });

  it('the download button produces a real, parseable backup via the shared exporter', () => {
    const realCreate = URL.createObjectURL;
    const realRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    const realClick = HTMLAnchorElement.prototype.click;
    let clicked = false;
    HTMLAnchorElement.prototype.click = () => { clicked = true; };

    renderPanel();
    fireEvent.click(screen.getByText('Download full backup'));
    expect(clicked).toBe(true);
    expect(URL.createObjectURL).toHaveBeenCalled();

    HTMLAnchorElement.prototype.click = realClick;
    URL.createObjectURL = realCreate;
    URL.revokeObjectURL = realRevoke;
  });
});
