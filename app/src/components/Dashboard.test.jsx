import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider, useApp } from '../AppContext.jsx';
import Dashboard from './Dashboard.jsx';

// Smoke coverage for the wiring, not a re-test of logic.js's pure functions
// (already covered directly in logic.test.js): does Dashboard actually
// mount inside the real AppProvider -- cloud hooks included -- without
// Supabase configured, same as it does in the real app in this sandbox
// (there is no app/.env here either), and render its key sections.
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

function renderDashboard() {
  return render(
    <AppProvider>
      <Dashboard />
    </AppProvider>
  );
}

describe('Dashboard', () => {
  it('renders the core sections against the default seeded state', () => {
    renderDashboard();
    expect(screen.getByText('Study goal')).toBeInTheDocument();
    expect(screen.getByText('Strongest / weakest areas')).toBeInTheDocument();
    expect(screen.getByText('Flashcard progress')).toBeInTheDocument();
    expect(screen.getByText('Revision sheet')).toBeInTheDocument();
  });

  it('lists the seeded notes in the revision-sheet checklist, all pre-checked', () => {
    renderDashboard();
    // The note title appears twice: once in the on-screen checklist label,
    // once in the portaled print-only sheet -- find the checklist copy
    // specifically (the one inside a <label>).
    const matches = screen.getAllByText('Learning theories cheat sheet');
    const label = matches.map(el => el.closest('label')).find(Boolean);
    expect(label).not.toBeNull();
    const checkbox = label.querySelector('input[type="checkbox"]');
    expect(checkbox.checked).toBe(true);
  });

  it('portals the print-only sheet to document.body, outside the visible app tree', () => {
    renderDashboard();
    const printOnly = document.querySelector('.print-only');
    expect(printOnly).not.toBeNull();
    expect(printOnly.parentElement).toBe(document.body);
    expect(printOnly.textContent).toContain('Revision Sheet');
  });

  // The revision-sheet selection used to be a "selected ids" whitelist
  // seeded once, on mount, from whatever s.notes was at that instant. For a
  // signed-in user, that's the pre-fetch fallback -- useCloudTasksAndNotes.js's
  // cloud notes start out null and briefly fall back to base.state.notes,
  // with the real list arriving a moment later. Any note that appears
  // AFTER that first render (a cloud note loading in late, or simply a new
  // note added) was never in the whitelist and rendered unchecked despite
  // the feature's whole point being "all notes pre-checked by default".
  // Adding a note via the real addNote() action reproduces the same
  // "a note appears after Dashboard has already mounted" shape without
  // needing to mock Supabase.
  it('pre-checks a note that appears only after Dashboard has already mounted', () => {
    function AddNoteButton() {
      const { actions } = useApp();
      return <button onClick={actions.addNote}>add note for test</button>;
    }
    const { getByText, getAllByText } = render(
      <AppProvider>
        <AddNoteButton />
        <Dashboard />
      </AppProvider>
    );

    fireEvent.click(getByText('add note for test'));

    const matches = getAllByText('New note');
    const label = matches.map(el => el.closest('label')).find(Boolean);
    expect(label).not.toBeNull();
    const checkbox = label.querySelector('input[type="checkbox"]');
    expect(checkbox.checked).toBe(true);
  });

  // "Practice <weakest module>" turns the already-computed weakest-area
  // chart into a one-tap shortcut straight into a filtered practice quiz,
  // instead of a chart the user has to notice, remember, and go set the
  // same filter up for themselves on the Tests page. Dashboard.test.jsx
  // doesn't render the full App shell's view switcher, so this reads the
  // resulting state directly rather than looking for the Quiz component
  // to appear.
  it('"Practice <weakest module>" jumps straight into an active practice quiz filtered to that module\'s part', () => {
    function StateDebug() {
      const { state } = useApp();
      return (
        <div data-testid="debug">
          {JSON.stringify({ view: state.view, quizStage: state.quizStage, quizMode: state.quizMode, quizParts: state.quizParts })}
        </div>
      );
    }
    const { getByRole, getByTestId } = render(
      <AppProvider>
        <StateDebug />
        <Dashboard />
      </AppProvider>
    );

    const button = getByRole('button', { name: /^Practice / });
    fireEvent.click(button);

    const debug = JSON.parse(getByTestId('debug').textContent);
    expect(debug.view).toBe('quiz');
    expect(debug.quizStage).toBe('active');
    expect(debug.quizMode).toBe('Practice');
    expect(debug.quizParts).toHaveLength(1);
  });
});
