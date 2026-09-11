import React, { useState } from 'react';
import { useApp } from '../AppContext.jsx';
import { notificationsSupported, notificationPermission, requestNotificationPermission } from '../lib/notifications.js';

export default function ReminderPanel() {
  const { state, actions } = useApp();
  const [denied, setDenied] = useState(notificationPermission() === 'denied');

  if (!notificationsSupported()) return null;

  const toggle = async () => {
    if (!state.remindersEnabled) {
      const permission = await requestNotificationPermission();
      if (permission === 'granted') {
        actions.setRemindersEnabled(true);
        setDenied(false);
      } else {
        // requestPermission() resolves 'denied' (site blocked -- browser
        // settings really are the only way back) or 'default' (the user
        // dismissed the prompt without choosing -- clicking the toggle
        // again just re-prompts). Treating both as "denied" told a user
        // who'd merely dismissed the prompt to go dig through browser
        // settings for a permission that was never actually set.
        setDenied(permission === 'denied');
      }
    } else {
      actions.setRemindersEnabled(false);
    }
  };

  return (
    <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-3)' }}>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={toggle}
        aria-pressed={state.remindersEnabled}
        style={{ justifyContent: 'space-between', width: '100%' }}
      >
        <span>Study reminders</span>
        <span style={{ opacity: .65, fontSize: '12px' }}>{state.remindersEnabled ? 'On' : 'Off'}</span>
      </button>
      {denied && (
        <p style={{ fontSize: '11px', opacity: .65, margin: 'var(--space-2) 0 0', lineHeight: 1.4 }}>
          Notifications are blocked for this site — allow them in your browser settings, then try again.
        </p>
      )}
      {!denied && (
        <p style={{ fontSize: '11px', opacity: .65, margin: 'var(--space-2) 0 0', lineHeight: 1.4 }}>
          One notification a day for an unmet goal, due tasks, or flashcards ready — only while this tab is open.
        </p>
      )}
    </div>
  );
}
