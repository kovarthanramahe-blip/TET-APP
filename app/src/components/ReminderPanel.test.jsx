import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider } from '../AppContext.jsx';

const notificationsSupported = vi.fn(() => true);
const notificationPermission = vi.fn(() => 'default');
const requestNotificationPermission = vi.fn();

vi.mock('../lib/notifications.js', () => ({
  notificationsSupported: () => notificationsSupported(),
  notificationPermission: () => notificationPermission(),
  requestNotificationPermission: () => requestNotificationPermission()
}));

const ReminderPanel = (await import('./ReminderPanel.jsx')).default;

beforeEach(() => {
  localStorage.clear();
  notificationsSupported.mockReturnValue(true);
  notificationPermission.mockReturnValue('default');
  requestNotificationPermission.mockReset();
});

function renderPanel() {
  return render(
    <AppProvider>
      <ReminderPanel />
    </AppProvider>
  );
}

// requestNotificationPermission() resolves 'denied' (the site is genuinely
// blocked -- browser settings are the only way back) or 'default' (the
// user dismissed the prompt without choosing -- clicking the toggle again
// simply re-prompts). Conflating the two used to tell a user who'd merely
// dismissed the browser's prompt to go dig through browser settings for a
// permission that was never actually set.
describe('ReminderPanel: distinguishes a dismissed prompt from an actually blocked one', () => {
  it('shows the "blocked, check browser settings" message only when permission is actually denied', async () => {
    requestNotificationPermission.mockResolvedValue('denied');
    const { getByText, queryByText } = renderPanel();

    fireEvent.click(getByText('Study reminders'));

    expect(await waitFor(() => getByText(/blocked for this site/))).toBeInTheDocument();
    expect(queryByText(/only while this tab is open/)).not.toBeInTheDocument();
  });

  it('does NOT show the "blocked" message when the prompt was merely dismissed (default)', async () => {
    requestNotificationPermission.mockResolvedValue('default');
    const { getByText, queryByText, findByText } = renderPanel();

    fireEvent.click(getByText('Study reminders'));

    // Let the async toggle() settle before asserting the negative.
    await findByText(/only while this tab is open/);
    expect(queryByText(/blocked for this site/)).not.toBeInTheDocument();
  });

  it('enables reminders and shows no warning when permission is granted', async () => {
    requestNotificationPermission.mockResolvedValue('granted');
    const { getByText, queryByText } = renderPanel();

    fireEvent.click(getByText('Study reminders'));

    await waitFor(() => expect(getByText('On')).toBeInTheDocument());
    expect(queryByText(/blocked for this site/)).not.toBeInTheDocument();
  });
});
