// Phase 12: thin wrapper over the browser Notification API. No backend, no
// push infrastructure, no service worker -- these only ever fire while
// this tab is open, which is a real limitation disclosed directly in
// ReminderPanel.jsx's own UI copy, not hidden from the user.
export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission() {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.requestPermission();
}

export function sendNotification(title, body) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  new Notification(title, { body });
}
