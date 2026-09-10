import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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
});
