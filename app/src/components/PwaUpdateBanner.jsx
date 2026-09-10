import React, { useEffect } from 'react';
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

  // Being position: fixed in a screen corner, this card can sit on top of
  // whatever real page content happens to scroll into that same corner
  // (e.g. Syllabus.jsx's "Add topic" button) and swallow clicks meant for
  // it for as long as it's shown. "Offline ready" is a pure FYI with
  // nothing to decide, unlike the update prompt below -- auto-dismissing
  // it removes that dead zone quickly instead of leaving it there
  // indefinitely until someone happens to notice and dismiss it by hand.
  useEffect(() => {
    if (!offlineReady) return;
    const id = setTimeout(() => setOfflineReady(false), 6000);
    return () => clearTimeout(id);
  }, [offlineReady, setOfflineReady]);

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
