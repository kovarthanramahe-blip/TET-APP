import React, { useState } from 'react';
import { useApp } from '../AppContext.jsx';
import { notificationsSupported, notificationPermission, requestNotificationPermission } from '../lib/notifications.js';
import { chip } from '../lib/styleHelpers.js';

const WEEKDAYS = [['Sun', 0], ['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6]];

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

      {/* Scheduling layer on top of the existing on/off toggle and
          reminderReasons() check -- a chosen time of day, which days of the
          week to bother on, and a separate opt-in "did you actually study
          today" nudge, distinct from the streak dot (which only reflects
          days that have already ended). None of this is cloud-synced, same
          as remindersEnabled itself: Notification permission is granted
          per-browser-per-origin, so syncing a schedule to a device that was
          never granted permission there would be misleading. */}
      {!denied && state.remindersEnabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'var(--space-3)' }}>
          <label style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            Remind me at
            <input
              type="time" className="input" value={state.reminderTime}
              onChange={e => actions.setReminderTime(e.target.value)}
            />
          </label>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {WEEKDAYS.map(([label, day]) => (
              <button
                key={day} type="button"
                aria-pressed={state.reminderDays.includes(day)}
                aria-label={label + (state.reminderDays.includes(day) ? ', reminders on' : ', reminders off')}
                onClick={() => actions.toggleReminderDay(day)}
                style={chip(state.reminderDays.includes(day), true)}
              >
                {label}
              </button>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
            <input
              type="checkbox" checked={state.endOfDayNudgeEnabled}
              onChange={e => actions.setEndOfDayNudgeEnabled(e.target.checked)}
            />
            Also nudge me at end of day if I haven't studied at all
          </label>
          {state.endOfDayNudgeEnabled && (
            <label style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              End-of-day nudge at
              <input
                type="time" className="input" value={state.endOfDayNudgeTime}
                onChange={e => actions.setEndOfDayNudgeTime(e.target.value)}
              />
            </label>
          )}
        </div>
      )}

      {denied && (
        <p style={{ fontSize: '11px', opacity: .65, margin: 'var(--space-2) 0 0', lineHeight: 1.4 }}>
          Notifications are blocked for this site — allow them in your browser settings, then try again.
        </p>
      )}
      {!denied && (
        <p style={{ fontSize: '11px', opacity: .65, margin: 'var(--space-2) 0 0', lineHeight: 1.4 }}>
          Checks for an unmet goal, due tasks, or flashcards ready — only while this tab is open.
        </p>
      )}
    </div>
  );
}
