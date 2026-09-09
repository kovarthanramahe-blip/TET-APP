import { useEffect, useRef } from 'react';
import { reminderReasons } from '../lib/logic.js';
import { sendNotification, notificationPermission } from '../lib/notifications.js';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Phase 12: local-only, device-only feature -- remindersEnabled is never
// cloud-synced (see ReminderPanel.jsx's comment for why: Notification
// permission is granted per-browser-per-origin, so syncing the toggle
// across devices would be misleading). This hook is called once from
// App.jsx's Shell, not wired into AppContext.jsx.
//
// stateRef mirrors the latest state on every render without being an
// effect dependency -- the setInterval effect below depends ONLY on
// remindersEnabled, so it starts/stops exactly when that flag changes,
// not on every unrelated state change (which would otherwise reset the
// interval on literally every 1-second Pomodoro tick and it would never
// reach 5 minutes).
export function useStudyReminders(state) {
  const lastNotifiedDateRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!state.remindersEnabled) return;

    const check = () => {
      if (notificationPermission() !== 'granted') return;
      const todayStr = new Date().toISOString().slice(0, 10);
      if (lastNotifiedDateRef.current === todayStr) return; // at most one per day

      const reasons = reminderReasons(stateRef.current);
      if (reasons.length === 0) return;

      lastNotifiedDateRef.current = todayStr;
      sendNotification('HTET Study Desk', reasons.join(' '));
    };

    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [state.remindersEnabled]);
}
