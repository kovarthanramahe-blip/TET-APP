import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// Same small, non-blocking, dismissible-card pattern as MigrationBanner.jsx.
// registerType: 'prompt' in vite.config.js means the new service worker sits
// idle until updateServiceWorker() is actually called here -- nothing ever
// reloads the page out from under a user mid pomodoro/quiz on its own.
export default function PwaUpdateBanner() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW();

  const base = {
    position: 'fixed', right: 'var(--space-4)', bottom: 'var(--space-4)', maxWidth: '340px',
    padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
    background: 'var(--color-surface)', border: '1px solid var(--color-divider)',
    boxShadow: 'var(--shadow-md)', fontSize: '13px', lineHeight: 1.4,
    display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 1000
  };

  if (needRefresh) {
    return (
      <div style={base} role="status">
        <span>A new version of HTET Study Desk is available.</span>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={() => setNeedRefresh(false)}>
            Later
          </button>
          <button type="button" className="btn btn-primary" style={{ fontSize: '12px' }} onClick={() => updateServiceWorker(true)}>
            Update
          </button>
        </div>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div style={base} role="status">
        <span>HTET Study Desk is ready to work offline.</span>
        <button type="button" className="btn btn-ghost" style={{ alignSelf: 'flex-end', fontSize: '12px' }} onClick={() => setOfflineReady(false)}>
          Dismiss
        </button>
      </div>
    );
  }

  return null;
}
