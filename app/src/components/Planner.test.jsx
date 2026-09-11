import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider } from '../AppContext.jsx';
import Planner from './Planner.jsx';

// Smoke coverage for the wiring (mirrors Dashboard.test.jsx): mounts inside
// the real AppProvider, no Supabase configured, so generateWeekPlan runs
// against the local-only fallback path (generatePlanState in logic.js).
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

function renderPlanner() {
  return render(
    <AppProvider>
      <Planner />
    </AppProvider>
  );
}

describe('Planner', () => {
  it('shows an empty state and a "Generate my week" button before any plan exists', () => {
    renderPlanner();
    expect(screen.getByText(/No plan yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate my week' })).toBeInTheDocument();
  });

  it('generating a week creates 7 items rotating through the weakest modules', () => {
    renderPlanner();
    fireEvent.click(screen.getByRole('button', { name: 'Generate my week' }));

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(7);
    // All seeded modules tie at 0% confidence, so the two weakest (by
    // stable sort order) are the first two syllabus modules for the
    // default level.
    expect(screen.getAllByText('Child Development & Pedagogy').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Language I — Hindi').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Regenerate my week' })).toBeInTheDocument();
  });

  it('toggling a plan item marks it done, and delete removes it', () => {
    renderPlanner();
    fireEvent.click(screen.getByRole('button', { name: 'Generate my week' }));

    const firstCheckbox = screen.getAllByRole('checkbox')[0];
    expect(firstCheckbox).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(firstCheckbox);
    expect(firstCheckbox).toHaveAttribute('aria-checked', 'true');

    const deleteButtons = screen.getAllByRole('button', { name: /^Delete plan item/ });
    expect(deleteButtons).toHaveLength(7);
    fireEvent.click(deleteButtons[0]);
    expect(screen.getAllByRole('checkbox')).toHaveLength(6);
  });
});
