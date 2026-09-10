import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { AppProvider } from '../AppContext.jsx';
import Sidebar from '../components/Sidebar.jsx';
import Header from '../components/Header.jsx';
import Dashboard from '../components/Dashboard.jsx';
import StudySessions from '../components/StudySessions.jsx';
import Syllabus from '../components/Syllabus.jsx';
import TasksView from '../components/TasksView.jsx';
import Quiz from '../components/Quiz.jsx';
import Flashcards from '../components/Flashcards.jsx';
import Notes from '../components/Notes.jsx';
import Badges from '../components/Badges.jsx';
import BackupPanel from '../components/BackupPanel.jsx';

// Phase 24: a permanent, CI-enforced accessibility regression net -- axe-core
// scans real rendered output (against the actual WCAG rules, not a manual
// checklist) so a future phase that reintroduces a missing label, a bad
// contrast ratio, or an unreachable control fails the test suite instead of
// shipping unnoticed the way this phase's own findings did for 10 prior
// phases. Each view is rendered in its default state inside the real
// AppProvider (same as Dashboard.test.jsx), not mocked -- these are cheap,
// broad sweeps; the more targeted, state-specific checks below (destructive
// confirm dialogs, the file-picker trigger) are what actually caught real
// bugs during this phase and are kept as their own cases so a regression in
// exactly those states is caught precisely, not just on average.
beforeEach(() => {
  localStorage.clear();
});

function withProvider(children) {
  return render(<AppProvider>{children}</AppProvider>);
}

describe('accessibility: default view states', () => {
  const cases = [
    ['Sidebar + Header (app chrome)', () => <>
      <Sidebar />
      <Header />
    </>],
    ['Dashboard', () => <Dashboard />],
    ['Study sessions', () => <StudySessions />],
    ['Syllabus', () => <Syllabus />],
    ['Tasks', () => <TasksView />],
    ['Tests (quiz setup)', () => <Quiz />],
    ['Flashcards', () => <Flashcards />],
    ['Notes', () => <Notes />],
    ['Achievements', () => <Badges />]
  ];

  for (const [name, Component] of cases) {
    it(`${name} has no axe violations`, async () => {
      const { container } = withProvider(<Component />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  }
});

describe('accessibility: destructive-action confirm states', () => {
  it('BackupPanel\'s "confirm restore" state has no axe violations', async () => {
    const { container, getByText } = withProvider(<BackupPanel />);
    const file = new File([JSON.stringify({ format: 'htet-prep-backup', version: 1, state: { level: 'Level 1 (PRT)' } })], 'b.json', { type: 'application/json' });
    const input = container.querySelector('input[type="file"]');
    const { fireEvent, waitFor } = await import('@testing-library/react');
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => getByText('Replace my data'));

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('BackupPanel\'s error state has no axe violations', async () => {
    const { container, getByText } = withProvider(<BackupPanel />);
    const file = new File(['not json'], 'b.json', { type: 'application/json' });
    const input = container.querySelector('input[type="file"]');
    const { fireEvent, waitFor } = await import('@testing-library/react');
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => getByText(/valid JSON/));

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('accessibility: the "Restore from backup" control is reachable by keyboard', () => {
  it('the underlying file input can receive real DOM focus (not display:none)', () => {
    const { container } = withProvider(<BackupPanel />);
    const input = container.querySelector('input[type="file"]');
    input.focus();
    expect(document.activeElement).toBe(input);
  });
});

describe('accessibility: AccountPanel\'s destructive delete-confirm state', () => {
  // useAuth() depends on Supabase actually being configured (no app/.env in
  // this sandbox -- see every prior phase's testing notes), so the signed-in
  // branch that contains the delete-confirm UI is unreachable through the
  // real hook here. Mocking it is the same technique PwaUpdateBanner.test.jsx
  // already uses for its own unreachable-in-this-sandbox dependency.
  beforeEach(() => {
    vi.doMock('../hooks/useAuth.js', () => ({
      useAuth: () => ({
        configured: true, loading: false, user: { email: 'test@example.com' }, notice: '',
        signInWithGoogle: () => {}, sendMagicLink: () => {}, signOut: () => {}
      })
    }));
  });

  it('has no axe violations once "Delete my account" is clicked', async () => {
    vi.resetModules();
    const { default: AccountPanel } = await import('../components/AccountPanel.jsx');
    const { fireEvent } = await import('@testing-library/react');
    const { container, getByText } = withProvider(<AccountPanel />);
    fireEvent.click(getByText('Delete my account'));

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
