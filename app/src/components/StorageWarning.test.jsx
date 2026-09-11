import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mocked the same way PwaUpdateBanner.test.jsx isolates itself from
// virtual:pwa-register/react -- StorageWarning only ever reads one field
// (saveFailed) off useApp(), so mocking that directly tests this
// component's own render logic without needing a real AppProvider tree.
let saveFailed = false;
vi.mock('../AppContext.jsx', () => ({
  useApp: () => ({ saveFailed })
}));

const StorageWarning = (await import('./StorageWarning.jsx')).default;

beforeEach(() => {
  saveFailed = false;
});

describe('StorageWarning', () => {
  it('renders nothing while saves are working', () => {
    saveFailed = false;
    const { container } = render(<StorageWarning />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a visible, actionable alert once a save has failed', () => {
    saveFailed = true;
    render(<StorageWarning />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/aren't being saved/)).toBeInTheDocument();
    expect(screen.getByText(/Download full backup/)).toBeInTheDocument();
  });

  it('"Dismiss" hides the warning', () => {
    saveFailed = true;
    render(<StorageWarning />);
    fireEvent.click(screen.getByText('Dismiss'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // saveFailed is recomputed on every state change, so storage can recover
  // (a later save succeeds) and then fail again later in the same session
  // -- a genuinely new failure, not a continuation of the one already
  // dismissed. A dismissal must not silently suppress that new failure.
  it('re-arms after dismissal once saving recovers, so a later failure shows the warning again', async () => {
    saveFailed = true;
    const { rerender } = render(<StorageWarning />);
    fireEvent.click(screen.getByText('Dismiss'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Saving recovers.
    saveFailed = false;
    rerender(<StorageWarning />);
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());

    // A new, later failure.
    saveFailed = true;
    rerender(<StorageWarning />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
