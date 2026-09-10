import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { AppProvider } from '../AppContext.jsx';
import Sidebar from './Sidebar.jsx';

// Phase 27: mobile off-canvas drawer. jsdom doesn't apply real CSS, so the
// slide/hide behavior driven by .app-sidebar's media query (see styles.css)
// can only be verified in a real browser (done for this phase already) --
// what's practical and durable to keep here is everything that's pure JS
// behavior regardless of viewport: the dialog semantics only appearing
// when `open` is true, focus moving into and being trapped inside the
// drawer, Escape closing it, and it staying axe-clean once open.
beforeEach(() => {
  localStorage.clear();
});

function withProvider(children) {
  return render(<AppProvider>{children}</AppProvider>);
}

describe('Sidebar mobile drawer', () => {
  it('has no dialog semantics when closed (the desktop, always-visible case)', () => {
    const { container } = withProvider(<Sidebar />);
    const aside = container.querySelector('.app-sidebar');
    expect(aside.getAttribute('role')).toBeNull();
    expect(aside.getAttribute('aria-modal')).toBeNull();
  });

  it('gains dialog semantics and moves focus to its close button when open', () => {
    const { container } = withProvider(<Sidebar open onRequestClose={() => {}} />);
    const aside = container.querySelector('.app-sidebar');
    expect(aside.getAttribute('role')).toBe('dialog');
    expect(aside.getAttribute('aria-modal')).toBe('true');
    expect(aside).toHaveAttribute('aria-label', 'Navigation menu');
    expect(document.activeElement).toBe(container.querySelector('.sidebar-close-btn'));
  });

  it('calls onRequestClose when Escape is pressed while open', () => {
    const onRequestClose = vi.fn();
    withProvider(<Sidebar open onRequestClose={onRequestClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('calls onRequestClose when the close button is clicked', () => {
    const onRequestClose = vi.fn();
    const { getByLabelText } = withProvider(<Sidebar open onRequestClose={onRequestClose} />);
    fireEvent.click(getByLabelText('Close menu'));
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('traps Tab focus inside the drawer: Shift+Tab from the first item wraps to the last', () => {
    const { container } = withProvider(<Sidebar open onRequestClose={() => {}} />);
    const focusable = Array.from(
      container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter(el => !el.disabled);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('the open drawer has no axe violations', async () => {
    const { container } = withProvider(<Sidebar open onRequestClose={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
