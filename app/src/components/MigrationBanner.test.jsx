import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mocked the same way StorageWarning.test.jsx isolates itself from
// AppContext.jsx -- MigrationBanner only ever reads `migration` off
// useApp(), so mocking it directly tests this component's own render/
// dismiss logic without needing a real AppProvider tree.
let migration;
vi.mock('../AppContext.jsx', () => ({
  useApp: () => ({ migration })
}));

const MigrationBanner = (await import('./MigrationBanner.jsx')).default;

const retry = vi.fn();
const clearCloudError = vi.fn();

function setMigration(overrides) {
  migration = { status: 'idle', error: '', retry, cloudError: '', clearCloudError, ...overrides };
}

beforeEach(() => {
  retry.mockReset();
  clearCloudError.mockReset();
  setMigration({});
});

describe('MigrationBanner: dismissal only silences the attempt it was shown for', () => {
  it('re-arms once a fresh attempt starts (a later login, or Retry), after an earlier attempt was dismissed', async () => {
    setMigration({ status: 'error', error: 'network error' });
    const { rerender } = render(<MigrationBanner />);
    fireEvent.click(screen.getByText('Dismiss'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // A fresh migration attempt begins -- e.g. the documented "log out, log
    // back in" retry path, or another user signing in on the same device
    // without a page reload.
    setMigration({ status: 'migrating' });
    rerender(<MigrationBanner />);
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());

    // That fresh attempt then fails too -- it must be shown, not silently
    // swallowed by the earlier dismissal.
    setMigration({ status: 'error', error: 'network error' });
    rerender(<MigrationBanner />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('a dismissal during one attempt is still respected until a new attempt actually starts', () => {
    setMigration({ status: 'success' });
    const { rerender } = render(<MigrationBanner />);
    fireEvent.click(screen.getByText('Dismiss'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Re-rendering with the SAME status (nothing new happened) must not
    // resurrect the dismissed banner.
    rerender(<MigrationBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
