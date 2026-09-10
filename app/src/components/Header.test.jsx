import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { AppProvider } from '../AppContext.jsx';
import Header from './Header.jsx';

// Phase 29: keyboard navigation for the search dropdown the "/"/⌘K
// shortcut opens. The wrap-around tests below deliberately don't hardcode
// how many results a query returns (real seeded notes/tasks/syllabus
// content could reasonably change later) -- they read "first"/"last" off
// whatever's actually rendered, so they stay valid regardless.
beforeEach(() => {
  localStorage.clear();
});

function withProvider(children) {
  return render(<AppProvider>{children}</AppProvider>);
}

function search(query) {
  const input = screen.getByRole('combobox', { name: 'Search' });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: query } });
  return input;
}

describe('Header search: combobox semantics', () => {
  it('collapses to a plain, unexpanded combobox with no query', () => {
    withProvider(<Header />);
    const input = screen.getByRole('combobox', { name: 'Search' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).not.toHaveAttribute('aria-controls');
    expect(input).not.toHaveAttribute('aria-activedescendant');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('expands and exposes the results as a labeled, grouped listbox', () => {
    withProvider(<Header />);
    const input = search('cheat sheet');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox', { name: 'Search results' });
    expect(within(listbox).getAllByRole('group').length).toBeGreaterThan(0);
    expect(within(listbox).getAllByRole('option').length).toBe(1);
  });
});

describe('Header search: keyboard activation', () => {
  it('ArrowDown highlights the single match, and Enter activates it (clearing the query)', () => {
    withProvider(<Header />);
    const input = search('cheat sheet');
    const option = screen.getByRole('option');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(option).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', option.id);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('Enter does nothing while no option is highlighted', () => {
    withProvider(<Header />);
    const input = search('cheat sheet');
    fireEvent.keyDown(input, { key: 'Enter' });
    // The query is untouched (no go() fired) and the dropdown is still open.
    expect(input.value).toBe('cheat sheet');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('Escape clears the query and closes the dropdown', () => {
    withProvider(<Header />);
    const input = search('cheat sheet');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('ArrowUp/ArrowDown wrap around the ends of the (multi-item) result list', () => {
    withProvider(<Header />);
    const input = search('Haryana'); // matches a seeded note, a seeded task, and syllabus topics
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(1);
    const first = options[0];
    const last = options[options.length - 1];

    // Nothing highlighted yet -- ArrowUp wraps backward to the last item.
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveAttribute('aria-activedescendant', last.id);
    expect(last).toHaveAttribute('aria-selected', 'true');

    // From the last item, ArrowDown wraps forward to the first.
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', first.id);
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(last).toHaveAttribute('aria-selected', 'false');
  });

  it('typing a new character resets the highlight', () => {
    withProvider(<Header />);
    const input = search('cheat sheet');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant');

    fireEvent.change(input, { target: { value: 'cheat sheets' } });
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });
});

describe('Header search: accessibility', () => {
  it('the open dropdown has no axe violations', async () => {
    const { container } = withProvider(<Header />);
    search('Haryana');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
