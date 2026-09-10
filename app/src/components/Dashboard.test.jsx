import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppProvider } from '../AppContext.jsx';
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
});
