import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';

// AccountPanel talks to useAuth() and deleteOwnAccount() directly (it
// doesn't touch AppContext), so both are mocked here the same way
// a11y.test.jsx already does for useAuth -- signOut/deleteOwnAccount are
// controllable per test via these outer mocks.
const signOut = vi.fn();
const deleteOwnAccount = vi.fn();

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: () => ({
    configured: true, loading: false, user: { email: 'test@example.com' }, notice: '',
    signInWithGoogle: () => {}, sendMagicLink: () => {}, signOut
  })
}));

vi.mock('../lib/cloudData.js', () => ({ deleteOwnAccount }));

const AccountPanel = (await import('./AccountPanel.jsx')).default;

beforeEach(() => {
  signOut.mockReset();
  deleteOwnAccount.mockReset();
});

function startDeleteFlow() {
  const utils = render(<AccountPanel />);
  fireEvent.click(utils.getByText('Delete my account'));
  fireEvent.change(utils.getByLabelText('Type DELETE to confirm account deletion'), { target: { value: 'DELETE' } });
  return utils;
}

describe('AccountPanel: account deletion error handling', () => {
  it('shows the error when the deletion itself fails, and leaves the confirm UI up for a real retry', async () => {
    deleteOwnAccount.mockRejectedValue(new Error('network error'));
    const { getByText, findByText } = startDeleteFlow();
    fireEvent.click(getByText('Permanently delete'));

    expect(await findByText('network error')).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
    // Still showing the confirm input, not silently dismissed -- a real
    // retry (clicking the button again) is meaningful here since the
    // account was never actually deleted.
    expect(getByText('Permanently delete')).toBeInTheDocument();
  });

  it('signs out normally and shows no error when both steps succeed', async () => {
    deleteOwnAccount.mockResolvedValue(undefined);
    signOut.mockResolvedValue(undefined);
    const { getByText, queryByText } = startDeleteFlow();
    fireEvent.click(getByText('Permanently delete'));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(queryByText('network error')).not.toBeInTheDocument();
  });

  it('does NOT claim deletion failed if only the post-delete signOut() fails -- reloads instead', async () => {
    deleteOwnAccount.mockResolvedValue(undefined);
    // Same error text as the "deletion itself fails" case above -- proves
    // this specific message is being suppressed by the fix, not just
    // absent because nothing rejected.
    signOut.mockRejectedValue(new Error('network error'));
    const originalLocation = window.location;
    delete window.location;
    window.location = { ...originalLocation, reload: vi.fn() };

    const { getByText, queryByText } = startDeleteFlow();
    fireEvent.click(getByText('Permanently delete'));

    await waitFor(() => expect(window.location.reload).toHaveBeenCalledTimes(1));
    // The account WAS deleted -- this must never be reported as a failure,
    // even though signOut() rejected with the exact same message text the
    // first test asserts DOES get shown when deleteOwnAccount() fails.
    expect(queryByText('network error')).not.toBeInTheDocument();

    window.location = originalLocation;
  });
});
