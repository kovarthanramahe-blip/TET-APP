import { useEffect, useRef } from 'react';
import { reminderReasons, isReminderDue, minutesOn } from '../lib/logic.js';
import { sendNotification, notificationPermission } from '../lib/notifications.js';
import { today } from '../lib/dates.js';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Phase 12: local-only, device-only feature -- remindersEnabled (and the
// scheduling fields added alongside it) are never cloud-synced (see
// ReminderPanel.jsx's comment for why: Notification permission is granted
// per-browser-per-origin, so syncing the toggle across devices would be
// misleading). This hook is called once from App.jsx's Shell, not wired
// into AppContext.jsx.
//
// stateRef mirrors the latest state on every render without being an
// effect dependency -- the setInterval effect below depends ONLY on
// remindersEnabled, so it starts/stops exactly when that flag changes,
// not on every unrelated state change (which would otherwise reset the
// interval on literally every 1-second Pomodoro tick and it would never
// reach 5 minutes).
//
// Two independent notifications, each with its own "already sent today"
// tracker, since they can legitimately both fire on the same day at
// different times: the general reminder (goal/tasks/cards, gated on
// reminderTime/reminderDays) and the end-of-day nudge (gated on its own
// endOfDayNudgeTime, opt-in via endOfDayNudgeEnabled, and simply "have you
// logged any study time at all today" -- distinct from the goal-progress
// reason already covered by the general reminder, and from the streak dot,
// which only reflects days that have already ended).
export function useStudyReminders(state) {
  const lastNotifiedDateRef = useRef(null);
  const lastNudgedDateRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!state.remindersEnabled) return;

    const check = () => {
      if (notificationPermission() !== 'granted') return;
      const now = new Date();
      const todayStr = today();
      const s = stateRef.current;

      if (lastNotifiedDateRef.current !== todayStr && isReminderDue(now, s.reminderTime, s.reminderDays)) {
        const reasons = reminderReasons(s);
        if (reasons.length > 0) {
          lastNotifiedDateRef.current = todayStr;
          sendNotification('HTET Study Desk', reasons.join(' '));
        }
      }

      if (s.endOfDayNudgeEnabled && lastNudgedDateRef.current !== todayStr && isReminderDue(now, s.endOfDayNudgeTime, s.reminderDays)) {
        if (minutesOn(s, todayStr) === 0) {
          lastNudgedDateRef.current = todayStr;
          sendNotification('HTET Study Desk', "You haven't logged any study time today — even 10 minutes keeps your streak alive.");
        }
      }
    };

    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [state.remindersEnabled]);
}
