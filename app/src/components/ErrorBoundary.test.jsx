import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import ErrorBoundary from './ErrorBoundary.jsx';

function Bomb({ shouldThrow }) {
  if (shouldThrow) throw new Error('boom');
  return <div>All good</div>;
}

// React logs its own "The above error occurred in..." warning for every
// caught error on top of this component's own console.error call -- both
// are expected noise for these tests specifically (they exist to trigger
// exactly that), not a real failure signal, so silence console.error only
// for the duration of this file rather than asserting on its output.
let errorSpy;
beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
});

describe('ErrorBoundary', () => {
  it('renders children normally when nothing throws', () => {
    render(<ErrorBoundary><Bomb shouldThrow={false} /></ErrorBoundary>);
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('catches a thrown render error and shows a fallback instead of crashing', () => {
    render(<ErrorBoundary><Bomb shouldThrow={true} /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByText('All good')).not.toBeInTheDocument();
  });

  it('"Try again" re-renders the children, recovering if the error was transient', () => {
    const { rerender } = render(<ErrorBoundary><Bomb shouldThrow={true} /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Swaps in a props.children that won't throw -- the boundary itself is
    // still in its caught-error state at this point (a parent re-render
    // doesn't reset that on its own) and keeps showing the fallback...
    rerender(<ErrorBoundary><Bomb shouldThrow={false} /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // ...until "Try again" clears hasError and it renders the (now
    // non-throwing) children it was already holding.
    fireEvent.click(screen.getByText('Try again'));
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('"Reload page" reloads the page', () => {
    const reload = vi.fn();
    const originalLocation = window.location;
    delete window.location;
    window.location = { ...originalLocation, reload };

    render(<ErrorBoundary><Bomb shouldThrow={true} /></ErrorBoundary>);
    fireEvent.click(screen.getByText('Reload page'));
    expect(reload).toHaveBeenCalledTimes(1);

    window.location = originalLocation;
  });

  it('the fallback state has no axe violations', async () => {
    const { container } = render(<ErrorBoundary><Bomb shouldThrow={true} /></ErrorBoundary>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
